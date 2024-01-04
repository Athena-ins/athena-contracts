// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Contracts
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Libraries
import { RayMath } from "../libs/RayMath.sol";
import { VirtualPool } from "../libs/VirtualPool.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { PremiumPosition } from "../libs/PremiumPosition.sol";

// Interfaces
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";
import { IStaking } from "../interfaces/IStaking.sol";
import { IAthenaPositionToken } from "../interfaces/IAthenaPositionToken.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Todo
// @bw need dynamic risk pool fee system

// ======= ERRORS ======= //

error OnlyTokenOwner();
error OnlyClaimManager();
error PoolsHaveOngoingClaims();
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
  IStrategyManager public strategyManager;
  address claimManager;

  /// The ID of the next cover to be minted
  uint256 public nextCoverId;
  /// User cover data
  mapping(uint256 _id => Cover _cover) public covers;

  /// The ID of the next token that will be minted.
  uint256 public nextPositionId = 0;
  /// User LP data
  mapping(uint256 _id => Position _position) public positions;

  /// The token ID position data
  uint128 public nextPoolId;
  // Maps a pool ID to the virtualized pool's storage
  // @bw need custom view fn
  mapping(uint128 _id => VirtualPool.VPool _vPool) private pools;

  uint256 public withdrawDelay = 14 days;
  // Maps pool0 -> pool1 -> areCompatible for LP leverage
  mapping(uint128 => mapping(uint128 => bool))
    public arePoolCompatible;

  // ======= CONSTRUCTOR ======= //

  constructor(
    IAthenaPositionToken positionToken_,
    IAthenaCoverToken coverToken_,
    IStaking staking_,
    IStrategyManager strategyManager_,
    address claimManager_
  ) Ownable(msg.sender) {
    positionToken = positionToken_;
    coverToken = coverToken_;
    staking = staking_;
    strategyManager = strategyManager_;
    claimManager = claimManager_;
  }

  // @bw cannort return complex struct
  // function poolInfo(
  //   uint256 poolId_
  // ) external view returns (VirtualPool.VPool memory) {
  //   return pools[poolId_];
  // }

  /// ======= MODIFIERS ======= ///

  modifier onlyCoverOwner(uint256 tokenId, address account) {
    if (account != coverToken.ownerOf(tokenId))
      revert OnlyTokenOwner();
    _;
  }

  modifier onlyPositionOwner(uint256 tokenId, address account) {
    if (account != positionToken.ownerOf(tokenId))
      revert OnlyTokenOwner();
    _;
  }

  modifier onlyClaimManager() {
    if (msg.sender != claimManager) revert OnlyClaimManager();
    _;
  }

  /// ======= VIEWS ======= ///

  function positionSize(
    uint256 tokenId_
  ) external view returns (uint256) {
    // @bw This needs to be fixed to take into account loss of capital by claims, especially for computing strategy rewards
    return positions[tokenId_].supplied;
  }

  function coverSize(uint256 tokenId_) public view returns (uint256) {
    return covers[tokenId_].coverAmount;
  }

  function isCoverActive(
    uint256 tokenId
  ) external view returns (bool) {
    return covers[tokenId].end == 0;
  }

  function poolInfo(
    uint128 poolId_
  ) external view returns (VirtualPool.VPoolInfo memory) {
    VirtualPool.VPool storage pool = pools[poolId_];
    return
      VirtualPool.VPoolInfo({
        poolId: pool.poolId,
        protocolShare: pool.protocolShare,
        f: pool.f,
        slot0: pool.slot0,
        liquidityIndex: pool.liquidityIndex,
        strategyId: pool.strategyId,
        paymentAsset: pool.paymentAsset,
        underlyingAsset: pool.underlyingAsset,
        isPaused: pool.isPaused,
        overlappedPools: pool.overlappedPools,
        processedClaims: pool.processedClaims
      });
  }

  function poolOverlaps(
    uint128 poolId0_,
    uint128 poolId1_
  ) external view returns (uint256) {
    return pools[poolId0_].overlaps[poolId1_];
  }

  function poolLpInfos(
    uint128 poolId_,
    uint256 positionId
  ) external view returns (VirtualPool.LPInfo memory) {
    return pools[poolId_].lpInfos[positionId];
  }

  function poolTicks(
    uint128 poolId_,
    uint32 tick
  ) external view returns (uint256[] memory) {
    return pools[poolId_].ticks[tick];
  }

  function poolPremiumPositions(
    uint128 poolId_,
    uint256 coverId
  ) external view returns (PremiumPosition.Info memory) {
    return pools[poolId_].premiumPositions[coverId];
  }

  /// ======= POOLS ======= ///

  function createPool(
    address paymentAsset_,
    address underlyingAsset_,
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

    // Get storage pointer to pool
    VirtualPool.VPool storage pool = pools[poolId];

    // Create virtual pool
    pool._vPoolConstructor(
      poolId,
      paymentAsset_,
      underlyingAsset_,
      protocolShare_, //Ray
      uOptimal_, //Ray
      r0_, //Ray
      rSlope1_, //Ray
      rSlope2_, //Ray
      coverSize
    );

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
    VirtualPool.VPool storage pool = pools[poolId_];
    // Clean pool from expired covers
    _processExpiredTokens(pool._actualizing());
  }

  /// ======= COVER HELPERS ======= ///

  function _processExpiredTokens(
    uint256[] memory tokenIds_
  ) internal {
    uint256 nbTokens = tokenIds_.length;
    for (uint256 i; i < nbTokens; i++) {
      covers[tokenIds_[i]].end = block.timestamp;
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
    VirtualPool.VPool storage pool = pools[poolId_];

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
    covers[coverId] = Cover({
      poolId: poolId_,
      coverAmount: coverAmount_,
      premiums: premiums_,
      start: block.timestamp,
      end: 0
    });

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
  ) external {
    // Get storage pointer to cover
    Cover storage cover = covers[coverId_];
    // Get storage pointer to pool
    VirtualPool.VPool storage pool = pools[cover.poolId];

    // Clean pool from expired covers
    _processExpiredTokens(pool._actualizing());

    // @bw check cover ownership
    // Check if pool is currently paused
    if (pool.isPaused) revert PoolIsPaused();
    // Check if cover is expired
    if (cover.end != 0) revert CoverIsExpired();

    uint256 premiumsLeft = pool._closeCover(
      coverId_,
      cover.coverAmount
    );

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
      // If premiumsToRemove_ is max uint256, then remove all premiums
      if (premiumsToRemove_ == type(uint256).max) {
        premiumsToRemove_ = premiumsLeft;
      } else if (premiumsLeft < premiumsToRemove_) {
        // Else check if there is enough premiums left
        revert NotEnoughPremiums();
      }

      cover.premiums -= premiumsToRemove_;
      IERC20(pool.paymentAsset).safeTransfer(
        msg.sender,
        premiumsLeft
      );
    } else if (0 < premiumsToAdd_) {
      // Transfer premiums from user
      IERC20(pool.paymentAsset).safeTransferFrom(
        msg.sender,
        address(this), // @bw Check handling of funds
        premiumsToAdd_
      );
      cover.premiums += premiumsToAdd_;
    }

    // If no premiums left, then cover expires & should not be reopened
    if (cover.premiums == 0) {
      covers[coverId_].end = block.timestamp;
    } else {
      // Update cover
      pool._buyCover(cover.poolId, cover.coverAmount, cover.premiums);
    }
  }

  /// ======= MAKE LP POSITION ======= ///

  function createPosition(
    uint256 amount,
    uint128[] calldata poolIds
  ) external {
    // Save new position tokenId and update for next
    uint256 tokenId = nextPositionId;
    nextPositionId++;

    // Check pool compatibility & underlying token then register overlapping capital
    _addOverlappingCapitalAfterCheck(poolIds, amount);
    // Deposit fund into the strategy if any
    // All pools share the same strategy so we can use the last pool ID in memory
    // @bw push or pull funds ?
    uint256 strategyId = pools[poolIds[0]].strategyId;

    // Push funds to strategy manager
    address underlyingAsset = pools[poolIds[0]].underlyingAsset;
    IERC20(underlyingAsset).safeTransferFrom(
      msg.sender,
      address(strategyManager),
      amount
    );

    strategyManager.depositToStrategy(strategyId, tokenId, amount);

    positions[tokenId] = Position({
      supplied: amount,
      commitWithdrawalTimestamp: 0,
      poolIds: poolIds
    });

    // Mint position NFT
    positionToken.mint(msg.sender, tokenId);
  }

  /// ======= UPDATE LP POSITION ======= ///

  function increasePosition(
    uint256 tokenId,
    uint256 amount
  ) external onlyOwner {
    Position storage position = positions[tokenId];

    // Take interests in all pools before update
    takeInterests(msg.sender, tokenId);
    // Check pool compatibility & underlying token then register overlapping capital
    _addOverlappingCapitalAfterCheck(position.poolIds, amount);

    uint256 strategyId = pools[position.poolIds[0]].strategyId;
    // Push funds to strategy manager
    address underlyingAsset = pools[position.poolIds[0]]
      .underlyingAsset;
    IERC20(underlyingAsset).safeTransferFrom(
      msg.sender,
      address(strategyManager),
      amount
    );
    strategyManager.depositToStrategy(strategyId, tokenId, amount);

    position.supplied += amount;
  }

  /// ======= TAKE LP INTERESTS ======= ///

  // @bw needs to be updated for strat reward withdraw + take fees in pools
  // compute amount of rewards & transfer from cover manager to user + register new reward index
  // @bw need to check ownership with ownerOf instead of arg
  function takeInterests(address account, uint256 tokenId) public {
    Position storage position = positions[tokenId];

    uint256 feeDiscount = staking.feeDiscountOf(account);

    uint256 amountSuppliedUpdated;
    uint256 nbPools = position.poolIds.length;
    for (uint256 i; i < nbPools; i++) {
      VirtualPool.VPool storage pool = pools[position.poolIds[i]];

      // Remove expired covers
      pool._actualizing();

      (uint256 _newUserCapital, uint256 _scaledAmountToRemove) = pool
        ._takePoolInterests(
          account,
          tokenId,
          position.supplied,
          position.poolIds,
          feeDiscount
        );
    }

    // Withdraw interests from strategy
    // All pools have same strategy since they are compatible
    uint256 strategyId = pools[position.poolIds[0]].strategyId;
    strategyManager.withdrawRewards(
      strategyId,
      tokenId,
      account,
      feeDiscount
    );

    if (position.supplied != amountSuppliedUpdated) {
      positions[tokenId].supplied = amountSuppliedUpdated;
    }
  }

  /// ======= CLOSE LP POSITION ======= ///

  function commitPositionWithdrawal(
    uint256 tokenId_,
    address account_
  ) external onlyOwner onlyPositionOwner(tokenId_, account_) {
    positions[tokenId_].commitWithdrawalTimestamp = block.timestamp;
    // @bw should lock rewards in strategy to avoid commiting upon deposit
  }

  function closePosition(
    uint256 tokenId_,
    address account_
  ) external onlyOwner onlyPositionOwner(tokenId_, account_) {
    Position storage position = positions[tokenId_];
    uint256 commitTimestamp = position.commitWithdrawalTimestamp;

    if (block.timestamp < commitTimestamp + withdrawDelay)
      revert WithdrawCommitDelayNotReached();

    // Check that pools have no ongoing claims
    // @bw need fix
    // bool claimsLock = claimManager.canWithdraw(poolIds);
    // if (claimsLock) revert PoolsHaveOngoingClaims();

    uint256 feeDiscount = staking.feeDiscountOf(account_);
    _removeOverlappingCapital(
      position.poolIds,
      tokenId_,
      position.supplied,
      feeDiscount
    );

    // All pools have same strategy since they are compatible
    uint256 strategyId = pools[position.poolIds[0]].strategyId;
    // @bw this should send back funds to user with rewards, minus fees
    strategyManager.withdrawFromStrategy(
      strategyId,
      tokenId_,
      position.supplied,
      account_,
      feeDiscount
    );

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
      VirtualPool.VPool storage pool0 = pools[poolId0];

      // Check if pool is currently paused
      if (pool0.isPaused) revert PoolIsPaused();

      // Remove expired covers
      pool0._actualizing();

      // Considering the verification that pool IDs are unique & ascending
      // then start index is i to reduce required number of loops
      for (uint128 j = i; j < nbPoolIds; j++) {
        uint128 poolId1 = poolIds_[j];
        VirtualPool.VPool storage pool1 = pools[poolId1];

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

  function _removeOverlappingCapital(
    uint128[] storage poolIds_,
    uint256 tokenId_,
    uint256 amount_,
    uint256 feeDiscount_
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint128 i; i < nbPoolIds; i++) {
      uint128 poolId0 = poolIds_[i];
      VirtualPool.VPool storage pool0 = pools[poolId0];

      // Remove expired covers
      pool0._actualizing();
      // Remove liquidity
      pool0._withdrawLiquidity(
        poolIds_,
        tokenId_,
        amount_,
        feeDiscount_
      );

      // Considering the verification that pool IDs are unique & ascending
      // then start index is i to reduce required number of loops
      for (uint128 j = i; j < nbPoolIds; j++) {
        uint128 poolId1 = poolIds_[j];
        pool0.overlaps[poolId1] -= amount_;
      }
    }
  }

  /// ======= LIQUIDITY FOR CLAIMS ======= ///

  function payoutClaim(
    uint128 poolId_,
    uint256 amount_,
    address claimant_
  ) external onlyClaimManager {
    VirtualPool.VPool storage poolA = pools[poolId_];
    uint256 ratio = amount_.rayDiv(poolA.availableLiquidity());

    // All pools have same strategy since they are compatible
    uint256 strategyId = pools[poolA.overlappedPools[0]].strategyId;

    uint256 nbPools = poolA.overlappedPools.length;
    for (uint128 i; i < nbPools + 1; i++) {
      uint128 poolIdB = poolA.overlappedPools[i];
      VirtualPool.VPool storage poolB = pools[poolIdB];

      (VirtualPool.VPool storage pool0, uint128 poolId1) = poolId_ <
        poolIdB
        ? (poolA, poolIdB)
        : (poolB, poolId_);

      // Remove liquidity from dependant pool
      uint256 amountToRemove = pool0.overlaps[poolId1].rayMul(ratio);
      // Pool overlaps are used to compute the amount of liq to remove from each pool
      pool0.overlaps[poolId1] -= amountToRemove;
      poolB.overlaps[poolIdB] -= amountToRemove;

      poolB._actualizing();

      poolB._updateSlot0WhenAvailableLiquidityChange(
        0,
        amountToRemove
      );

      poolB.processedClaims.push(
        VirtualPool.PoolClaim({
          fromPoolId: poolId_,
          ratio: ratio,
          liquidityIndexBeforeClaim: poolB.liquidityIndex,
          rewardIndexBeforeClaim: strategyManager.getRewardIndex(
            strategyId
          )
        })
      );
    }

    strategyManager.payoutFromStrategy(
      strategyId,
      amount_,
      claimant_
    );
  }
}
