// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Contracts
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Libraries
import { RayMath } from "../libs/RayMath.sol";
import { VirtualPool } from "../libs/VirtualPool.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";
import { IStaking } from "../interfaces/IStaking.sol";
import { IAthenaPositionToken } from "../interfaces/IAthenaPositionToken.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Todo
// @bw need dynamic risk pool fee system

// ======= ERRORS ======= //

error OnlyTokenOwner();
error OnlyClaimManager();
error PoolIsPaused();
error PoolIdsMustBeUniqueAndAscending();
error IncompatiblePools(uint128 poolIdA, uint128 poolIdB);
error WithdrawCommitDelayNotReached();
error NotEnoughLiquidity();
error CoverIsExpired();
error NotEnoughPremiums();

contract LiquidityManager is ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;
  using RayMath for uint256;
  using VirtualPool for VirtualPool.VPool;

  // ======= STRUCTS ======= //

  struct CoverRead {
    uint128 poolId;
    uint256 coverAmount;
    uint256 premiums;
    uint256 start;
    uint256 end;
    uint256 premiumsLeft;
    uint256 currentEmissionRate;
    uint256 remainingSeconds;
  }

  struct Cover {
    uint128 poolId;
    uint256 coverAmount;
    uint256 premiums;
    uint256 start;
    uint256 end;
  }

  struct Position {
    uint256 supplied;
    uint256 commitWithdrawalTimestamp;
    uint128[] poolIds;
  }

  struct PoolOverlap {
    uint128 poolId;
    uint256 amount;
  }

  // ======= STORAGE ======= //

  IAthenaPositionToken public positionToken;
  IAthenaCoverToken public coverToken;
  IStaking public staking;
  IEcclesiaDao public ecclesiaDao;
  IStrategyManager public strategyManager;
  address claimManager;

  uint256 public withdrawDelay = 14 days;
  // Maps pool0 -> pool1 -> areCompatible for LP leverage
  mapping(uint128 => mapping(uint128 => bool))
    public arePoolCompatible;

  /// The ID of the next cover to be minted
  uint256 public nextCoverId;
  /// User cover data
  /// @dev left public to read cover initital cover data
  mapping(uint256 _id => Cover) public _covers;

  /// The ID of the next token that will be minted.
  uint256 public nextPositionId;
  /// User LP data
  /// @dev left public to read positions without its poolIds array
  mapping(uint256 _id => Position) public _positions;

  /// The token ID position data
  uint128 public nextPoolId;
  // Maps a pool ID to the virtualized pool's storage
  mapping(uint128 _id => VirtualPool.VPool) private _pools;

  // ======= CONSTRUCTOR ======= //

  constructor(
    IAthenaPositionToken positionToken_,
    IAthenaCoverToken coverToken_,
    IStaking staking_,
    IEcclesiaDao ecclesiaDao_,
    IStrategyManager strategyManager_,
    address claimManager_
  ) Ownable(msg.sender) {
    positionToken = positionToken_;
    coverToken = coverToken_;
    staking = staking_;
    ecclesiaDao = ecclesiaDao_;
    strategyManager = strategyManager_;
    claimManager = claimManager_;
  }

  /// ======= MODIFIERS ======= ///

  modifier onlyCoverOwner(uint256 tokenId) {
    if (msg.sender != coverToken.ownerOf(tokenId))
      revert OnlyTokenOwner();
    _;
  }

  modifier onlyPositionOwner(uint256 tokenId) {
    if (msg.sender != positionToken.ownerOf(tokenId))
      revert OnlyTokenOwner();
    _;
  }

  modifier onlyClaimManager() {
    if (msg.sender != claimManager) revert OnlyClaimManager();
    _;
  }

  /// ======= VIEWS ======= ///

  function positions(
    uint256 tokenId_
  ) external view returns (Position memory) {
    return _positions[tokenId_];
  }

  function positionSize(
    uint256 tokenId_
  ) external view returns (uint256) {
    // @bw This needs to be fixed to take into account loss of capital by claims, especially for computing strategy rewards
    return _positions[tokenId_].supplied;
  }

  function covers(
    uint256 tokenId_
  ) external view returns (CoverRead memory) {
    Cover storage cover = _covers[tokenId_];

    VirtualPool.CoverInfo memory info = _pools[cover.poolId]
      ._coverInfo(tokenId_, true);

    return
      CoverRead({
        poolId: cover.poolId,
        coverAmount: cover.coverAmount,
        premiums: cover.premiums,
        start: cover.start,
        end: cover.end,
        premiumsLeft: info.premiumsLeft,
        currentEmissionRate: info.currentEmissionRate,
        remainingSeconds: info.remainingSeconds
      });
  }

  function coverSize(uint256 tokenId_) public view returns (uint256) {
    return _covers[tokenId_].coverAmount;
  }

  function isCoverActive(
    uint256 tokenId
  ) external view returns (bool) {
    return _covers[tokenId].end == 0;
  }

  function poolInfo(
    uint128 poolId_
  ) external view returns (VirtualPool.VPoolRead memory) {
    VirtualPool.VPool storage pool = _pools[poolId_];

    return
      VirtualPool.VPoolRead({
        poolId: pool.poolId,
        protocolShare: pool.protocolShare,
        formula: pool.formula,
        slot0: pool.slot0,
        liquidityIndex: pool.liquidityIndex,
        strategyId: pool.strategyId,
        paymentAsset: pool.paymentAsset,
        underlyingAsset: pool.underlyingAsset,
        wrappedAsset: pool.wrappedAsset,
        isPaused: pool.isPaused,
        overlappedPools: pool.overlappedPools,
        processedClaims: pool.processedClaims
      });
  }

  function poolOverlaps(
    uint128 poolId0_,
    uint128 poolId1_
  ) external view returns (uint256) {
    return _pools[poolId0_].overlaps[poolId1_];
  }

  function poolLpInfos(
    uint128 poolId_,
    uint256 positionId
  ) external view returns (VirtualPool.LPInfo memory) {
    return _pools[poolId_].lpInfos[positionId];
  }

  function poolTicks(
    uint128 poolId_,
    uint32 tick
  ) external view returns (uint256[] memory) {
    return _pools[poolId_].ticks[tick];
  }

  function poolCoverPremiums(
    uint128 poolId_,
    uint256 coverId
  ) external view returns (VirtualPool.CoverPremiums memory) {
    return _pools[poolId_].coverPremiums[coverId];
  }

  /// ======= POOLS ======= ///

  function createPool(
    address paymentAsset_,
    uint256 strategyId_,
    uint256 protocolShare_,
    uint256 uOptimal_,
    uint256 r0_,
    uint256 rSlope1_,
    uint256 rSlope2_,
    uint128[] calldata compatiblePools_
  ) external onlyOwner {
    // Save pool ID to memory and update for next
    uint128 poolId = nextPoolId;
    nextPoolId++;

    (address underlyingAsset, address wrappedAsset) = strategyManager
      .assets(strategyId_);

    // Create virtual pool argument struct
    VirtualPool.VPoolConstructorParams memory args = VirtualPool
      .VPoolConstructorParams({
        poolId: poolId,
        dao: ecclesiaDao,
        strategyId: strategyId_,
        paymentAsset: paymentAsset_,
        underlyingAsset: underlyingAsset,
        wrappedAsset: wrappedAsset,
        protocolShare: protocolShare_, //Ray
        uOptimal: uOptimal_, //Ray
        r0: r0_, //Ray
        rSlope1: rSlope1_, //Ray
        rSlope2: rSlope2_, //Ray
        coverSize: coverSize
      });

    // Get storage pointer to pool
    VirtualPool.VPool storage pool = _pools[poolId];
    // Create virtual pool
    pool._vPoolConstructor(args);

    // Add compatible pools
    // @dev Registered both ways for safety
    uint256 nbPools = compatiblePools_.length;
    for (uint256 i; i < nbPools; i++) {
      uint128 compatiblePoolId = compatiblePools_[i];
      arePoolCompatible[poolId][compatiblePoolId] = true;
      arePoolCompatible[compatiblePoolId][poolId] = true;
    }
  }

  function syncPool(uint128 poolId_) external {
    // Get storage pointer to pool
    VirtualPool.VPool storage pool = _pools[poolId_];
    // Clean pool from expired covers
    _processExpiredTokens(pool._actualizing());
  }

  /// ======= COVER HELPERS ======= ///

  function _processExpiredTokens(
    uint256[] memory tokenIds_
  ) internal {
    uint256 nbTokens = tokenIds_.length;
    for (uint256 i; i < nbTokens; i++) {
      _covers[tokenIds_[i]].end = block.timestamp;
      // @bw check if spent premium is correct after manual expiration
      // @bw should auto unfarm if it is currently farming rewards
    }
  }

  /// ======= BUY COVER ======= ///

  function buyCover(
    uint128 poolId_,
    uint256 coverAmount_,
    uint256 premiums_
  ) external {
    // Get storage pointer to pool
    VirtualPool.VPool storage pool = _pools[poolId_];

    // Clean pool from expired covers
    _processExpiredTokens(pool._actualizing());

    // Check if pool is currently paused
    if (pool.isPaused) revert PoolIsPaused();
    // Check if pool has enough liquidity
    if (pool.availableLiquidity() < coverAmount_)
      revert NotEnoughLiquidity();

    // Transfer premiums from user
    IERC20(pool.paymentAsset).safeTransferFrom(
      msg.sender,
      address(this), // @bw Check handling of funds
      premiums_
    );

    // Save new cover ID and update for next
    uint256 coverId = nextCoverId;
    nextCoverId++;

    // Create cover
    _covers[coverId] = Cover({
      poolId: poolId_,
      coverAmount: coverAmount_,
      premiums: premiums_,
      start: block.timestamp,
      end: 0
    });

    // Create cover in pool
    pool._buyCover(poolId_, coverAmount_, premiums_);

    // Mint cover NFT
    coverToken.mint(msg.sender, coverId);
  }

  /// ======= UPDATE COVER ======= ///

  function updateCover(
    uint256 coverId_,
    uint256 coverToAdd_,
    uint256 coverToRemove_,
    uint256 premiumsToAdd_,
    uint256 premiumsToRemove_
  ) external onlyCoverOwner(coverId_) {
    // Get storage pointer to cover
    Cover storage cover = _covers[coverId_];
    // Get storage pointer to pool
    VirtualPool.VPool storage pool = _pools[cover.poolId];

    // Clean pool from expired covers
    _processExpiredTokens(pool._actualizing());

    // Check if pool is currently paused
    if (pool.isPaused) revert PoolIsPaused();
    // Check if cover is expired
    if (cover.end != 0) revert CoverIsExpired();

    // Get the amount of premiums left
    uint256 premiums = pool._coverInfo(coverId_, false).premiumsLeft;
    pool._closeCover(coverId_, cover.coverAmount);

    // Only allow one operation on cover amount change
    if (0 < coverToAdd_) {
      /**
       * Check if pool has enough liquidity,
       * we closed cover at this point so check for total
       * */
      if (pool.availableLiquidity() < cover.coverAmount + coverToAdd_)
        revert NotEnoughLiquidity();

      cover.coverAmount += coverToAdd_;
    } else if (0 < coverToRemove_) {
      // User is allowed to set the cover amount to 0 to pause the cover
      cover.coverAmount -= coverToRemove_;
    }

    // Only allow one operation on premiums amount change
    if (0 < premiumsToRemove_) {
      if (premiumsToRemove_ == type(uint256).max) {
        // If premiumsToRemove_ is max uint256, then remove all premiums
        premiumsToRemove_ = premiums;
      } else if (premiums < premiumsToRemove_) {
        // Else check if there is enough premiums left
        revert NotEnoughPremiums();
      }

      premiums -= premiumsToRemove_;

      IERC20(pool.paymentAsset).safeTransfer(msg.sender, premiums);
    } else if (0 < premiumsToAdd_) {
      // Transfer premiums from user
      IERC20(pool.paymentAsset).safeTransferFrom(
        msg.sender,
        address(this), // @bw Check handling of funds
        premiumsToAdd_
      );
      premiums += premiumsToAdd_;
    }

    // If no premiums left, then cover expires & should not be reopened
    if (premiums == 0) {
      cover.end = block.timestamp;
    } else {
      // Update cover
      pool._buyCover(cover.poolId, cover.coverAmount, premiums);
    }
  }

  /// ======= MAKE LP POSITION ======= ///

  function createPosition(
    uint256 amount,
    bool isWrapped,
    uint128[] calldata poolIds
  ) external {
    // Save new position tokenId and update for next
    uint256 tokenId = nextPositionId;
    nextPositionId++;

    // All pools share the same strategy so we can use the first pool ID
    uint256 strategyId = _pools[poolIds[0]].strategyId;
    uint256 amountUnderlying = isWrapped
      ? strategyManager.wrappedToUnderlying(strategyId, amount)
      : amount;

    // Check pool compatibility & underlying token then register overlapping capital
    _addOverlappingCapitalAfterCheck(poolIds, amountUnderlying);

    // Push funds to strategy manager
    if (isWrapped) {
      address wrappedAsset = _pools[poolIds[0]].wrappedAsset;
      IERC20(wrappedAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositWrappedToStrategy(strategyId, tokenId);
    } else {
      address underlyingAsset = _pools[poolIds[0]].underlyingAsset;
      IERC20(underlyingAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositToStrategy(strategyId, tokenId, amount);
    }

    _positions[tokenId] = Position({
      supplied: amountUnderlying,
      commitWithdrawalTimestamp: 0,
      poolIds: poolIds
    });

    // Mint position NFT
    positionToken.mint(msg.sender, tokenId);
  }

  /// ======= UPDATE LP POSITION ======= ///

  function increasePosition(
    uint256 tokenId_,
    uint256 amount,
    bool isWrapped
  ) external onlyPositionOwner(tokenId_) {
    Position storage position = _positions[tokenId_];
    uint256 strategyId = _pools[position.poolIds[0]].strategyId;

    // Take interests in all pools before update
    takeInterests(tokenId_);

    uint256 amountUnderlying = isWrapped
      ? strategyManager.wrappedToUnderlying(strategyId, amount)
      : amount;

    // Check pool compatibility & underlying token then register overlapping capital
    _addOverlappingCapitalAfterCheck(
      position.poolIds,
      amountUnderlying
    );

    // Push funds to strategy manager
    if (isWrapped) {
      address wrappedAsset = _pools[position.poolIds[0]].wrappedAsset;
      IERC20(wrappedAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositWrappedToStrategy(strategyId, tokenId_);
    } else {
      address underlyingAsset = _pools[position.poolIds[0]]
        .underlyingAsset;
      IERC20(underlyingAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositToStrategy(strategyId, tokenId_, amount);
    }

    position.supplied += amountUnderlying;
  }

  /// ======= TAKE LP INTERESTS ======= ///

  // @bw needs to be updated for strat reward withdraw + take fees in pools
  // compute amount of rewards & transfer from cover manager to user + register new reward index
  function takeInterests(
    uint256 tokenId_
  ) public onlyPositionOwner(tokenId_) {
    Position storage position = _positions[tokenId_];
    address account = positionToken.ownerOf(tokenId_);
    uint256 feeDiscount = staking.feeDiscountOf(account);

    uint256 amountSuppliedUpdated;
    uint256 nbPools = position.poolIds.length;
    for (uint256 i; i < nbPools; i++) {
      VirtualPool.VPool storage pool = _pools[position.poolIds[i]];

      // Clean pool from expired covers
      // @bw check if need to expire tokens before taking interests
      _processExpiredTokens(pool._actualizing());

      (uint256 _newUserCapital, uint256 _scaledAmountToRemove) = pool
        ._takePoolInterests(
          tokenId_,
          account,
          position.supplied,
          feeDiscount,
          position.poolIds
        );

      // Update capital based on claims on last loop
      if (i == nbPools - 1) {
        amountSuppliedUpdated = _newUserCapital;
      }
    }

    // Withdraw interests from strategy
    // All pools have same strategy since they are compatible
    uint256 strategyId = _pools[position.poolIds[0]].strategyId;
    strategyManager.withdrawRewards(
      strategyId,
      tokenId_,
      account,
      feeDiscount
    );

    if (position.supplied != amountSuppliedUpdated) {
      _positions[tokenId_].supplied = amountSuppliedUpdated;
    }
  }

  /// ======= CLOSE LP POSITION ======= ///

  function commitPositionWithdrawal(
    uint256 tokenId_
  ) external onlyPositionOwner(tokenId_) {
    Position storage position = _positions[tokenId_];

    position.commitWithdrawalTimestamp = block.timestamp;

    // @bw should lock rewards in strategy to avoid commiting upon deposit
    uint256 strategyId = _pools[position.poolIds[0]].strategyId;
    strategyManager.lockRewardsPostWithdrawalCommit(
      strategyId,
      tokenId_
    );
  }

  function closePosition(
    uint256 tokenId_,
    bool keepWrapped_
  ) external onlyPositionOwner(tokenId_) {
    Position storage position = _positions[tokenId_];
    uint256 commitTimestamp = position.commitWithdrawalTimestamp;

    if (block.timestamp < commitTimestamp + withdrawDelay)
      revert WithdrawCommitDelayNotReached();

    address account = positionToken.ownerOf(tokenId_);

    uint256 feeDiscount = staking.feeDiscountOf(account);
    _removeOverlappingCapital(
      tokenId_,
      account,
      position.supplied,
      feeDiscount,
      position.poolIds
    );

    // All pools have same strategy since they are compatible
    uint256 strategyId = _pools[position.poolIds[0]].strategyId;
    // @bw this should be impacted by capital loses incurred by claims
    if (keepWrapped_) {
      strategyManager.withdrawWrappedFromStrategy(
        strategyId,
        tokenId_,
        position.supplied,
        account,
        feeDiscount
      );
    } else {
      strategyManager.withdrawFromStrategy(
        strategyId,
        tokenId_,
        position.supplied,
        account,
        feeDiscount
      );
    }

    // Reduce position to 0 since we cannot partial withdraw
    position.supplied = 0;
  }

  /// ======= LP FEE DISCOUNT ======= ///

  function feeDiscountUpdate(
    address account_,
    uint128 prevFeeDiscount_
  ) external {
    // @bw Should take interests in all positions using the prev fee discount
  }

  /// ======= LIQUIDITY OVERLAPS ======= ///

  /// @dev Pool IDs must be checked to ensure they are unique and ascending
  function _addOverlappingCapitalAfterCheck(
    uint128[] memory poolIds_,
    uint256 amount_
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint128 i; i < nbPoolIds; i++) {
      uint128 poolId0 = poolIds_[i];
      VirtualPool.VPool storage pool0 = _pools[poolId0];

      // Check if pool is currently paused
      if (pool0.isPaused) revert PoolIsPaused();

      // Remove expired covers
      pool0._actualizing();

      // Add liquidity to the pools available liquidity
      pool0.overlaps[poolId0] += amount_;

      /**
       * Loops all pool combinations to check if they are compatible,
       * that they are in ascending order & that they are unique.
       * It then registers the overlapping capital.
       *
       * The loop starts at i + 1 to avoid redundant combinations.
       */
      for (uint128 j = i + 1; j < nbPoolIds; j++) {
        uint128 poolId1 = poolIds_[j];
        VirtualPool.VPool storage pool1 = _pools[poolId1];

        // Check if pool ID is greater than the previous one
        // This ensures each pool ID is unique & reduces computation cost
        if (poolId1 <= poolId0)
          revert PoolIdsMustBeUniqueAndAscending();

        // Check if pool is compatible
        if (!arePoolCompatible[poolId0][poolId1])
          revert IncompatiblePools(poolId0, poolId1);

        if (poolId0 != poolId1 && pool0.overlaps[poolId1] == 0) {
          pool0.overlappedPools.push(poolId1);
          pool1.overlappedPools.push(poolId0);
        }

        pool0.overlaps[poolId1] += amount_;
      }
    }
  }

  // @dev poolIds have been checked at creation to ensure they are unique and ascending
  function _removeOverlappingCapital(
    uint256 tokenId_,
    address account_,
    uint256 amount_,
    uint256 feeDiscount_,
    uint128[] storage poolIds_
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint128 i; i < nbPoolIds; i++) {
      uint128 poolId0 = poolIds_[i];
      VirtualPool.VPool storage pool0 = _pools[poolId0];

      // Need to clean covers to avoid them causing a utilization overflow
      pool0._actualizing();

      // Remove liquidity
      pool0._withdrawLiquidity(
        tokenId_,
        account_,
        amount_,
        feeDiscount_,
        poolIds_
      );

      // Considering the verification that pool IDs are unique & ascending
      // then start index is i to reduce required number of loops
      for (uint128 j = i; j < nbPoolIds; j++) {
        uint128 poolId1 = poolIds_[j];
        pool0.overlaps[poolId1] -= amount_;
      }
    }
  }

  /// ======= CLAIMS ======= ///

  function addClaimToPool(
    uint256 coverId_
  ) external onlyClaimManager {
    _pools[_covers[coverId_].poolId].ongoingClaims++;
  }

  function removeClaimFromPool(
    uint256 coverId_
  ) external onlyClaimManager {
    _pools[_covers[coverId_].poolId].ongoingClaims--;
  }

  // @bw this should reduce the user's cover to avoid stress on the pool
  function payoutClaim(
    uint256 coverId_,
    uint256 amount_
  ) external onlyClaimManager {
    uint128 poolId = _covers[coverId_].poolId;
    VirtualPool.VPool storage poolA = _pools[poolId];
    uint256 ratio = amount_.rayDiv(poolA.availableLiquidity());

    // All pools have same strategy since they are compatible
    uint256 strategyId = _pools[poolA.overlappedPools[0]].strategyId;
    uint256 rewardIndex = strategyManager.getRewardIndex(strategyId);

    uint256 nbPools = poolA.overlappedPools.length;
    for (uint128 i; i < nbPools + 1; i++) {
      uint128 poolIdB = poolA.overlappedPools[i];
      VirtualPool.VPool storage poolB = _pools[poolIdB];

      (VirtualPool.VPool storage pool0, uint128 poolId1) = poolId <
        poolIdB
        ? (poolA, poolIdB)
        : (poolB, poolId);

      // New context to avoid stack too deep error
      {
      // Remove liquidity from dependant pool
        uint256 amountToRemove = pool0.overlaps[poolId1].rayMul(
          ratio
        );
      // Pool overlaps are used to compute the amount of liq to remove from each pool
      pool0.overlaps[poolId1] -= amountToRemove;
      poolB.overlaps[poolIdB] -= amountToRemove;

      poolB._actualizing();
      poolB._updateSlot0WhenAvailableLiquidityChange(
        0,
        amountToRemove
      );
      }

      poolB.processedClaims.push(
        VirtualPool.PoolClaim({
          fromPoolId: poolId,
          ratio: ratio,
          liquidityIndexBeforeClaim: poolB.liquidityIndex,
          rewardIndexBeforeClaim: rewardIndex
        })
      );
    }

    address claimant = coverToken.ownerOf(coverId_);
    strategyManager.payoutFromStrategy(strategyId, amount_, claimant);
  }
}
