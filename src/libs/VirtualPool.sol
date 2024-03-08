// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

// Libraries
import { RayMath } from "../libs/RayMath.sol";
import { Tick } from "../libs/Tick.sol";
import { TickBitmap } from "../libs/TickBitmap.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";

import { console } from "hardhat/console.sol";

// ======= ERRORS ======= //

error ZeroAddressAsset();
error CoverAlreadyExpired();
error DurationTooLow();
error InsufficientCapacity();
error NotEnoughLiquidityForRemoval();

/**
 * @title Athena Virtual Pool
 * @author vblackwhale
 *
 * Definitions:
 *
 * Ticks:
 * They are a serie equidistant points in time who's distance from one another is variable.
 * Initially the tick after the first tick is at a distance of 86400 seconds (1 day), its maximum amount.
 * The distance between ticks will reduce as usage grows and increase when usage falls.
 * The change in distance represents the change in premium cost of cover time in relation to usage.
 *
 * Core pool states are computed with the following flow:
 * Utilization Rate (ray %) -> Premium Rate (ray %) -> Daily Cost (token/day)
 */
library VirtualPool {
  using VirtualPool for VPool;
  using RayMath for uint256;
  using SafeERC20 for IERC20;
  using Tick for mapping(uint32 => uint256[]);
  using TickBitmap for mapping(uint24 => uint256);

  // ======= CONSTANTS ======= //

  uint256 constant YEAR = 365 days;
  uint256 constant RAY = RayMath.RAY;
  uint256 constant MAX_SECONDS_PER_TICK = 1 days;
  uint256 constant FEE_BASE = RAY;
  uint256 constant PERCENTAGE_BASE = 100;
  uint256 constant FULL_CAPACITY = PERCENTAGE_BASE * RAY;

  // ======= STRUCTS ======= //

  struct Formula {
    uint256 uOptimal;
    uint256 r0;
    uint256 rSlope1;
    uint256 rSlope2;
  }

  struct Slot0 {
    uint32 tick; // The last tick at which the pool's liquidity was updated
    uint256 secondsPerTick; // The distance in seconds between ticks
    uint256 coveredCapital;
    uint256 remainingCovers;
    // The last timestamp at which the current tick changed
    uint256 lastUpdateTimestamp;
    // The index tracking how much premiums have been consumed in favor of LP
    uint256 liquidityIndex;
    // The amount of liquidity index that is in the current unfinished tick
    uint256 liquidityIndexLead;
  }

  struct LpInfo {
    uint256 beginLiquidityIndex;
    uint256 beginClaimIndex;
  }

  struct CoverPremiums {
    uint256 beginPremiumRate;
    uint32 lastTick; // The tick at which the cover will expire
    uint224 coverIdIndex; // CoverId index in its initalization tick's cover array
  }

  struct CoverInfo {
    uint256 premiumsLeft;
    uint256 currentDailyCost;
    uint256 premiumRate;
  }

  struct Compensation {
    uint64 fromPoolId;
    uint256 ratio;
    uint256 strategyRewardIndexBeforeClaim;
    mapping(uint64 _poolId => uint256 _amount) liquidityIndexBeforeClaim;
  }

  struct UpdatePositionParams {
    uint256 currentLiquidityIndex;
    uint256 tokenId;
    uint256 userCapital;
    uint256 strategyRewardIndex;
    uint256 latestStrategyRewardIndex;
  }

  struct UpdatedPositionInfo {
    uint256 newUserCapital;
    uint256 coverRewards;
    uint256 strategyRewards;
    LpInfo newLpInfo;
  }

  // ======= VIRTUAL STORAGE ======= //

  struct VPool {
    uint64 poolId;
    uint256 feeRate; // amount of fees on premiums in RAY
    uint256 leverageFeePerPool; // amount of fees per pool when using leverage
    IEcclesiaDao dao;
    IStrategyManager strategyManager;
    Formula formula;
    Slot0 slot0;
    uint256 strategyId;
    address paymentAsset; // asset used to pay LP premiums
    address underlyingAsset; // asset covered & used by the strategy
    address wrappedAsset; // tokenised strategy shares (ex: aTokens)
    bool isPaused;
    uint64[] overlappedPools;
    uint256 ongoingClaims;
    uint256[] compensationIds;
    /// @dev poolId 0 -> poolId 0 points to a pool's own liquidity
    /// @dev liquidity overlap is always registered in the lower poolId
    // Maps poolId 0 -> poolId 1 -> overlapping capital
    mapping(uint64 _poolId => uint256 _amount) overlaps;
    mapping(uint256 _positionId => LpInfo) lpInfos;
    mapping(uint24 _wordPos => uint256 _bitmap) tickBitmap;
    // Maps a tick to the list of cover IDs
    mapping(uint32 _tick => uint256[] _coverIds) ticks;
    // Maps a cover ID to the premium position of the cover
    mapping(uint256 _coverId => CoverPremiums) coverPremiums;
    // Function pointers to access child contract data
    function(uint256)
      view
      returns (Compensation storage) getCompensation;
    function(uint256) view returns (uint256) coverSize;
    function(uint256) expireCover;
  }

  // ======= VIRTUAL CONSTRUCTOR ======= //

  struct VPoolConstructorParams {
    uint64 poolId;
    IEcclesiaDao dao;
    IStrategyManager strategyManager;
    uint256 strategyId;
    address paymentAsset;
    address underlyingAsset;
    address wrappedAsset;
    uint256 feeRate; //Ray
    uint256 leverageFeePerPool; //Ray
    uint256 uOptimal; //Ray
    uint256 r0; //Ray
    uint256 rSlope1; //Ray
    uint256 rSlope2; //Ray
    // Function pointer to child contract data
    function(uint256)
      view
      returns (Compensation storage) getCompensation;
    function(uint256) view returns (uint256) coverSize;
    function(uint256) expireCover;
  }

  /**
   * @notice Initializes a virtual pool & populates its storage
   * @param self The pool
   * @param params The pool's constructor parameters
   */
  function _vPoolConstructor(
    VPool storage self,
    VPoolConstructorParams memory params
  ) internal {
    if (
      params.underlyingAsset == address(0) ||
      params.paymentAsset == address(0)
    ) {
      revert ZeroAddressAsset();
    }

    self.poolId = params.poolId;
    self.dao = params.dao;
    self.strategyManager = params.strategyManager;
    self.paymentAsset = params.paymentAsset;
    self.strategyId = params.strategyId;
    self.underlyingAsset = params.underlyingAsset;
    self.wrappedAsset = params.wrappedAsset;
    self.feeRate = params.feeRate;
    self.leverageFeePerPool = params.leverageFeePerPool;

    self.formula = Formula({
      uOptimal: params.uOptimal,
      r0: params.r0,
      rSlope1: params.rSlope1,
      rSlope2: params.rSlope2
    });

    /// @dev the initial tick spacing is its maximum value 86400 seconds
    self.slot0.secondsPerTick = MAX_SECONDS_PER_TICK;
    self.slot0.lastUpdateTimestamp = block.timestamp;

    self.overlappedPools.push(params.poolId);

    self.coverSize = params.coverSize;
    self.expireCover = params.expireCover;
    self.getCompensation = params.getCompensation;
  }

  // ======= EVENTS ======= //

  event TakeInterest(
    uint256 tokenId,
    uint256 userCapital,
    uint256 rewardsGross,
    uint256 rewardsNet,
    uint256 fee
  );

  event WithdrawLiquidity(
    uint256 tokenId,
    uint256 capital,
    uint256 rewardsGross,
    uint256 rewardsNet,
    uint256 fee
  );

  // ======= READ METHODS ======= //

  /**
   * @notice Returns the total liquidity of the pool
   * @param self The pool
   */
  function totalLiquidity(
    VPool storage self
  ) internal view returns (uint256) {
    return self.overlaps[self.poolId];
  }

  /**
   * @notice Returns the available liquidity of the pool
   * @param self The pool
   */
  function availableLiquidity(
    VPool storage self
  ) internal view returns (uint256) {
    /// @dev Since payout can lead to available capital underflow, we return 0
    if (self.totalLiquidity() <= self.slot0.coveredCapital) return 0;

    return self.totalLiquidity() - self.slot0.coveredCapital;
  }

  // ======= LIQUIDITY ======= //

  /**
   * @notice Adds liquidity info to the pool and updates the pool's state.
   * @param self The pool
   * @param tokenId_ The LP position token ID
   * @param amount_ The amount of liquidity to deposit
   */
  function _depositToPool(
    VPool storage self,
    uint256 tokenId_,
    uint256 amount_
  ) internal {
    // Skip liquidity check for deposits
    self._syncLiquidity(amount_, 0, true);

    // This sets the point from which the position earns rewards & is impacted by claims
    // also overwrites previous LpInfo after a withdrawal
    self.lpInfos[tokenId_] = LpInfo({
      beginLiquidityIndex: self.slot0.liquidityIndex,
      beginClaimIndex: self.compensationIds.length
    });
  }

  /**
   * @notice Pays the rewards and fees to the position owner and the DAO.
   * @param self The pool
   * @param rewards_ The rewards to pay
   * @param account_ The account to pay the rewards to
   * @param yieldBonus_ The yield bonus to apply to the rewards
   * @param nbPools_ The number of pools in the position
   */
  function _payRewardsAndFees(
    VPool storage self,
    uint256 rewards_,
    address account_,
    uint256 yieldBonus_,
    uint256 nbPools_
  ) internal {
    if (0 < rewards_) {
      uint256 fees = ((rewards_ *
        self.feeRate *
        (FEE_BASE - yieldBonus_)) / FEE_BASE) / FEE_BASE;

      uint256 leverageFee;
      if (1 < nbPools_) {
        // The risk fee is only applied when using leverage
        leverageFee =
          (rewards_ * (self.leverageFeePerPool * nbPools_)) /
          FEE_BASE;
      } else if (account_ == address(self.dao)) {
        // Take profits for the DAO accumulate the net in the leverage risk wallet
        leverageFee = rewards_ - fees;
      }

      uint256 totalFees = fees + leverageFee;
      uint256 net = rewards_ - totalFees;

      // Pay position owner
      if (net != 0) {
        IERC20(self.paymentAsset).safeTransfer(account_, net);
      }

      // Pay treasury & leverage risk wallet
      if (totalFees != 0) {
        IERC20(self.paymentAsset).safeTransfer(
          address(self.dao),
          totalFees
        );

        self.dao.accrueRevenue(self.paymentAsset, fees, leverageFee);
      }
    }
  }

  /// -------- TAKE INTERESTS -------- ///

  /**
   * @notice Takes the interests of a position and updates the pool's state.
   * @param self The pool
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
    VPool storage self,
    uint256 tokenId_,
    address account_,
    uint256 supplied_,
    uint256 strategyRewardIndex_,
    uint256 latestStrategyRewardIndex_,
    uint256 yieldBonus_,
    uint64[] storage poolIds_
  ) internal returns (uint256, uint256) {
    // Get the updated position info
    UpdatedPositionInfo memory info = self._getUpdatedPositionInfo(
      poolIds_,
      UpdatePositionParams({
        currentLiquidityIndex: self.slot0.liquidityIndex,
        tokenId: tokenId_,
        userCapital: supplied_,
        strategyRewardIndex: strategyRewardIndex_,
        latestStrategyRewardIndex: latestStrategyRewardIndex_
      })
    );

    // Pay cover rewards and send fees to treasury
    self._payRewardsAndFees(
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
   * @param self The pool
   * @param tokenId_ The LP position token ID
   * @param supplied_ The amount of liquidity to withdraw
   * @param poolIds_ The pool IDs of the position
   *
   * @return newUserCapital The user's capital after claims
   * @return strategyRewards The rewards earned by the strategy
   */
  function _withdrawLiquidity(
    VPool storage self,
    uint256 tokenId_,
    uint256 supplied_,
    uint256 amount_,
    uint256 strategyRewardIndex_,
    uint256 latestStrategyRewardIndex_,
    uint64[] storage poolIds_
  ) internal returns (uint256, uint256) {
    // Get the updated position info
    UpdatedPositionInfo memory info = self._getUpdatedPositionInfo(
      poolIds_,
      UpdatePositionParams({
        currentLiquidityIndex: self.slot0.liquidityIndex,
        tokenId: tokenId_,
        userCapital: supplied_,
        strategyRewardIndex: strategyRewardIndex_,
        latestStrategyRewardIndex: latestStrategyRewardIndex_
      })
    );

    // Pool rewards after commit are paid in favor of the DAO's leverage risk wallet
    self._payRewardsAndFees(
      info.coverRewards,
      address(self.dao),
      0, // No yield bonus for the DAO
      poolIds_.length
    );

    // Update lp info to reflect the new state of the position
    self.lpInfos[tokenId_] = info.newLpInfo;

    // Update liquidity index
    self._syncLiquidity(0, amount_, false);

    // Return the user's capital & strategy rewards for withdrawal
    return (info.newUserCapital, info.strategyRewards);
  }

  // ======= COVERS ======= //

  /// -------- BUY -------- ///

  /**
   * @notice Registers a premium position for a cover,
   * it also initializes the last tick (expiration tick) of the cover is needed.
   * @param self The pool
   * @param coverId_ The cover ID
   * @param beginPremiumRate_ The premium rate at the beginning of the cover
   * @param lastTick_ The last tick of the cover
   */
  function _addPremiumPosition(
    VPool storage self,
    uint256 coverId_,
    uint256 beginPremiumRate_,
    uint32 lastTick_
  ) internal {
    uint224 nbCoversInTick = self.ticks.addCoverId(
      coverId_,
      lastTick_
    );

    self.coverPremiums[coverId_] = CoverPremiums({
      beginPremiumRate: beginPremiumRate_,
      lastTick: lastTick_,
      coverIdIndex: nbCoversInTick
    });

    /**
     * If the tick at which the cover expires is not initialized then initialize it
     * this indicates that the tick has covers and is not empty
     */
    if (!self.tickBitmap.isInitializedTick(lastTick_)) {
      self.tickBitmap.flipTick(lastTick_);
    }
  }

  /**
   * @notice Registers a premium position of a cover and updates the pool's slot0.
   * @param self The pool
   * @param coverId_ The cover ID
   * @param coverAmount_ The amount of cover to buy
   * @param premiums_ The amount of premiums deposited
   */
  function _registerCover(
    VPool storage self,
    uint256 coverId_,
    uint256 coverAmount_,
    uint256 premiums_
  ) internal {
    uint256 available = self.availableLiquidity();

    if (available < coverAmount_) {
      revert InsufficientCapacity();
    }

    (uint256 newPremiumRate, uint256 newSecondsPerTick) = self
      .updatedPremiumRate(coverAmount_, 0);

    uint256 durationInSeconds = (premiums_ * YEAR * PERCENTAGE_BASE)
      .rayDiv(newPremiumRate) / coverAmount_;

    if (durationInSeconds < newSecondsPerTick)
      revert DurationTooLow();

    // @dev The user can loose up to almost 1 tick of cover due to the division
    uint32 lastTick = self.slot0.tick +
      uint32(durationInSeconds / newSecondsPerTick);

    self._addPremiumPosition(coverId_, newPremiumRate, lastTick);

    self.slot0.coveredCapital += coverAmount_;
    self.slot0.secondsPerTick = newSecondsPerTick;
    self.slot0.remainingCovers++;
  }

  /// -------- CLOSE -------- ///

  /**
   * @notice Closes a cover and updates the pool's slot0.
   * @param self The pool
   * @param coverId_ The cover ID
   * @param coverAmount_ The amount of cover to close
   */
  function _closeCover(
    VPool storage self,
    uint256 coverId_,
    uint256 coverAmount_
  ) internal {
    CoverPremiums memory coverPremium = self.coverPremiums[coverId_];
    uint32 currentTick = self.slot0.tick;

    if (coverPremium.lastTick < currentTick)
      revert CoverAlreadyExpired();

    (, uint256 newSecondsPerTick) = self.updatedPremiumRate(
      0,
      coverAmount_
    );

    self.slot0.coveredCapital -= coverAmount_;
    self.slot0.secondsPerTick = newSecondsPerTick;
    self.slot0.remainingCovers--;

    if (1 < self.ticks.nbCoversInTick(coverPremium.lastTick)) {
      uint256 coverIdToReplace = self.ticks.getLastCoverIdInTick(
        coverPremium.lastTick
      );

      if (coverId_ != coverIdToReplace) {
        self.coverPremiums[coverIdToReplace].coverIdIndex = self
          .coverPremiums[coverId_]
          .coverIdIndex;
      }

      delete self.coverPremiums[coverId_];

      self.ticks.removeCoverId(
        coverPremium.coverIdIndex,
        coverPremium.lastTick
      );
    } else {
      self._removeTick(coverPremium.lastTick);
    }
  }

  // ======= INTERNAL POOL HELPERS ======= //

  /**
   * @notice Wipes a tick and the premium data of covers within it.
   * @param self The pool
   * @param tick_ The tick to remove
   */
  function _removeTick(
    VPool storage self,
    uint32 tick_
  ) internal returns (uint256[] memory coverIds) {
    coverIds = self.ticks[tick_];

    for (uint256 i; i < coverIds.length; i++) {
      delete self.coverPremiums[coverIds[i]];
    }

    self.ticks.clear(tick_);
    self.tickBitmap.flipTick(tick_);
  }

  /**
   * @notice Updates the pool's slot0 when the available liquidity changes.
   *
   * @param self The pool
   * @param liquidityToAdd_ The amount of liquidity to add
   * @param liquidityToRemove_ The amount of liquidity to remove
   * @param skipLimitCheck_ Whether to skip the available liquidity check
   *
   * @dev The skipLimitCheck_ is used for deposits & payouts
   */
  function _syncLiquidity(
    VPool storage self,
    uint256 liquidityToAdd_,
    uint256 liquidityToRemove_,
    bool skipLimitCheck_
  ) internal {
    uint256 liquidity = self.totalLiquidity();
    uint256 available = self.availableLiquidity();
    uint256 totalCovered = self.slot0.coveredCapital;

    // Skip liquidity check for deposits & payouts
    if (!skipLimitCheck_)
      if (available + liquidityToAdd_ < liquidityToRemove_)
        revert NotEnoughLiquidityForRemoval();

    uint256 previousPremiumRate = self.currentPremiumRate();
    uint256 newPremiumRate = self.getPremiumRate(
      _utilization(
        totalCovered,
        (liquidity + liquidityToAdd_) - liquidityToRemove_
      )
    );

    self.slot0.secondsPerTick = secondsPerTick(
      self.slot0.secondsPerTick,
      previousPremiumRate,
      newPremiumRate
    );
  }

  /**
   * @notice Removes expired covers from the pool and updates the pool's slot0.
   * Required before any operation that requires the slot0 to be up to date.
   * This includes all position and cover operations.
   * @param self The pool
   */
  function _purgeExpiredCovers(VPool storage self) internal {
    if (self.slot0.remainingCovers == 0) return;

    Slot0 memory slot0 = self._refresh(block.timestamp);

    uint32 observedTick = self.slot0.tick;

    // For all the ticks between the slot0 tick & the refreshed tick
    while (observedTick < slot0.tick) {
      bool isInitialized;
      (observedTick, isInitialized) = self.tickBitmap.nextTick(
        observedTick
      );

      if (isInitialized && observedTick <= slot0.tick) {
        uint256[] memory expiredCoverIds = self._removeTick(
          observedTick
        );

        uint256 nbCovers = expiredCoverIds.length;
        for (uint256 i; i < nbCovers; i++) {
          self.expireCover(expiredCoverIds[i]);
        }
      }
    }

    self.slot0 = slot0;
  }

  // ======= VIEW HELPERS ======= //

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
    VPool storage self,
    uint256 coverId_
  ) internal view returns (CoverInfo memory info) {
    // @bw on write fns this refresh is redundant since we purge expired covers before
    // For reads we sync the slot0 to the current timestamp to have latests data
    Slot0 memory slot0 = self._refresh(block.timestamp);
    CoverPremiums storage coverPremium = self.coverPremiums[coverId_];

    if (coverPremium.lastTick < slot0.tick) {
      /**
       * If the cover's last tick is overtaken then it's expired & no premiums are left.
       * Return default 0 values in the returned struct.
       */
    } else {
      uint256 liquidity = self.totalLiquidity();

      info.premiumRate = self.getPremiumRate(
        _utilization(slot0.coveredCapital, liquidity)
      );

      /// @dev Skip division by premium rate PERCENTAGE_BASE for precision
      uint256 beginDailyCost = self
        .coverSize(coverId_)
        .rayMul(coverPremium.beginPremiumRate)
        .rayDiv(365);

      info.currentDailyCost = getDailyCost(
        beginDailyCost,
        coverPremium.beginPremiumRate,
        info.premiumRate
      );

      uint32 currentTick = slot0.tick;

      // As long as the tick at which the cover expires is not overtaken
      while (currentTick < coverPremium.lastTick) {
        (uint32 nextTick, bool initialized) = self
          .tickBitmap
          .nextTick(currentTick);

        // New context to avoid stack too deep error
        {
          uint32 nextMaxTick = nextTick < coverPremium.lastTick
            ? nextTick
            : coverPremium.lastTick;

          // Duration in seconds between currentTick & nextMaxTick
          uint256 duration = (nextMaxTick - currentTick) *
            slot0.secondsPerTick;

          /// @dev Skip division by 1 days for precision
          info.premiumsLeft += duration * info.currentDailyCost;

          currentTick = nextMaxTick;
        }

        // Check for dailyCost update if the nextTick has covers & is before cover expiry
        if (initialized && nextTick < coverPremium.lastTick) {
          uint256 premiumRate;
          (, , premiumRate) = self._crossingInitializedTick(
            slot0,
            nextTick
          );

          info.currentDailyCost = getDailyCost(
            beginDailyCost,
            coverPremium.beginPremiumRate,
            premiumRate
          );
        }
      }

      /**
       * @dev Un-scale the token value of premiums left & daily cost
       * - PERCENTAGE_BASE for premium rate percentage base
       * - RAY for result being in ray
       * - 1 days for duration being in seconds (only for premiums left)
       */
      info.premiumsLeft =
        info.premiumsLeft /
        (PERCENTAGE_BASE * 1 days * RAY);
      info.currentDailyCost =
        info.currentDailyCost /
        (PERCENTAGE_BASE * RAY);
    }
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
    VPool storage self,
    Slot0 memory slot0_,
    uint32 tick_
  )
    internal
    view
    returns (
      Slot0 memory /* slot0_ */,
      uint256 utilization,
      uint256 premiumRate
    )
  {
    uint256[] memory coverIds = self.ticks[tick_];
    uint256 liquidity = self.totalLiquidity();

    uint256 coveredCapitalToRemove;
    uint256 nbCovers = coverIds.length;
    for (uint256 i; i < nbCovers; i++) {
      // Add all the size of all covers in the tick
      coveredCapitalToRemove += self.coverSize(coverIds[i]);
    }

    uint256 previousPremiumRate = self.currentPremiumRate();

    utilization = _utilization(
      slot0_.coveredCapital - coveredCapitalToRemove,
      liquidity
    );

    premiumRate = self.getPremiumRate(utilization);

    // These are the mutated values
    slot0_.coveredCapital -= coveredCapitalToRemove;
    slot0_.remainingCovers -= nbCovers;
    slot0_.secondsPerTick = secondsPerTick(
      slot0_.secondsPerTick,
      previousPremiumRate,
      premiumRate
    );

    return (slot0_, utilization, premiumRate);
  }

  /**
   * @notice Computes an updated slot0 & liquidity index up to a timestamp.
   * These changes are virtual an not reflected in storage in this function.
   *
   * @param self The pool
   * @param timestamp_ The timestamp to update the slot0 & liquidity index to
   *
   * @return slot0 The updated slot0
   */
  function _refresh(
    VPool storage self,
    uint256 timestamp_
  ) internal view returns (Slot0 memory slot0) {
    // Make copy in memory to allow for mutations
    slot0 = self.slot0;

    uint256 liquidity = self.totalLiquidity();
    uint256 utilization = _utilization(
      slot0.coveredCapital,
      liquidity
    );

    // The remaining time in seconds to run through to sync up to the timestamp
    uint256 remaining = timestamp_ - slot0.lastUpdateTimestamp;
    uint256 premiumRate = self.getPremiumRate(utilization);
    /**
     * We do not compute changes for periods below the size of one tick
     * This value will be changed if we enter the while loop
     */
    uint256 ignoredDuration = remaining;
    uint256 liquidityIndexUpdateLength;

    while (slot0.secondsPerTick < remaining) {
      (uint32 nextTick, bool isInitialized) = self
        .tickBitmap
        .nextTick(slot0.tick);

      // Amount of time contained in the next tick segment
      uint256 secondsToNextTick = slot0.secondsPerTick *
        (nextTick - slot0.tick);

      if (secondsToNextTick <= remaining) {
        // If the tick has covers then expire them & update pool metrics
        if (isInitialized) {
          (slot0, utilization, premiumRate) = self
            ._crossingInitializedTick(slot0, nextTick);
        }

        // We set ignored to 0 in case remaining is exactly the size to next tick
        ignoredDuration = 0;
        liquidityIndexUpdateLength = secondsToNextTick;
        slot0.tick = nextTick;
        // Remove parsed tick size from remaining time to current timestamp
        remaining -= secondsToNextTick;
      } else {
        /**
         * If the remaining time is not enough to reach the nextTick we still
         * update the current tick & liquidity index to the timestamp.
         */
        ignoredDuration = remaining % slot0.secondsPerTick;
        liquidityIndexUpdateLength = remaining - ignoredDuration;
        slot0.tick += uint32(remaining / slot0.secondsPerTick);
        // @dev This means the loop is finished after the liquidity index update
        remaining = ignoredDuration;
      }

      slot0.liquidityIndex += computeLiquidityIndex(
        utilization,
        premiumRate,
        liquidityIndexUpdateLength
      );
    }

    slot0.lastUpdateTimestamp = timestamp_ - ignoredDuration;
    slot0.liquidityIndexLead = computeLiquidityIndex(
      utilization,
      premiumRate,
      ignoredDuration
    );
  }

  /**
   * @notice Computes the state changes of an LP position,
   * it aggregates the fees earned by the position and
   * computes the losses incurred by the claims in this pool.
   *
   * @dev Used for takeInterest, withdrawLiquidity and rewardsOf
   *
   * @param self The pool
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
   */
  function _getUpdatedPositionInfo(
    VPool storage self,
    uint64[] storage poolIds_,
    UpdatePositionParams memory params
  ) internal view returns (UpdatedPositionInfo memory info) {
    info.newLpInfo = self.lpInfos[params.tokenId];
    info.newUserCapital = params.userCapital;

    uint256 strategyId = self.strategyId;
    // If strategy compounds then add to capital to compute next new rewards
    bool itCompounds = self.strategyManager.itCompounds(strategyId);
    uint64 poolId = self.poolId;

    uint256 compensationId = info.newLpInfo.beginClaimIndex;
    uint256 endCompensationId = self.compensationIds.length;
    uint256 nbPools = poolIds_.length;

    // This index is not bubbled up in info because it is updated by the LiquidityManager
    uint256 upToStrategyRewardIndex = params.strategyRewardIndex;

    /**
     * Parse each claim that may affect capital due to overlap in order to
     * compute rewards on post compensation capital
     */
    for (
      compensationId;
      compensationId < endCompensationId;
      compensationId++
    ) {
      Compensation storage comp = self.getCompensation(
        compensationId
      );

      // For each pool in the position
      for (uint256 j; j < nbPools; j++) {
        // Skip if the comp is not incoming from one of the pools in the position
        if (poolIds_[j] != comp.fromPoolId) continue;

        // We want the liquidity index of this pool at the time of the claim
        uint256 liquidityIndexBeforeClaim = comp
          .liquidityIndexBeforeClaim[poolId];

        // Compute the rewards accumulated up to the claim
        info.coverRewards += getCoverRewards(
          info.newUserCapital,
          info.newLpInfo.beginLiquidityIndex,
          liquidityIndexBeforeClaim
        );
        info.strategyRewards += self.strategyManager.computeReward(
          strategyId,
          itCompounds
            ? info.newUserCapital + info.strategyRewards
            : info.newUserCapital,
          params.strategyRewardIndex,
          comp.strategyRewardIndexBeforeClaim
        );

        // Register up to where the rewards have been accumulated
        upToStrategyRewardIndex = comp.strategyRewardIndexBeforeClaim;
        info
          .newLpInfo
          .beginLiquidityIndex = liquidityIndexBeforeClaim;
        // Reduce capital after the comp & break loop
        info.newUserCapital -= info.newUserCapital.rayMul(comp.ratio);

        break;
      }
    }

    /**
     * Finally add the rewards from the last claim or update to the current block
     * & register latest reward & claim indexes
     */

    info.strategyRewards += self.strategyManager.computeReward(
      strategyId,
      itCompounds
        ? info.newUserCapital + info.strategyRewards
        : info.newUserCapital,
      upToStrategyRewardIndex,
      params.latestStrategyRewardIndex
    );

    info.coverRewards += getCoverRewards(
      info.newUserCapital,
      info.newLpInfo.beginLiquidityIndex,
      params.currentLiquidityIndex
    );

    // Register up to where the position has been updated
    info.newLpInfo.beginLiquidityIndex = params.currentLiquidityIndex;
    info.newLpInfo.beginClaimIndex = endCompensationId;
  }

  // ======= PURE HELPERS ======= //

  /**
   * @notice Computes the premium rate of a cover,
   * the premium rate is the APR cost for a cover  ,
   * these are paid by cover buyer on their cover amount.
   *
   * @param self The pool
   * @param utilizationRate_ The utilization rate of the pool
   *
   * @return The premium rate of the cover expressed in rays
   *
   * @dev Not pure since reads self but pure for all practical purposes
   */
  function getPremiumRate(
    VPool storage self,
    uint256 utilizationRate_
  ) internal view returns (uint256 /* premiumRate */) {
    Formula storage formula = self.formula;

    if (utilizationRate_ < formula.uOptimal) {
      // Return base rate + proportional slope 1 rate
      return
        formula.r0 +
        formula.rSlope1.rayMul(
          utilizationRate_.rayDiv(formula.uOptimal)
        );
    } else if (utilizationRate_ < FULL_CAPACITY) {
      // Return base rate + slope 1 rate + proportional slope 2 rate
      return
        formula.r0 +
        formula.rSlope1 +
        formula.rSlope2.rayMul(
          (utilizationRate_ - formula.uOptimal).rayDiv(
            FULL_CAPACITY - formula.uOptimal
          )
        );
    } else {
      // Return base rate + slope 1 rate + slope 2 rate
      /**
       * @dev Premium rate is capped because in case of overusage the
       * liquidity providers are exposed to the same risk as 100% usage but
       * cover buyers are not fully covered.
       * This means cover buyers only pay for the effective cover they have.
       */
      return formula.r0 + formula.rSlope1 + formula.rSlope2;
    }
  }

  /**
   * @notice Computes the liquidity index for a given period
   * @param utilizationRate_ The utilization rate
   * @param premiumRate_ The premium rate
   * @param timeSeconds_ The time in seconds
   * @return The liquidity index to add for the given time
   */
  function computeLiquidityIndex(
    uint256 utilizationRate_,
    uint256 premiumRate_,
    uint256 timeSeconds_
  ) internal pure returns (uint /* liquidityIndex */) {
    return
      utilizationRate_
        .rayMul(premiumRate_)
        .rayMul(timeSeconds_)
        .rayDiv(YEAR);
  }

  /**
   * @notice Computes the premiums or interests earned by a liquidity position
   * @param userCapital_ The amount of liquidity in the position
   * @param endLiquidityIndex_ The end liquidity index
   * @param startLiquidityIndex_ The start liquidity index
   */
  function getCoverRewards(
    uint256 userCapital_,
    uint256 startLiquidityIndex_,
    uint256 endLiquidityIndex_
  ) internal pure returns (uint256) {
    return
      (userCapital_.rayMul(endLiquidityIndex_) -
        userCapital_.rayMul(startLiquidityIndex_)) / 10_000;
  }

  /**
   * @notice Computes the new daily cost of a cover,
   * the emmission rate is the daily cost of a cover  .
   *
   * @param oldDailyCost_ The daily cost of the cover before the change
   * @param oldPremiumRate_ The premium rate of the cover before the change
   * @param newPremiumRate_ The premium rate of the cover after the change
   *
   * @return The new daily cost of the cover expressed in tokens/day
   */
  function getDailyCost(
    uint256 oldDailyCost_,
    uint256 oldPremiumRate_,
    uint256 newPremiumRate_
  ) internal pure returns (uint256) {
    return (oldDailyCost_ * newPremiumRate_) / oldPremiumRate_;
  }

  /**
   * @notice Computes the new seconds per tick of a pool,
   * the seconds per tick is the time between two ticks  .
   *
   * @param oldSecondsPerTick_ The seconds per tick before the change
   * @param oldPremiumRate_ The premium rate before the change
   * @param newPremiumRate_ The premium rate after the change
   *
   * @return The new seconds per tick of the pool
   */
  function secondsPerTick(
    uint256 oldSecondsPerTick_,
    uint256 oldPremiumRate_,
    uint256 newPremiumRate_
  ) internal pure returns (uint256) {
    return
      oldSecondsPerTick_.rayMul(oldPremiumRate_).rayDiv(
        newPremiumRate_
      );
  }

  /**
   * @notice Computes the current premium rate of the pool based on utilization.
   * @param self The pool
   *
   * @return The current premium rate of the pool
   *
   * @dev Not pure since reads self but pure for all practical purposes
   */
  function currentPremiumRate(
    VPool storage self
  ) internal view returns (uint256) {
    return
      self.getPremiumRate(
        _utilization(self.slot0.coveredCapital, self.totalLiquidity())
      );
  }

  /**
   * @notice Computes the updated premium rate of the pool based on utilization.
   * @param self The pool
   * @param coveredCapitalToAdd_ The amount of covered capital to add
   * @param coveredCapitalToRemove_ The amount of covered capital to remove
   *
   * @return newPremiumRate The updated premium rate of the pool
   * @return newSecondsPerTick The updated seconds per tick of the pool
   */
  function updatedPremiumRate(
    VPool storage self,
    uint256 coveredCapitalToAdd_,
    uint256 coveredCapitalToRemove_
  )
    internal
    view
    returns (uint256 newPremiumRate, uint256 newSecondsPerTick)
  {
    uint256 previousPremiumRate = self.currentPremiumRate();

    newPremiumRate = self.getPremiumRate(
      _utilization(
        ((self.slot0.coveredCapital + coveredCapitalToAdd_) -
          coveredCapitalToRemove_),
        self.totalLiquidity()
      )
    );

    newSecondsPerTick = secondsPerTick(
      self.slot0.secondsPerTick,
      previousPremiumRate,
      newPremiumRate
    );
  }

  /**
   * @notice Computes the percentage of the pool's liquidity used for covers.
   * @param coveredCapital_ The amount of covered capital
   * @param liquidity_ The total amount liquidity
   *
   * @return rate The utilization rate of the pool
   *
   * @dev The utilization rate is capped at 100%.
   */
  function _utilization(
    uint256 coveredCapital_,
    uint256 liquidity_
  ) internal pure returns (uint256 /* rate */) {
    // If the pool has no liquidity then the utilization rate is 0
    if (liquidity_ == 0) return 0;

    /**
     * @dev Utilization rate is capped at 100% because in case of overusage the
     * liquidity providers are exposed to the same risk as 100% usage but
     * cover buyers are not fully covered.
     * This means cover buyers only pay for the effective cover they have.
     */
    if (liquidity_ < coveredCapital_) return FULL_CAPACITY;

    // Get a base PERCENTAGE_BASE percentage
    return (coveredCapital_ * PERCENTAGE_BASE).rayDiv(liquidity_);
  }
}
