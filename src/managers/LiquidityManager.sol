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
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";
import { IStaking } from "../interfaces/IStaking.sol";
import { IFarmingRange } from "../interfaces/IFarmingRange.sol";
import { IAthenaPositionToken } from "../interfaces/IAthenaPositionToken.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { console } from "hardhat/console.sol";

// Todo
// @bw add fns to debug if certain loops become too gas intensive to run in a single block
// @bw add proxies to major contracts and fns to update state variables

// ======= ERRORS ======= //

error OnlyTokenOwner();
error OnlyClaimManager();
error OnlyFarmingRange();
error PoolIsPaused();
error PoolIdsMustBeUniqueAndAscending();
error AmountOfPoolsIsAboveMaxLeverage();
error IncompatiblePools(uint64 poolIdA, uint64 poolIdB);
error WithdrawCommitDelayNotReached();
error InsufficientLiquidityForCover();
error RatioAbovePoolCapacity();
error CoverIsExpired();
error NotEnoughPremiums();
error SenderNotLiquidationManager();
error CannotTakeInterestsIfCommittedWithdrawal();
error CannotIncreaseIfCommittedWithdrawal();
error PositionNotCommited();

contract LiquidityManager is
  ILiquidityManager,
  ReentrancyGuard,
  Ownable
{
  using SafeERC20 for IERC20;
  using RayMath for uint256;
  using VirtualPool for VirtualPool.VPool;

  // ======= STORAGE ======= //

  IAthenaPositionToken public positionToken;
  IAthenaCoverToken public coverToken;
  IStaking public staking;
  IFarmingRange public farming;
  IEcclesiaDao public ecclesiaDao;
  IStrategyManager public strategyManager;
  address public claimManager;

  uint256 public withdrawDelay; // in seconds
  uint256 public maxLeverage;
  uint256 public leverageFeePerPool; // Ray
  // Maps pool0 -> pool1 -> areCompatible for LP leverage
  mapping(uint64 => mapping(uint64 => bool)) public arePoolCompatible;

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
  mapping(uint256 _id => uint256) public _posRewardIndex;

  /// The ID of the next claim to be
  uint256 public nextCompensationId;
  mapping(uint256 _id => VirtualPool.Compensation)
    public _compensations;

  /// The token ID position data
  uint64 public nextPoolId;
  /// Maps a pool ID to the virtualized pool's storage
  mapping(uint64 _id => VirtualPool.VPool) private _pools;

  // ======= CONSTRUCTOR ======= //

  constructor(
    IAthenaPositionToken positionToken_,
    IAthenaCoverToken coverToken_,
    IStaking staking_,
    IFarmingRange farming_,
    IEcclesiaDao ecclesiaDao_,
    IStrategyManager strategyManager_,
    address claimManager_,
    uint256 withdrawDelay_,
    uint256 maxLeverage_,
    uint256 leverageFeePerPool_
  ) Ownable(msg.sender) {
    positionToken = positionToken_;
    coverToken = coverToken_;
    staking = staking_;
    farming = farming_;
    ecclesiaDao = ecclesiaDao_;
    strategyManager = strategyManager_;
    claimManager = claimManager_;

    withdrawDelay = withdrawDelay_;
    maxLeverage = maxLeverage_;
    leverageFeePerPool = leverageFeePerPool_;
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

  modifier onlyFarmingRange() {
    if (msg.sender != address(farming)) revert OnlyFarmingRange();
    _;
  }

  /// ======= VIEWS ======= ///

  function positions(
    uint256 tokenId_
  ) external view returns (Position memory) {
    return _positions[tokenId_];
  }

  function posRewardIndex(
    uint256 tokenId_
  ) internal view returns (uint256) {
    return _posRewardIndex[tokenId_];
  }

  function covers(
    uint256 tokenId_
  ) external view returns (CoverRead memory) {
    Cover storage cover = _covers[tokenId_];

    VirtualPool.CoverInfo memory info = _pools[cover.poolId]
      ._coverInfo(tokenId_);

    return
      CoverRead({
        coverId: tokenId_,
        poolId: cover.poolId,
        coverAmount: cover.coverAmount,
        premiums: cover.premiums,
        start: cover.start,
        end: cover.end,
        premiumsLeft: info.premiumsLeft,
        dailyCost: info.currentDailyCost,
        premiumRate: info.premiumRate
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

  function _getCompensation(
    uint256 compensationId_
  ) internal view returns (VirtualPool.Compensation storage) {
    return _compensations[compensationId_];
  }

  function poolInfo(
    uint64 poolId_
  ) external view returns (VirtualPool.VPoolRead memory) {
    VirtualPool.VPool storage pool = _pools[poolId_];

    return
      VirtualPool.VPoolRead({
        poolId: pool.poolId,
        feeRate: pool.feeRate,
        formula: pool.formula,
        slot0: pool.slot0,
        liquidityIndex: pool.liquidityIndex,
        strategyId: pool.strategyId,
        paymentAsset: pool.paymentAsset,
        underlyingAsset: pool.underlyingAsset,
        wrappedAsset: pool.wrappedAsset,
        isPaused: pool.isPaused,
        overlappedPools: pool.overlappedPools,
        compensationIds: pool.compensationIds
      });
  }

  function poolOverlaps(
    uint64 poolId0_,
    uint64 poolId1_
  ) external view returns (uint256) {
    return _pools[poolId0_].overlaps[poolId1_];
  }

  /// ======= POOLS ======= ///

  function createPool(
    address paymentAsset_,
    uint256 strategyId_,
    uint256 feeRate_, // Ray
    uint256 uOptimal_,
    uint256 r0_,
    uint256 rSlope1_,
    uint256 rSlope2_,
    uint64[] calldata compatiblePools_
  ) external onlyOwner {
    // Save pool ID to memory and update for next
    uint64 poolId = nextPoolId;
    nextPoolId++;

    (address underlyingAsset, address wrappedAsset) = strategyManager
      .assets(strategyId_);

    // Create virtual pool argument struct
    VirtualPool.VPoolConstructorParams memory args = VirtualPool
      .VPoolConstructorParams({
        poolId: poolId,
        dao: ecclesiaDao,
        strategyManager: strategyManager,
        strategyId: strategyId_,
        paymentAsset: paymentAsset_,
        underlyingAsset: underlyingAsset,
        wrappedAsset: wrappedAsset,
        feeRate: feeRate_, //Ray
        leverageFeePerPool: leverageFeePerPool, //Ray
        uOptimal: uOptimal_, //Ray
        r0: r0_, //Ray
        rSlope1: rSlope1_, //Ray
        rSlope2: rSlope2_, //Ray
        coverSize: coverSize,
        expireCover: _expireCover,
        getCompensation: _getCompensation,
        posRewardIndex: posRewardIndex
      });

    // Get storage pointer to pool
    VirtualPool.VPool storage pool = _pools[poolId];
    // Create virtual pool
    pool._vPoolConstructor(args);

    // Add compatible pools
    // @dev Registered both ways for safety
    uint256 nbPools = compatiblePools_.length;
    for (uint256 i; i < nbPools; i++) {
      uint64 compatiblePoolId = compatiblePools_[i];
      arePoolCompatible[poolId][compatiblePoolId] = true;
      arePoolCompatible[compatiblePoolId][poolId] = true;
    }
  }

  function purgeExpiredCovers(uint64 poolId_) external {
    // Clean pool from expired covers
    _pools[poolId_]._purgeExpiredCovers();
  }

  /// ======= COVER HELPERS ======= ///

  function _expireCover(uint256 tokenId) internal {
    _covers[tokenId].end = block.timestamp;
    // This will freeze the farming rewards of the cover
    farming.freezeExpiredCoverRewards(tokenId);
  }

  /// ======= BUY COVER ======= ///

  function buyCover(
    uint64 poolId_,
    uint256 coverAmount_,
    uint256 premiums_
  ) external {
    // Get storage pointer to pool
    VirtualPool.VPool storage pool = _pools[poolId_];

    // Clean pool from expired covers
    pool._purgeExpiredCovers();

    // Check if pool is currently paused
    if (pool.isPaused) revert PoolIsPaused();
    // Check if pool has enough liquidity
    if (pool.availableLiquidity() < coverAmount_)
      revert InsufficientLiquidityForCover();

    // Transfer premiums from user
    IERC20(pool.paymentAsset).safeTransferFrom(
      msg.sender,
      address(this),
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
    pool._buyCover(coverId, coverAmount_, premiums_);

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
    pool._purgeExpiredCovers();

    // Check if pool is currently paused
    if (pool.isPaused) revert PoolIsPaused();
    // Check if cover is expired
    if (cover.end != 0) revert CoverIsExpired();

    // Get the amount of premiums left
    uint256 premiums = pool._coverInfo(coverId_).premiumsLeft;
    uint256 coverAmount = cover.coverAmount;
    // Close the existing cover
    pool._closeCover(coverId_, coverAmount);

    // Only allow one operation on cover amount change
    if (0 < coverToAdd_) {
      /**
       * Check if pool has enough liquidity,
       * we closed cover at this point so check for total
       * */
      if (pool.availableLiquidity() < coverAmount + coverToAdd_)
        revert InsufficientLiquidityForCover();

      coverAmount += coverToAdd_;
    } else if (0 < coverToRemove_) {
      // User is allowed to set the cover amount to 0 to pause the cover
      coverAmount -= coverToRemove_;
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
        address(this),
        premiumsToAdd_
      );
      premiums += premiumsToAdd_;
    }

    // If no premiums left, then cover expires & should not be reopened
    if (premiums == 0) {
      cover.coverAmount = coverAmount;
      cover.end = block.timestamp;
    } else {
      // Update cover
      pool._buyCover(cover.poolId, coverAmount, premiums);
    }
  }

  /// ======= MAKE LP POSITION ======= ///

  /**
   *
   * @dev Positions created after claim creation & before compensation are affected by the claim
   */
  function createPosition(
    uint256 amount,
    bool isWrapped,
    uint64[] calldata poolIds
  ) external {
    // Check that the amount of pools is below the max leverage
    if (maxLeverage < poolIds.length)
      revert AmountOfPoolsIsAboveMaxLeverage();

    // Save new position tokenId and update for next
    uint256 tokenId = nextPositionId;
    nextPositionId++;

    // All pools share the same strategy so we can use the first pool ID
    uint256 strategyId = _pools[poolIds[0]].strategyId;
    uint256 amountUnderlying = isWrapped
      ? strategyManager.wrappedToUnderlying(strategyId, amount)
      : amount;

    // Save index from which the position will start accruing strategy rewards
    _posRewardIndex[tokenId] = strategyManager.getRewardIndex(
      strategyId
    );

    // Check pool compatibility & underlying token then register overlapping capital
    _addOverlappingCapitalAfterCheck(
      poolIds,
      tokenId,
      amountUnderlying
    );

    // Push funds to strategy manager
    if (isWrapped) {
      address wrappedAsset = _pools[poolIds[0]].wrappedAsset;
      IERC20(wrappedAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositWrappedToStrategy(strategyId);
    } else {
      address underlyingAsset = _pools[poolIds[0]].underlyingAsset;
      IERC20(underlyingAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositToStrategy(strategyId, amount);
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

    // Positions that are commit for withdrawal cannot be increased
    if (position.commitWithdrawalTimestamp != 0)
      revert CannotIncreaseIfCommittedWithdrawal();

    // Take interests in all pools before update
    // @dev Needed to keep register rewards & claims impact on capital
    _takeInterests(tokenId_, positionToken.ownerOf(tokenId_));

    uint256 amountUnderlying = isWrapped
      ? strategyManager.wrappedToUnderlying(strategyId, amount)
      : amount;

    // Check pool compatibility & underlying token then register overlapping capital
    _addOverlappingCapitalAfterCheck(
      position.poolIds,
      tokenId_,
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

      strategyManager.depositWrappedToStrategy(strategyId);
    } else {
      address underlyingAsset = _pools[position.poolIds[0]]
        .underlyingAsset;
      IERC20(underlyingAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositToStrategy(strategyId, amount);
    }

    position.supplied += amountUnderlying;
  }

  /// ======= TAKE LP INTERESTS ======= ///

  function _takeInterests(
    uint256 tokenId_,
    address coverRewardsBeneficiary_
  ) private {
    Position storage position = _positions[tokenId_];

    // Locks interests to avoid abusively early withdrawal commits
    if (position.commitWithdrawalTimestamp != 0)
      revert CannotTakeInterestsIfCommittedWithdrawal();

    address posOwner = positionToken.ownerOf(tokenId_);
    uint256 yieldBonus = staking.yieldBonusOf(posOwner);

    uint256 newUserCapital;
    uint256 strategyRewards;

    uint256 nbPools = position.poolIds.length;
    for (uint256 i; i < nbPools; i++) {
      VirtualPool.VPool storage pool = _pools[position.poolIds[i]];

      // Clean pool from expired covers
      pool._purgeExpiredCovers();

      // These are the same values at each iteration
      (newUserCapital, strategyRewards) = pool._takePoolInterests(
        tokenId_,
        coverRewardsBeneficiary_,
        position.supplied,
        yieldBonus,
        position.poolIds
      );
    }

    // All pools have same strategy since they are compatible
    uint256 strategyId = _pools[position.poolIds[0]].strategyId;
    // Withdraw interests from strategy
    strategyManager.withdrawFromStrategy(
      strategyId,
      0, // No capital withdrawn
      strategyRewards,
      posOwner, // Always paid out to owner
      yieldBonus
    );

    // Update the position capital to reflect potential reduction due to claims
    _positions[tokenId_].supplied = newUserCapital;
  }

  function takeInterests(
    uint256 tokenId_
  ) public onlyPositionOwner(tokenId_) {
    _takeInterests(tokenId_, positionToken.ownerOf(tokenId_));
  }

  /// ======= LP YIELD BONUS ======= ///

  function yieldBonusUpdate(
    uint256[] calldata tokenIds_
  ) external onlyFarmingRange {
    /**
     * // @bw Should take interests in all positions using the prev yield bonus -
     * called on bonus yield change in staking then to farming to get affected token ids of user.
     * Should change yield bonus AFTER tp
     * Should be ok with commit fee redirect since only uncommit positions can farm & farming is required to get the discount
     *  */
    address posOwner = positionToken.ownerOf(tokenIds_[0]);

    uint256 nbPositions = tokenIds_.length;
    for (uint256 i; i < nbPositions; i++) {
      _takeInterests(tokenIds_[i], posOwner);
    }
  }

  /// ======= CLOSE LP POSITION ======= ///

  function commitPositionWithdrawal(
    uint256 tokenId_
  ) external onlyPositionOwner(tokenId_) {
    Position storage position = _positions[tokenId_];

    // Take interests in all pools before withdrawal
    // @dev Any rewards accrued after this point will be send to the leverage risk wallet
    _takeInterests(tokenId_, positionToken.ownerOf(tokenId_));

    position.commitWithdrawalTimestamp = block.timestamp;
  }

  function uncommitPositionWithdrawal(
    uint256 tokenId_
  ) external onlyPositionOwner(tokenId_) {
    Position storage position = _positions[tokenId_];

    // Avoid users accidentally paying their rewards to the leverage risk wallet
    if (position.commitWithdrawalTimestamp == 0)
      revert PositionNotCommited();

    // Pool rewards after commit are paid in favor of the DAO's leverage risk wallet
    _takeInterests(tokenId_, address(ecclesiaDao));

    position.commitWithdrawalTimestamp = 0;
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
    uint256 yieldBonus = staking.yieldBonusOf(account);

    (
      uint256 capital,
      uint256 strategyRewards
    ) = _removeOverlappingCapital(
        tokenId_,
        position.supplied,
        position.poolIds
      );

    // All pools have same strategy since they are compatible
    if (capital != 0 || strategyRewards != 0) {
      uint256 strategyId = _pools[position.poolIds[0]].strategyId;
      if (keepWrapped_) {
        strategyManager.withdrawWrappedFromStrategy(
          strategyId,
          capital,
          strategyRewards,
          account,
          yieldBonus
        );
      } else {
        strategyManager.withdrawFromStrategy(
          strategyId,
          capital,
          strategyRewards,
          account,
          yieldBonus
        );
      }
    }

    // Reduce position to 0 since we cannot partial withdraw
    position.supplied = 0;
  }

  /// ======= LIQUIDITY CHANGES ======= ///

  // function _getUpdatedPositionInfo(
  //   uint256 tokenId_,
  //   address account_,
  //   uint256 amount_,
  //   uint64[] storage poolIds_
  // )
  //   private
  //   view
  //   returns (
  //     uint256 newUserCapital,
  //     uint256 strategyRewards,
  //     uint256[] memory poolRewards
  //   )
  // {
  //   // Manage before withdraw or take profit pool actions

  //   // This need to be updated in each pool
  //   // struct LpInfo {
  //   //   uint256 beginLiquidityIndex;
  //   //   uint256 beginClaimIndex;
  //   //   uint256 beginRewardIndex; // this can be deleted as shared
  //   // }
  //   // Manage after withdraw or take profit pool actions
  // }

  /// @dev Pool IDs must be checked to ensure they are unique and ascending
  function _addOverlappingCapitalAfterCheck(
    uint64[] memory poolIds_,
    uint256 tokenId_,
    uint256 amount_
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint256 i; i < nbPoolIds; i++) {
      uint64 poolId0 = poolIds_[i];
      VirtualPool.VPool storage pool0 = _pools[poolId0];

      // Check if pool is currently paused
      if (pool0.isPaused) revert PoolIsPaused();

      // Remove expired covers
      pool0._purgeExpiredCovers();

      // Add liquidity to the pools available liquidity
      pool0.overlaps[poolId0] += amount_;

      /**
       * Loops all pool combinations to check if they are compatible,
       * that they are in ascending order & that they are unique.
       * It then registers the overlapping capital.
       *
       * The loop starts at i + 1 to avoid redundant combinations.
       */
      for (uint256 j = i + 1; j < nbPoolIds; j++) {
        uint64 poolId1 = poolIds_[j];
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

      // Update premium rate, seconds per tick & LP position info
      pool0._depositToPool(tokenId_, amount_);
    }
  }

  // @dev poolIds have been checked at creation to ensure they are unique and ascending
  function _removeOverlappingCapital(
    uint256 tokenId_,
    uint256 amount_,
    uint64[] storage poolIds_
  ) internal returns (uint256 capital, uint256 rewards) {
    uint256 nbPoolIds = poolIds_.length;

    for (uint256 i; i < nbPoolIds; i++) {
      uint64 poolId0 = poolIds_[i];
      VirtualPool.VPool storage pool0 = _pools[poolId0];

      // Need to clean covers to avoid them causing a utilization overflow
      pool0._purgeExpiredCovers();

      // Remove liquidity
      (uint256 newUserCapital, uint256 strategyRewards) = pool0
        ._withdrawLiquidity(tokenId_, amount_, poolIds_);

      if (i == 0) {
        // The updated user capital & strategy rewards are the same at each iteration
        capital = newUserCapital;
        rewards = strategyRewards;
      }

      // Considering the verification that pool IDs are unique & ascending
      // then start index is i to reduce required number of loops
      for (uint256 j = i; j < nbPoolIds; j++) {
        uint64 poolId1 = poolIds_[j];
        pool0.overlaps[poolId1] -= newUserCapital;
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

  function attemptReopenCover(
    uint64 poolId,
    uint256 coverAmount,
    uint256 payoutAmount,
    uint256 premiums
  ) external {
    if (msg.sender != address(this)) {
      revert SenderNotLiquidationManager();
    } // this function should be called only by this contract
    _pools[poolId]._buyCover(
      poolId,
      coverAmount - payoutAmount,
      premiums
    );
  }

  // @bw opti - Store single claim in liqman with all liq index of dep pools. Check only from same pool id if single pool pos. Compute new cap & strat Rew & all Prem rew once and not for each pool.
  // check if RiskPool can deposit capital to cover the payouts if not enough liquidity
  function payoutClaim(
    uint256 coverId_,
    uint256 amount_
  ) external onlyClaimManager {
    uint64 poolId = _covers[coverId_].poolId;
    VirtualPool.VPool storage poolA = _pools[poolId];
    uint256 ratio = amount_.rayDiv(poolA.totalLiquidity());
    // The ration cannot be over 100% of the pool's liquidity (1 RAY)
    if (RayMath.RAY < ratio) revert RatioAbovePoolCapacity();

    // All pools have same strategy since they are compatible
    uint256 strategyId = _pools[poolA.overlappedPools[0]].strategyId;
    uint256 rewardIndex = strategyManager.getRewardIndex(strategyId);

    uint256 nbPools = poolA.overlappedPools.length;

    // Get compensation ID and its storage pointer
    uint256 compensationId = nextCompensationId;
    nextCompensationId++;
    VirtualPool.Compensation storage compensation = _compensations[
      compensationId
    ];
    // Register data common to all affected pools
    compensation.fromPoolId = poolId;
    compensation.ratio = ratio;
    compensation.rewardIndexBeforeClaim = rewardIndex;

    for (uint256 i; i < nbPools; i++) {
      uint64 poolIdB = poolA.overlappedPools[i];
      VirtualPool.VPool storage poolB = _pools[poolIdB];

      (VirtualPool.VPool storage pool0, uint64 poolId1) = poolId <
        poolIdB
        ? (poolA, poolIdB)
        : (poolB, poolId);

      // Skip if overlap is 0
      if (pool0.overlaps[poolId1] == 0) continue;
      // Update pool state & remove expired covers
      poolB._purgeExpiredCovers();

      // New context to avoid stack too deep error
      {
        // Remove liquidity from dependant pool
        uint256 amountToRemove = pool0.overlaps[poolId1].rayMul(
          ratio
        );

        // Skip if the amount to remove is 0
        if (amountToRemove == 0) continue;

        // Update pool pricing (premium rate & seconds per tick)
        poolB._syncLiquidity(0, amountToRemove);

        // Reduce available liquidity,
        // at i = 0 this is the self liquidity of cover's pool
        pool0.overlaps[poolId1] -= amountToRemove;
        // Only remove deps liquidity if the pool of the cover
        if (i != 0) {
          // Check all pool combinations to reduce overlapping capital
          for (uint64 j; j < nbPools; j++) {
            uint64 poolIdC = poolA.overlappedPools[j];
            if (poolIdC != poolId)
              if (poolIdB <= poolIdC) {
                poolB.overlaps[poolIdC] -= amountToRemove;
              }
          }
        }

        // Trade references to track reward indexes in single compensation struct
        poolB.compensationIds.push(compensationId);
        compensation.liquidityIndexBeforeClaim[poolIdB] = poolB
          .liquidityIndex;
      }
    }

    address claimant = coverToken.ownerOf(coverId_);

    {
      // Get storage pointer to cover
      Cover storage cover = _covers[coverId_];

      // If the cover isn't expired, then reduce the cover amount
      if (cover.end == 0) {
        // Get the amount of premiums left
        uint256 premiums = poolA._coverInfo(coverId_).premiumsLeft;
        // Close the existing cover
        poolA._closeCover(coverId_, cover.coverAmount);

        // Update cover
        try
          this.attemptReopenCover(
            poolId,
            cover.coverAmount,
            amount_,
            premiums
          )
        {} catch {
          // If updating the cover fails beacause of not enough liquidity,
          // then close the cover entirely & transfer premiums back to user
          IERC20(poolA.paymentAsset).safeTransfer(
            msg.sender,
            premiums
          );
          cover.end = block.timestamp;
        }
      }
    }

    strategyManager.payoutFromStrategy(strategyId, amount_, claimant);
  }

  /// ======= ADMIN ======= ///

  function updateConfig(
    uint256 withdrawDelay_,
    uint256 maxLeverage_
  ) external onlyOwner {
    withdrawDelay = withdrawDelay_;
    maxLeverage = maxLeverage_;
  }
}
