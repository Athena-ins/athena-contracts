// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// Libraries
import { RayMath } from "../libs/RayMath.sol";
import { TickBitmap } from "../libs/TickBitmap.sol";
import { PoolMath } from "../libs/PoolMath.sol";
import { DataTypes } from "../libs/DataTypes.sol";
import { IsContract } from "../libs/IsContract.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";

// ======= ERRORS ======= //

error ZeroAddressAsset();
error DurationBelowOneTick();
error DurationOverflow();
error InsufficientCapacity();
error NotEnoughLiquidityForRemoval();

/**
 * @title Athena Virtual Pool
 * @author vblackwhale
 *
 * This library provides the logic to create and manage virtual pools.
 * The pool storage is located in the Liquidity Manager contract.
 *
 * Definitions:
 *
 * Ticks:
 * They are a serie equidistant points in time who's distance from one another is variable.
 * The initial tick spacing is its maximum possible value of 86400 seconds or 1 day.
 * The distance between ticks will reduce as usage grows and increase when usage falls.
 * The change in distance represents the speed at which cover premiums are spent given the pool's usage.
 *
 * Core pool metrics are computed with the following flow:
 * Utilization Rate (ray %) -> Premium Rate (ray %) -> Daily Cost (token/day)
 */
library VirtualPool {
  // ======= LIBS ======= //
  using VirtualPool for DataTypes.VPool;
  using RayMath for uint256;
  using SafeERC20 for IERC20;
  using TickBitmap for mapping(uint24 => uint256);

  // ======= CONSTANTS ======= //

  bytes32 private constant POOL_SLOT_HASH =
    keccak256("diamond.storage.VPool");
  bytes32 private constant COMPENSATION_SLOT_HASH =
    keccak256("diamond.storage.Compensation");

  uint256 constant YEAR = 365 days;
  uint256 constant RAY = RayMath.RAY;
  uint256 constant MAX_SECONDS_PER_TICK = 1 days;
  uint256 constant FEE_BASE = RAY;
  uint256 constant PERCENTAGE_BASE = 100;
  uint256 constant HUNDRED_PERCENT = FEE_BASE * PERCENTAGE_BASE;

  // ======= STRUCTS ======= //

  struct CoverInfo {
    uint256 premiumsLeft;
    uint256 dailyCost;
    uint256 premiumRate;
    bool isActive;
  }

  struct UpdatePositionParams {
    uint256 currentLiquidityIndex;
    uint256 tokenId;
    uint256 userCapital;
    uint256 strategyRewardIndex;
    uint256 latestStrategyRewardIndex;
    uint256 strategyId;
    bool itCompounds;
    uint256 endCompensationIndex;
    uint256 nbPools;
  }

  struct UpdatedPositionInfo {
    uint256 newUserCapital;
    uint256 coverRewards;
    uint256 strategyRewards;
    DataTypes.LpInfo newLpInfo;
  }

  // ======= STORAGE GETTERS ======= //

  /**
   * @notice Returns the storage slot position of a pool.
   *
   * @param poolId_ The pool ID
   *
   * @return pool The storage slot position of the pool
   */
  function getPool(
    uint64 poolId_
  ) internal pure returns (DataTypes.VPool storage pool) {
    // Generate a random storage storage slot position based on the pool ID
    bytes32 storagePosition = keccak256(
      abi.encodePacked(POOL_SLOT_HASH, poolId_)
    );

    // Set the position of our struct in contract storage
    assembly {
      pool.slot := storagePosition
    }
  }

  /**
   * @notice Returns the storage slot position of a compensation.
   *
   * @param compensationId_ The compensation ID
   *
   * @return comp The storage slot position of the compensation
   *
   * @dev Enables VirtualPool library to access child compensation storage
   */
  function getCompensation(
    uint256 compensationId_
  ) internal pure returns (DataTypes.Compensation storage comp) {
    // Generate a random storage storage slot position based on the compensation ID
    bytes32 storagePosition = keccak256(
      abi.encodePacked(COMPENSATION_SLOT_HASH, compensationId_)
    );

    // Set the position of our struct in contract storage
    assembly {
      comp.slot := storagePosition
    }
  }

  // ======= VIRTUAL STORAGE INIT ======= //

  /**
   * @notice Initializes a virtual pool & populates its storage
   *
   * @param params The pool's constructor parameters
   */
  function _vPoolConstructor(
    DataTypes.VPoolConstructorParams memory params
  ) internal {
    DataTypes.VPool storage pool = VirtualPool.getPool(params.poolId);

    (address underlyingAsset, address wrappedAsset) = params
      .strategyManager
      .assets(params.strategyId);

    if (
      underlyingAsset == address(0) ||
      params.paymentAsset == address(0)
    ) {
      revert ZeroAddressAsset();
    }

    pool.poolId = params.poolId;
    pool.dao = params.dao;
    pool.strategyManager = params.strategyManager;
    pool.paymentAsset = params.paymentAsset;
    pool.strategyId = params.strategyId;
    pool.underlyingAsset = underlyingAsset;
    pool.wrappedAsset = wrappedAsset;
    pool.feeRate = params.feeRate;
    pool.leverageFeePerPool = params.leverageFeePerPool;

    pool.formula = PoolMath.Formula({
      uOptimal: params.uOptimal,
      r0: params.r0,
      rSlope1: params.rSlope1,
      rSlope2: params.rSlope2
    });

    /// @dev the initial tick spacing is its maximum value 86400 seconds
    pool.slot0.secondsPerTick = MAX_SECONDS_PER_TICK;
    pool.slot0.lastUpdateTimestamp = block.timestamp;
    /// @dev initialize at 1 to enable expiring covers created a first tick
    pool.slot0.tick = 1;

    pool.overlappedPools.push(params.poolId);
  }

  // ================================= //
  // ======= LIQUIDITY METHODS ======= //
  // ================================= //

  /**
   * @notice Returns the total liquidity of the pool.
   *
   * @param poolId_ The pool ID
   */
  function totalLiquidity(
    uint64 poolId_
  ) public view returns (uint256) {
    return getPool(poolId_).overlaps[poolId_];
  }

  /**
   * @notice Returns the available liquidity of the pool.
   *
   * @param poolId_ The pool ID
   */
  function availableLiquidity(
    uint64 poolId_
  ) public view returns (uint256) {
    DataTypes.VPool storage self = getPool(poolId_);

    /// @dev Since payout can lead to available capital underflow, we return 0
    if (totalLiquidity(poolId_) <= self.slot0.coveredCapital)
      return 0;

    return totalLiquidity(poolId_) - self.slot0.coveredCapital;
  }

  /**
   * @notice Computes an updated slot0 & liquidity index up to a timestamp.
   * These changes are virtual an not reflected in storage in this function.
   *
   * @param poolId_ The pool ID
   * @param timestamp_ The timestamp to update the slot0 & liquidity index to
   *
   * @return slot0 The updated slot0
   */
  function _refreshSlot0(
    uint64 poolId_,
    uint256 timestamp_
  ) public view returns (DataTypes.Slot0 memory slot0) {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    // Make copy in memory to allow for mutations
    slot0 = self.slot0;

    // The remaining time in seconds to run through to sync up to the timestamp
    uint256 remaining = timestamp_ - slot0.lastUpdateTimestamp;

    // If the remaining time is less than the tick spacing then return the slot0
    if (remaining < slot0.secondsPerTick) return slot0;

    uint256 utilization = PoolMath._utilization(
      slot0.coveredCapital,
      totalLiquidity(self.poolId)
    );
    uint256 premiumRate = PoolMath.getPremiumRate(
      self.formula,
      utilization
    );

    // Default to ignore remaining time in case we do not enter loop
    uint256 secondsSinceTickStart = remaining;
    uint256 secondsParsed;

    // @bw could opti here by searching for next initialized tick to compute the liquidity index with same premium & utilization in one go, parsing multiple 256 value bitmaps. This should exit when remaining < secondsToNextTickEnd before finishing with the partial tick operation.
    while (slot0.secondsPerTick <= remaining) {
      secondsSinceTickStart = 0;

      // Search for the next tick, either last in bitmap or next initialized
      (uint32 nextTick, bool isInitialized) = self
        .tickBitmap
        .nextTick(slot0.tick);

      uint256 secondsToNextTickEnd = slot0.secondsPerTick *
        (nextTick - slot0.tick);

      if (secondsToNextTickEnd <= remaining) {
        // Remove parsed tick size from remaining time to current timestamp
        remaining -= secondsToNextTickEnd;
        secondsParsed = secondsToNextTickEnd;

        slot0.liquidityIndex += PoolMath.computeLiquidityIndex(
          utilization,
          premiumRate,
          secondsParsed
        );

        // If the tick has covers then update pool metrics
        if (isInitialized) {
          (slot0, utilization, premiumRate) = self
            ._crossingInitializedTick(slot0, nextTick);
        }
        // Pool is now synched at the start of nextTick
        slot0.tick = nextTick;
      } else {
        /**
         * Time bewteen start of the new tick and the current timestamp
         * This is ignored since this is not enough for a full tick to be processed
         */
        secondsSinceTickStart = remaining % slot0.secondsPerTick;
        // Ignore interests of current uncompleted tick
        secondsParsed = remaining - secondsSinceTickStart;
        // Number of complete ticks that we can take into account
        slot0.tick += uint32(secondsParsed / slot0.secondsPerTick);
        // Exit loop after the liquidity index update
        remaining = 0;

        slot0.liquidityIndex += PoolMath.computeLiquidityIndex(
          utilization,
          premiumRate,
          secondsParsed
        );
      }
    }

    // Remove ignored duration so the update aligns with current tick start
    slot0.lastUpdateTimestamp = timestamp_ - secondsSinceTickStart;
  }

  /**
   * @notice Updates the pool's slot0 when the available liquidity changes.
   *
   * @param poolId_ The pool ID
   * @param liquidityToAdd_ The amount of liquidity to add
   * @param liquidityToRemove_ The amount of liquidity to remove
   * @param skipLimitCheck_ Whether to skip the available liquidity check
   *
   * @dev The skipLimitCheck_ is used for deposits & payouts
   */
  function _syncLiquidity(
    uint64 poolId_,
    uint256 liquidityToAdd_,
    uint256 liquidityToRemove_,
    bool skipLimitCheck_
  ) public {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    uint256 liquidity = totalLiquidity(self.poolId);
    uint256 available = availableLiquidity(self.poolId);

    // Skip liquidity check for deposits & payouts
    if (!skipLimitCheck_)
      if (available + liquidityToAdd_ < liquidityToRemove_)
        revert NotEnoughLiquidityForRemoval();

    // uint256 totalCovered = self.slot0.coveredCapital;
    uint256 newTotalLiquidity = (liquidity + liquidityToAdd_) -
      liquidityToRemove_;

    (, self.slot0.secondsPerTick, ) = PoolMath.updatePoolMarket(
      self.formula,
      self.slot0.secondsPerTick,
      liquidity,
      self.slot0.coveredCapital,
      newTotalLiquidity,
      self.slot0.coveredCapital
    );
  }

  // =================================== //
  // ======= COVERS & LP METHODS ======= //
  // =================================== //

  // ======= LIQUIDITY POSITIONS ======= //

  /**
   * @notice Adds liquidity info to the pool and updates the pool's state.
   *
   * @param poolId_ The pool ID
   * @param tokenId_ The LP position token ID
   * @param amount_ The amount of liquidity to deposit
   */
  function _depositToPool(
    uint64 poolId_,
    uint256 tokenId_,
    uint256 amount_
  ) external {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    // Skip liquidity check for deposits
    _syncLiquidity(poolId_, amount_, 0, true);

    // This sets the point from which the position earns rewards & is impacted by claims
    // also overwrites previous LpInfo after a withdrawal
    self.lpInfos[tokenId_] = DataTypes.LpInfo({
      beginLiquidityIndex: self.slot0.liquidityIndex,
      beginClaimIndex: self.compensationIds.length
    });
  }

  /**
   * @notice Pays the rewards and fees to the position owner and the DAO.
   *
   * @param poolId_ The pool ID
   * @param rewards_ The rewards to pay
   * @param account_ The account to pay the rewards to
   * @param yieldBonus_ The yield bonus to apply to the rewards
   * @param nbPools_ The number of pools in the position
   */
  function _payRewardsAndFees(
    uint64 poolId_,
    uint256 rewards_,
    address account_,
    uint256 yieldBonus_,
    uint256 nbPools_
  ) public {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    if (0 < rewards_) {
      uint256 fees = (rewards_ * self.feeRate) / HUNDRED_PERCENT;
      uint256 yieldBonus = (rewards_ *
        (HUNDRED_PERCENT - yieldBonus_)) / HUNDRED_PERCENT;

      uint256 netFees = fees == 0 || fees < yieldBonus
        ? 0
        : fees - yieldBonus;

      uint256 leverageFee;
      if (1 < nbPools_) {
        // The risk fee is only applied when using leverage
        // @dev The leverage fee is per pool so it starts at 2 * leverageFeePerPool
        leverageFee =
          (rewards_ * (self.leverageFeePerPool * nbPools_)) /
          HUNDRED_PERCENT;
      } else if (account_ == address(self.dao)) {
        // Take profits for the DAO accumulate the net in the leverage risk wallet
        leverageFee = rewards_ - netFees;
      }

      uint256 totalFees = netFees + leverageFee;
      // With insane leverage then the user could have a total fee rate above 100%
      uint256 net = rewards_ < totalFees ? 0 : rewards_ - totalFees;

      // Pay position owner
      // @bw would be better to move this up to liq man to pay all in one go
      if (net != 0) {
        IERC20(self.paymentAsset).safeTransfer(account_, net);
      }

      // Pay treasury & leverage risk wallet
      if (totalFees != 0) {
        IERC20(self.paymentAsset).safeTransfer(
          address(self.dao),
          totalFees
        );

        // This will register the revenue in the DAO for distribution
        if (IsContract._isContract(address(self.dao))) {
          self.dao.accrueRevenue(
            self.paymentAsset,
            netFees,
            leverageFee
          );
        }
      }
    }
  }

  /// -------- TAKE INTERESTS -------- ///

  /**
   * @notice Takes the interests of a position and updates the pool's state.
   *
   * @param poolId_ The pool ID
   * @param tokenId_ The LP position token ID
   * @param account_ The account to pay the rewards to
   * @param supplied_ The amount of liquidity to take interest on
   * @param yieldBonus_ The yield bonus to apply to the rewards
   * @param poolIds_ The pool IDs of the position
   *
   * @return newUserCapital The user's capital after claims
   * @return coverRewards The rewards earned from cover premiums
   *
   * @dev Need to update user capital & payout strategy rewards upon calling this function
   */
  function _takePoolInterests(
    uint64 poolId_,
    uint256 tokenId_,
    address account_,
    uint256 supplied_,
    uint256 strategyRewardIndex_,
    uint256 latestStrategyRewardIndex_,
    uint256 yieldBonus_,
    uint64[] storage poolIds_
  )
    external
    returns (uint256 /*newUserCapital*/, uint256 /*coverRewards*/)
  {
    if (supplied_ == 0) return (0, 0);

    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    // Get the updated position info
    UpdatedPositionInfo memory info = _getUpdatedPositionInfo(
      poolId_,
      poolIds_,
      UpdatePositionParams({
        currentLiquidityIndex: self.slot0.liquidityIndex,
        tokenId: tokenId_,
        userCapital: supplied_,
        strategyRewardIndex: strategyRewardIndex_,
        latestStrategyRewardIndex: latestStrategyRewardIndex_,
        strategyId: self.strategyId,
        itCompounds: self.strategyManager.itCompounds(
          self.strategyId
        ),
        endCompensationIndex: self.compensationIds.length,
        nbPools: poolIds_.length
      })
    );

    // Pay cover rewards and send fees to treasury
    _payRewardsAndFees(
      poolId_,
      info.coverRewards,
      account_,
      yieldBonus_,
      poolIds_.length
    );

    // Update lp info to reflect the new state of the position
    self.lpInfos[tokenId_] = info.newLpInfo;

    // Return the user's capital & strategy rewards for withdrawal
    return (info.newUserCapital, info.strategyRewards);
  }

  /// -------- WITHDRAW -------- ///

  /**
   * @notice Withdraws liquidity from the pool and updates the pool's state.
   *
   * @param poolId_ The pool ID
   * @param tokenId_ The LP position token ID
   * @param supplied_ The amount of liquidity to withdraw
   * @param poolIds_ The pool IDs of the position
   *
   * @return newUserCapital The user's capital after claims
   * @return strategyRewards The rewards earned by the strategy
   */
  function _withdrawLiquidity(
    uint64 poolId_,
    uint256 tokenId_,
    uint256 supplied_,
    uint256 amount_,
    uint256 strategyRewardIndex_,
    uint256 latestStrategyRewardIndex_,
    uint64[] storage poolIds_
  ) external returns (uint256, uint256) {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    // Get the updated position info
    UpdatedPositionInfo memory info = _getUpdatedPositionInfo(
      poolId_,
      poolIds_,
      UpdatePositionParams({
        currentLiquidityIndex: self.slot0.liquidityIndex,
        tokenId: tokenId_,
        userCapital: supplied_,
        strategyRewardIndex: strategyRewardIndex_,
        latestStrategyRewardIndex: latestStrategyRewardIndex_,
        strategyId: self.strategyId,
        itCompounds: self.strategyManager.itCompounds(
          self.strategyId
        ),
        endCompensationIndex: self.compensationIds.length,
        nbPools: poolIds_.length
      })
    );

    // Pool rewards after commit are paid in favor of the DAO's leverage risk wallet
    _payRewardsAndFees(
      poolId_,
      info.coverRewards,
      address(self.dao),
      0, // No yield bonus for the DAO
      poolIds_.length
    );

    // Update lp info to reflect the new state of the position
    self.lpInfos[tokenId_] = info.newLpInfo;

    // Update liquidity index
    _syncLiquidity(poolId_, 0, amount_, false);

    // Return the user's capital & strategy rewards for withdrawal
    return (info.newUserCapital, info.strategyRewards);
  }

  // ======= COVERS ======= //

  /// -------- BUY -------- ///

  /**
   * @notice Registers a premium position for a cover,
   * it also initializes the last tick (expiration tick) of the cover is needed.
   *
   * @param self The pool
   * @param coverId_ The cover ID
   * @param beginPremiumRate_ The premium rate at the beginning of the cover
   * @param lastTick_ The last tick of the cover
   */
  function _addPremiumPosition(
    DataTypes.VPool storage self,
    uint256 coverId_,
    uint256 coverAmount_,
    uint256 beginPremiumRate_,
    uint32 lastTick_
  ) internal {
    self.ticks[lastTick_] += coverAmount_;

    self.covers[coverId_] = DataTypes.Cover({
      coverAmount: coverAmount_,
      beginPremiumRate: beginPremiumRate_,
      lastTick: lastTick_
    });

    /**
     * If the tick at which the cover expires is not initialized then initialize it
     * this indicates that the tick is not empty and has covers that expire
     */
    if (!self.tickBitmap.isInitializedTick(lastTick_)) {
      self.tickBitmap.flipTick(lastTick_);
    }
  }

  /**
   * @notice Registers a premium position of a cover and updates the pool's slot0.
   *
   * @param poolId_ The pool ID
   * @param coverId_ The cover ID
   * @param coverAmount_ The amount of cover to buy
   * @param premiums_ The amount of premiums deposited
   */
  function _registerCover(
    uint64 poolId_,
    uint256 coverId_,
    uint256 coverAmount_,
    uint256 premiums_
  ) external {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    // @bw could compute amount of time lost to rounding and conseqentially the amount of premiums lost, then register them to be able to harvest them / redistrib them
    uint256 available = availableLiquidity(self.poolId);

    /**
     * Check if pool has enough liquidity, when updating a cover
     * we closed the previous cover at this point so check for total
     * */
    if (available < coverAmount_) revert InsufficientCapacity();

    uint256 liquidity = totalLiquidity(self.poolId);

    (uint256 newPremiumRate, uint256 newSecondsPerTick, ) = PoolMath
      .updatePoolMarket(
        self.formula,
        self.slot0.secondsPerTick,
        liquidity,
        self.slot0.coveredCapital,
        liquidity,
        self.slot0.coveredCapital + coverAmount_
      );

    uint256 durationInSeconds = (premiums_ * YEAR * PERCENTAGE_BASE)
      .rayDiv(newPremiumRate) / coverAmount_;

    if (durationInSeconds < newSecondsPerTick)
      revert DurationBelowOneTick();

    /**
     * @dev The user can loose up to almost 1 tick of cover due to the floored division
     * The user can also win up to almost 1 tick of cover if it is opened at the start of a tick
     */
    uint256 tickDuration = durationInSeconds / newSecondsPerTick;
    // Check for overflow in case the cover amount is very low
    if (type(uint32).max < tickDuration) revert DurationOverflow();

    uint32 lastTick = self.slot0.tick + uint32(tickDuration);

    self._addPremiumPosition(
      coverId_,
      coverAmount_,
      newPremiumRate,
      lastTick
    );

    self.slot0.coveredCapital += coverAmount_;
    self.slot0.secondsPerTick = newSecondsPerTick;
  }

  /// -------- CLOSE -------- ///

  /**
   * @notice Closes a cover and updates the pool's slot0.
   *
   * @param poolId_ The pool ID
   * @param coverId_ The cover ID
   */
  function _closeCover(uint64 poolId_, uint256 coverId_) external {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    DataTypes.Cover memory cover = self.covers[coverId_];

    // Remove cover amount from the tick at which it expires
    uint256 coverAmount = cover.coverAmount;
    self.ticks[cover.lastTick] -= coverAmount;

    // If there is no more cover in the tick then flip it to uninitialized
    if (self.ticks[cover.lastTick] == 0) {
      self.tickBitmap.flipTick(cover.lastTick);
    }

    uint256 liquidity = totalLiquidity(self.poolId);

    (, self.slot0.secondsPerTick, ) = PoolMath.updatePoolMarket(
      self.formula,
      self.slot0.secondsPerTick,
      liquidity,
      self.slot0.coveredCapital,
      liquidity,
      self.slot0.coveredCapital - coverAmount
    );

    self.slot0.coveredCapital -= coverAmount;

    // @dev We remove 1 since the covers expire at the end of the tick
    self.covers[coverId_].lastTick = self.slot0.tick - 1;
  }

  // ======= INTERNAL POOL HELPERS ======= //

  /**
   * @notice Purges expired covers from the pool and updates the pool's slot0 up to the latest timestamp
   *
   * @param poolId_ The pool ID
   *
   * @dev function _purgeExpiredCoversUpTo
   */
  function _purgeExpiredCovers(uint64 poolId_) external {
    _purgeExpiredCoversUpTo(poolId_, block.timestamp);
  }

  /**
   * @notice Removes expired covers from the pool and updates the pool's slot0.
   * Required before any operation that requires the slot0 to be up to date.
   * This includes all position and cover operations.
   *
   * @param poolId_ The pool ID
   */
  function _purgeExpiredCoversUpTo(
    uint64 poolId_,
    uint256 timestamp_
  ) public {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);
    self.slot0 = _refreshSlot0(poolId_, timestamp_);
  }

  // ======= VIEW HELPERS ======= //

  /**
   * @notice Checks if a cover is active or if it has expired or been closed
   * @dev The user is protected during lastTick but the cover cannot be updated
   *
   * @param poolId_ The pool ID
   * @param coverId_ The cover ID
   *
   * @return Whether the cover is active
   */
  function _isCoverActive(
    uint64 poolId_,
    uint256 coverId_
  ) external view returns (bool) {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    return self.slot0.tick < self.covers[coverId_].lastTick;
  }

  /**
   * @notice Computes the cover and strategy rewards for an LP position.
   *
   * @param self The pool
   * @param info The updated position information
   * @param coverRewards The current rewards earned from cover premiums
   * @param strategyRewards The current rewards earned by the strategy
   * @param strategyId The strategy ID
   * @param itCompounds Whether the strategy compounds
   * @param endliquidityIndex The end liquidity index
   * @param startStrategyRewardIndex The start strategy reward index
   * @param endStrategyRewardIndex The end strategy reward index
   *
   * @return coverRewards The aggregated rewards earned from cover premiums
   * @return strategyRewards The aggregated rewards earned by the strategy
   */
  function computePositionRewards(
    DataTypes.VPool storage self,
    UpdatedPositionInfo memory info,
    uint256 coverRewards,
    uint256 strategyRewards,
    uint256 strategyId,
    bool itCompounds,
    uint256 endliquidityIndex,
    uint256 startStrategyRewardIndex,
    uint256 endStrategyRewardIndex
  )
    internal
    view
    returns (
      uint256 /* coverRewards */,
      uint256 /* strategyRewards */
    )
  {
    coverRewards += PoolMath.getCoverRewards(
      info.newUserCapital,
      info.newLpInfo.beginLiquidityIndex,
      endliquidityIndex
    );

    strategyRewards += self.strategyManager.computeReward(
      strategyId,
      // If strategy compounds then add to capital to compute next new rewards
      itCompounds
        ? info.newUserCapital + info.strategyRewards
        : info.newUserCapital,
      startStrategyRewardIndex,
      endStrategyRewardIndex
    );

    return (coverRewards, strategyRewards);
  }

  /**
   * @notice Computes the state changes of an LP position,
   * it aggregates the fees earned by the position and
   * computes the losses incurred by the claims in this pool.
   *
   * @param poolId_ The pool ID
   * @param poolIds_ The pool IDs of the position
   * @param params The update position parameters
   * - currentLiquidityIndex_ The current liquidity index
   * - tokenId_ The LP position token ID
   * - userCapital_ The user's capital
   * - strategyRewardIndex_ The strategy reward index
   * - latestStrategyRewardIndex_ The latest strategy reward index
   *
   * @return info Updated information about the position:
   * - newUserCapital The user's capital after claims
   * - coverRewards The rewards earned from cover premiums
   * - strategyRewards The rewards earned by the strategy
   * - newLpInfo The updated LpInfo of the position
   *
   * @dev Used for takeInterest, withdrawLiquidity and rewardsOf
   */
  function _getUpdatedPositionInfo(
    uint64 poolId_,
    uint64[] storage poolIds_,
    UpdatePositionParams memory params
  ) public view returns (UpdatedPositionInfo memory info) {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    // Make copy of current LP info state for position
    info.newLpInfo = self.lpInfos[params.tokenId];
    info.newUserCapital = params.userCapital;

    // This index is not bubbled up in info because it is updated by the LiquidityManager
    // @dev Left unitilized because _processCompensationsForPosition will update it event with no compensations
    uint256 upToStrategyRewardIndex;

    (
      info,
      upToStrategyRewardIndex
    ) = _processCompensationsForPosition(poolId_, poolIds_, params);

    /**
     * Finally add the rewards from the last claim or update to the current block
     * & register latest reward & claim indexes
     */
    (info.coverRewards, info.strategyRewards) = self
      .computePositionRewards(
        info,
        info.coverRewards,
        info.strategyRewards,
        params.strategyId,
        params.itCompounds,
        params.currentLiquidityIndex,
        upToStrategyRewardIndex,
        params.latestStrategyRewardIndex
      );

    // Register up to where the position has been updated
    // @dev
    info.newLpInfo.beginLiquidityIndex = params.currentLiquidityIndex;
    info.newLpInfo.beginClaimIndex = params.endCompensationIndex;
  }

  /**
   * @notice Updates the capital in an LP position post compensation payouts.
   *
   * @param poolId_ The pool ID
   * @param poolIds_ The pool IDs of the position
   * @param params The update position parameters
   *
   * @return info Updated information about the position:
   * @return upToStrategyRewardIndex The latest strategy reward index
   */
  function _processCompensationsForPosition(
    uint64 poolId_,
    uint64[] storage poolIds_,
    UpdatePositionParams memory params
  )
    public
    view
    returns (
      UpdatedPositionInfo memory info,
      uint256 upToStrategyRewardIndex
    )
  {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    info.newLpInfo = self.lpInfos[params.tokenId];
    info.newUserCapital = params.userCapital;

    // This index is not bubbled up in info because it is updated by the LiquidityManager
    upToStrategyRewardIndex = params.strategyRewardIndex;
    uint256 compensationIndex = info.newLpInfo.beginClaimIndex;

    /**
     * Parse each claim that may affect capital due to overlap in order to
     * compute rewards on post compensation capital
     */
    for (
      compensationIndex;
      compensationIndex < params.endCompensationIndex;
      compensationIndex++
    ) {
      DataTypes.Compensation storage comp = getCompensation(
        self.compensationIds[compensationIndex]
      );

      // For each pool in the position
      for (uint256 j; j < params.nbPools; j++) {
        // Skip if the comp is not incoming from one of the pools in the position
        if (poolIds_[j] != comp.fromPoolId) continue;

        // We want the liquidity index of this pool at the time of the claim
        uint256 liquidityIndexBeforeClaim = comp
          .liquidityIndexBeforeClaim[self.poolId];

        // Compute the rewards accumulated up to the claim
        (info.coverRewards, info.strategyRewards) = self
          .computePositionRewards(
            info,
            info.coverRewards,
            info.strategyRewards,
            params.strategyId,
            params.itCompounds,
            liquidityIndexBeforeClaim,
            upToStrategyRewardIndex,
            comp.strategyRewardIndexBeforeClaim
          );

        info
          .newLpInfo
          .beginLiquidityIndex = liquidityIndexBeforeClaim;
        // Reduce capital after the comp
        info.newUserCapital -= info.newUserCapital.rayMul(comp.ratio);

        // Register up to where the rewards have been accumulated
        upToStrategyRewardIndex = comp.strategyRewardIndexBeforeClaim;

        break;
      }
    }

    // Register up to where the position has been updated
    info.newLpInfo.beginClaimIndex = params.endCompensationIndex;
  }

  /**
   * @notice Computes the updated state of a cover.
   *
   * @param poolId_ The pool ID
   * @param coverId_ The cover ID
   *
   * @return info The cover data
   */
  function _computeRefreshedCoverInfo(
    uint64 poolId_,
    uint256 coverId_
  ) external view returns (CoverInfo memory info) {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    return
      self._computeCoverInfo(
        coverId_,
        // For reads we sync the slot0 to the current timestamp to have latests data
        _refreshSlot0(poolId_, block.timestamp)
      );
  }

  /**
   * @notice Returns the current state of a cover.
   *
   * @param poolId_ The pool ID
   * @param coverId_ The cover ID
   *
   * @return info The cover data
   */
  function _computeCurrentCoverInfo(
    uint64 poolId_,
    uint256 coverId_
  ) external view returns (CoverInfo memory info) {
    DataTypes.VPool storage self = VirtualPool.getPool(poolId_);

    return self._computeCoverInfo(coverId_, self.slot0);
  }

  /**
   * @notice Computes the premium rate & daily cost of a cover,
   * this parses the pool's ticks to compute how much premiums are left and
   * what is the daily cost of keeping the cover openened.
   *
   * @param self The pool
   * @param coverId_ The cover ID
   *
   * @return info A struct containing the cover's premium rate & the cover's daily cost
   */
  function _computeCoverInfo(
    DataTypes.VPool storage self,
    uint256 coverId_,
    DataTypes.Slot0 memory slot0_
  ) internal view returns (CoverInfo memory info) {
    DataTypes.Cover storage cover = self.covers[coverId_];

    /**
     * If the cover's last tick is overtaken then it's expired & no premiums are left.
     * Return default 0 / false values in the returned struct.
     */
    if (cover.lastTick < slot0_.tick) return info;

    info.isActive = true;

    info.premiumRate = PoolMath.getPremiumRate(
      self.formula,
      PoolMath._utilization(
        slot0_.coveredCapital,
        totalLiquidity(self.poolId)
      )
    );

    /// @dev Skip division by premium rate PERCENTAGE_BASE for precision
    uint256 beginDailyCost = cover
      .coverAmount
      .rayMul(cover.beginPremiumRate)
      .rayDiv(365);
    info.dailyCost = PoolMath.getDailyCost(
      beginDailyCost,
      cover.beginPremiumRate,
      info.premiumRate
    );

    uint256 nbTicksLeft = cover.lastTick - slot0_.tick;
    // Duration in seconds between currentTick & minNextTick
    uint256 duration = nbTicksLeft * slot0_.secondsPerTick;

    /// @dev Unscale amount by PERCENTAGE_BASE & RAY
    info.premiumsLeft =
      (duration * info.dailyCost) /
      (1 days * PERCENTAGE_BASE * RAY);
    /// @dev Unscale amount by PERCENTAGE_BASE & RAY
    info.dailyCost = info.dailyCost / (PERCENTAGE_BASE * RAY);
  }

  /**
   * @notice Mutates a slot0 to reflect states changes upon crossing an initialized tick.
   * The covers crossed tick are expired and the pool's liquidity is updated.
   *
   * @dev It must be mutative so it can be used by read & write fns.
   *
   * @param self The pool
   * @param slot0_ The slot0 to mutate
   * @param tick_ The tick to cross
   *
   * @return The mutated slot0
   */
  function _crossingInitializedTick(
    DataTypes.VPool storage self,
    DataTypes.Slot0 memory slot0_,
    uint32 tick_
  )
    internal
    view
    returns (
      DataTypes.Slot0 memory /* slot0_ */,
      uint256 utilization,
      uint256 premiumRate
    )
  {
    uint256 liquidity = totalLiquidity(self.poolId);
    // Remove expired cover amount from the pool's covered capital
    uint256 newCoveredCapital = slot0_.coveredCapital -
      self.ticks[tick_];

    (premiumRate, slot0_.secondsPerTick, utilization) = PoolMath
      .updatePoolMarket(
        self.formula,
        self.slot0.secondsPerTick,
        liquidity,
        self.slot0.coveredCapital,
        liquidity,
        newCoveredCapital
      );

    // Remove expired cover amount from the pool's covered capital
    slot0_.coveredCapital = newCoveredCapital;

    return (slot0_, utilization, premiumRate);
  }
}
