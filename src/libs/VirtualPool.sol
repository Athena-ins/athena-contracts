// SPDX-License-Identifier: MIT
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
error UpdateMustBeGreaterThanLast();
error CoverAlreadyExpired();
error DurationTooLow();
error InsufficientCapacity();
error LiquidityNotAvailable();
error NotEnoughLiquidityForRemoval();
error PoolHasOnGoingClaims();

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
 */
library VirtualPool {
  using VirtualPool for VPool;
  using RayMath for uint256;
  using SafeERC20 for IERC20;
  using Tick for mapping(uint32 => uint256[]);
  using TickBitmap for mapping(uint24 => uint256);

  // ======= CONSTANTS ======= //

  uint256 internal constant DAY = 86400; // 1 day in seconds
  uint256 internal constant YEAR = 365 * DAY; // 365 day
  uint256 internal constant MAX_SECONDS_PER_TICK = DAY;
  uint256 internal constant FEE_BASE = RayMath.RAY; // RAY = 1e27
  uint256 internal constant FULL_UTILIZATION_RATE = 100 * RayMath.RAY; // RAY = 1e27

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
    uint256 totalInsuredCapital;
    uint256 remainingCovers;
    uint256 lastUpdateTimestamp;
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
    uint256 currentEmissionRate;
    uint256 premiumRate;
  }

  struct Compensation {
    uint64 fromPoolId;
    uint256 ratio;
    uint256 rewardIndexBeforeClaim;
    mapping(uint64 _poolId => uint256 _amount) liquidityIndexBeforeClaim;
  }

  struct UpdatedPositionInfo {
    uint256 newUserCapital;
    uint256 coverRewards;
    uint256 strategyRewards;
    LpInfo newLpInfo;
  }

  // ======= VIRTUAL STORAGE ======= //

  struct VPoolRead {
    uint64 poolId;
    uint256 feeRate; //Ray
    Formula formula;
    Slot0 slot0;
    uint256 liquidityIndex;
    uint256 strategyId;
    address paymentAsset;
    address underlyingAsset;
    address wrappedAsset;
    bool isPaused;
    uint64[] overlappedPools;
    uint256[] compensationIds;
  }

  struct VPool {
    uint64 poolId;
    uint256 feeRate; // amount of fees on premiums in RAY
    uint256 leverageFeePerPool; // amount of fees per pool when using leverage
    IEcclesiaDao dao;
    IStrategyManager strategyManager;
    Formula formula;
    Slot0 slot0;
    uint256 liquidityIndex; // This index grows with the premiums paid
    uint256 strategyId;
    address paymentAsset; // asset used to pay LP premiums
    address underlyingAsset; // asset required by the strategy
    address wrappedAsset; // tokenised strategy shares (ex: aTokens)
    bool isPaused;
    uint64[] overlappedPools;
    uint256 ongoingClaims;
    uint256[] compensationIds;
    /// @dev poolId 0 -> poolId 0 points to a pool's available liquidity
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
    function(uint256) view returns (uint256) coverSize;
    function(uint256) expireCover;
    function(uint256)
      view
      returns (Compensation storage) getCompensation;
    function(uint256) view returns (uint256) posRewardIndex;
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
    // Function pointer to child contract cover data
    function(uint256) view returns (uint256) coverSize;
    function(uint256) expireCover;
    function(uint256)
      view
      returns (Compensation storage) getCompensation;
    function(uint256) view returns (uint256) posRewardIndex;
  }

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

    self.slot0.secondsPerTick = MAX_SECONDS_PER_TICK;
    self.slot0.lastUpdateTimestamp = block.timestamp;

    self.overlappedPools.push(params.poolId);

    self.coverSize = params.coverSize;
    self.expireCover = params.expireCover;
    self.getCompensation = params.getCompensation;
    self.posRewardIndex = params.posRewardIndex;
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

  event CoverExpired(uint256 coverId, uint32 tick);

  // ======= READ METHODS ======= //

  function availableLiquidity(
    VPool storage self
  ) internal view returns (uint256) {
    return self.overlaps[self.poolId];
  }

  // ======= LIQUIDITY ======= //

  function _depositToPool(
    VPool storage self,
    uint256 tokenId_,
    uint256 amount_
  ) internal {
    self._syncLiquidity(amount_, 0);

    // This sets the point from which the position earns rewards & is impacted by claims
    // also overwrites previous LpInfo after a withdrawal
    self.lpInfos[tokenId_] = LpInfo({
      beginLiquidityIndex: self.liquidityIndex,
      beginClaimIndex: self.compensationIds.length
    });
  }

  function _payRewardsAndFees(
    VPool storage self,
    uint256 rewards_,
    address account_,
    uint256 yieldBonus_,
    uint256 nbPools_
  ) private {
    if (0 < rewards_) {
      uint256 fees = _feeFor(rewards_, self.feeRate, yieldBonus_);

      uint256 leverageFee;
      if (1 < nbPools_) {
        // The risk fee is only applied when using leverage
        leverageFee =
          (rewards_ * (self.leverageFeePerPool * nbPools_)) /
          RayMath.RAY;
      } else if (account_ == address(self.dao)) {
        // Take profits for the DAO accumulate the net in the leverage risk wallet
        leverageFee = rewards_ - fees;
      }

      uint256 totalFees = fees + leverageFee;
      uint256 net = rewards_ - totalFees;

      // Pay position owner
      if (net == 0) {
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
   * @dev Need to update user capital & payout strategy rewards upon calling this function
   */
  function _takePoolInterests(
    VPool storage self,
    uint256 tokenId_,
    address account_,
    uint256 amount_,
    uint256 yieldBonus_,
    uint64[] storage poolIds_
  ) internal returns (uint256, uint256) {
    // Get the updated position info
    UpdatedPositionInfo memory info = _getUpdatedPositionInfo(
      self,
      tokenId_,
      amount_,
      poolIds_
    );

    // Pay cover rewards and send fees to treasury
    _payRewardsAndFees(
      self,
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

  function _withdrawLiquidity(
    VPool storage self,
    uint256 tokenId_,
    uint256 amount_,
    uint64[] storage poolIds_
  ) internal returns (uint256, uint256) {
    // Pool is locked while there are ongoing claims
    if (0 < self.ongoingClaims) revert PoolHasOnGoingClaims();

    // Get the updated position info
    UpdatedPositionInfo memory info = _getUpdatedPositionInfo(
      self,
      tokenId_,
      amount_,
      poolIds_
    );

    // Pool rewards after commit are paid in favor of the DAO's leverage risk wallet
    _payRewardsAndFees(
      self,
      info.coverRewards,
      address(self.dao),
      0, // No yield bonus for the DAO
      poolIds_.length
    );

    // Update liquidity index
    self._syncLiquidity(0, info.newUserCapital);

    // Check that the pool has enough liquidity to withdraw
    uint256 utilization = getUtilizationRate(
      0,
      0,
      self.slot0.totalInsuredCapital,
      availableLiquidity(self) - info.newUserCapital
    );
    if (FULL_UTILIZATION_RATE < utilization)
      revert LiquidityNotAvailable();

    // Return the user's capital & strategy rewards for withdrawal
    return (info.newUserCapital, info.strategyRewards);
  }

  // ======= COVERS ======= //

  /// -------- BUY -------- ///

  function _addPremiumPosition(
    VPool storage self,
    uint256 tokenId_,
    uint256 beginPremiumRate_,
    uint32 lastTick_
  ) private {
    uint224 nbCoversInTick = self.ticks.addCoverId(
      tokenId_,
      lastTick_
    );

    self.coverPremiums[tokenId_] = CoverPremiums({
      beginPremiumRate: beginPremiumRate_,
      lastTick: lastTick_,
      coverIdIndex: nbCoversInTick
    });

    if (!self.tickBitmap.isInitializedTick(lastTick_)) {
      self.tickBitmap.flipTick(lastTick_);
    }
  }

  function _buyCover(
    VPool storage self,
    uint256 coverId_,
    uint256 coverAmount_,
    uint256 premiums_
  ) internal {
    uint256 available = availableLiquidity(self);
    uint256 totalInsuredCapital = self.slot0.totalInsuredCapital;

    if (available < totalInsuredCapital + coverAmount_) {
      revert InsufficientCapacity();
    }

    uint256 currentPremiumRate = getPremiumRate(
      self,
      getUtilizationRate(0, 0, totalInsuredCapital, available)
    );

    uint256 beginPremiumRate = getPremiumRate(
      self,
      getUtilizationRate(
        coverAmount_,
        0,
        totalInsuredCapital,
        available
      )
    );

    uint256 durationInSeconds = durationSecondsUnit(
      premiums_,
      coverAmount_,
      beginPremiumRate
    );

    uint256 newSecondsPerTick = getSecondsPerTick(
      self.slot0.secondsPerTick,
      currentPremiumRate,
      beginPremiumRate
    );

    if (durationInSeconds < newSecondsPerTick)
      revert DurationTooLow();

    uint32 lastTick = self.slot0.tick +
      uint32(durationInSeconds / newSecondsPerTick);

    _addPremiumPosition(self, coverId_, beginPremiumRate, lastTick);

    self.slot0.totalInsuredCapital += coverAmount_;
    self.slot0.secondsPerTick = newSecondsPerTick;
    self.slot0.remainingCovers++;
  }

  /// -------- CLOSE -------- ///

  function _closeCover(
    VPool storage self,
    uint256 coverId_,
    uint256 coverAmount_
  ) internal {
    CoverPremiums memory coverPremium = self.coverPremiums[coverId_];
    uint32 currentTick = self.slot0.tick;
    uint256 totalInsuredCapital = self.slot0.totalInsuredCapital;

    if (coverPremium.lastTick < currentTick)
      revert CoverAlreadyExpired();

    uint256 available = availableLiquidity(self);

    uint256 currentPremiumRate = getPremiumRate(
      self,
      getUtilizationRate(0, 0, totalInsuredCapital, available)
    );
    uint256 newPremiumRate = getPremiumRate(
      self,
      getUtilizationRate(
        0,
        coverAmount_,
        totalInsuredCapital,
        available
      )
    );

    uint256 newSecondsPerTick = getSecondsPerTick(
      self.slot0.secondsPerTick,
      currentPremiumRate,
      newPremiumRate
    );

    self.slot0.totalInsuredCapital -= coverAmount_;
    self.slot0.secondsPerTick = newSecondsPerTick;
    self.slot0.remainingCovers--;

    if (1 < self.ticks.getCoverIdNumber(coverPremium.lastTick)) {
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
      _removeTick(self, coverPremium.lastTick);
    }
  }

  // ======= INTERNAL POOL HELPERS ======= //

  function _removeTick(
    VPool storage self,
    uint32 _tick
  ) private returns (uint256[] memory coverIds) {
    coverIds = self.ticks[_tick];

    for (uint256 i; i < coverIds.length; i++) {
      uint256 coverId = coverIds[i];
      delete self.coverPremiums[coverId];

      emit CoverExpired(coverId, _tick);
    }

    self.ticks.clear(_tick);
    self.tickBitmap.flipTick(_tick);
  }

  /**
   * @notice Updates the pool's slot0 when the available liquidity changes.
   *
   * @param self The pool
   * @param amountToAdd_ The amount of liquidity to add
   * @param amountToRemove_ The amount of liquidity to remove
   */
  function _syncLiquidity(
    VPool storage self,
    uint256 amountToAdd_,
    uint256 amountToRemove_
  ) internal {
    uint256 available = availableLiquidity(self);
    if (available + amountToAdd_ < amountToRemove_)
      revert NotEnoughLiquidityForRemoval();

    uint256 totalInsured = self.slot0.totalInsuredCapital;
    uint256 currentPremiumRate = getPremiumRate(
      self,
      getUtilizationRate(0, 0, totalInsured, available)
    );
    uint256 newPremiumRate = getPremiumRate(
      self,
      getUtilizationRate(
        0,
        0,
        totalInsured,
        available + amountToAdd_ - amountToRemove_
      )
    );

    self.slot0.secondsPerTick = getSecondsPerTick(
      self.slot0.secondsPerTick,
      currentPremiumRate,
      newPremiumRate
    );
  }

  function _purgeExpiredCovers(VPool storage self) internal {
    if (0 < self.slot0.remainingCovers) {
      (Slot0 memory slot0, uint256 liquidityIndex) = _refresh(
        self,
        block.timestamp
      );

      uint32 observedTick = self.slot0.tick;
      bool isInitialized;
      while (observedTick < slot0.tick) {
        (observedTick, isInitialized) = self.tickBitmap.nextTick(
          observedTick
        );

        if (isInitialized && observedTick <= slot0.tick) {
          uint256[] memory expiredCoverIds = _removeTick(
            self,
            observedTick
          );

          uint256 nbCovers = expiredCoverIds.length;
          for (uint256 i; i < nbCovers; i++) {
            self.expireCover(expiredCoverIds[i]);
          }
        }
      }

      self.slot0.tick = slot0.tick;
      self.slot0.secondsPerTick = slot0.secondsPerTick;
      self.slot0.totalInsuredCapital = slot0.totalInsuredCapital;
      self.slot0.remainingCovers = slot0.remainingCovers;
      self.liquidityIndex = liquidityIndex;
    }

    self.slot0.lastUpdateTimestamp = block.timestamp;
  }

  // ======= VIEW HELPERS ======= //

  /**
   * @notice Computes the premium rate & daily cost of a cover,
   * this parses the pool's ticks to compute how much premiums are left and
   * what is the daily cost of keeping the cover openened.
   *
   * @param self The pool
   * @param coverId_ The cover ID
   * @param syncSlot0_ Whether to sync the slot0 to the current timestamp in memory
   *
   * @return info A struct containing the cover's premium rate & the cover's daily cost
   */
  function _coverInfo(
    VPool storage self,
    uint256 coverId_,
    bool syncSlot0_
  ) internal view returns (CoverInfo memory info) {
    // For reads we sync the slot0 to the current timestamp to have latests data
    (Slot0 memory slot0, ) = syncSlot0_
      ? _refresh(self, block.timestamp)
      : (self.slot0, 0);
    CoverPremiums storage coverPremium = self.coverPremiums[coverId_];

    if (coverPremium.lastTick < slot0.tick) {
      // If the cover's last tick is overtaken then it's expired and all values are 0
      return CoverInfo({ premiumsLeft: 0, currentEmissionRate: 0 });
    } else {
      uint256 available = availableLiquidity(self);
      uint256 beginEmissionRate = self.coverSize(coverId_).rayMul(
        coverPremium.beginPremiumRate / 100
      ) / 365;
      uint256 currentPremiumRate = getPremiumRate(
        self,
        getUtilizationRate(0, 0, slot0.totalInsuredCapital, available)
      );

      info.currentEmissionRate = getEmissionRate(
        beginEmissionRate,
        coverPremium.beginPremiumRate,
        currentPremiumRate
      );

      uint256 emissionRate = info.currentEmissionRate;
      uint32 currentTick = slot0.tick;

      // As long as the tick at which the cover expires is not overtaken
      while (currentTick < coverPremium.lastTick) {
        (uint32 nextTick, bool initialized) = self
          .tickBitmap
          .nextTick(currentTick);

        // New context to avoid stack too deep error
        {
          currentTick = nextTick < coverPremium.lastTick
            ? nextTick
            : coverPremium.lastTick;

          // Tick size in seconds
          uint256 tickSize = (nextTick - currentTick) *
            slot0.secondsPerTick;

          info.premiumsLeft +=
            (tickSize * emissionRate) /
            MAX_SECONDS_PER_TICK;
        }

        // If the next tick is initialized does not overtake cover expiry tick
        if (initialized && nextTick < coverPremium.lastTick) {
          (slot0, , currentPremiumRate) = _crossingInitializedTick(
            self,
            slot0,
            available,
            nextTick
          );

          // @bw should we not use em & prem rate from previous round ?
          emissionRate = getEmissionRate(
            beginEmissionRate,
            coverPremium.beginPremiumRate,
            currentPremiumRate
          );
        }
      }
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
   * @param availableLiquidity_ The available liquidity of the pool
   * @param tick_ The tick to cross
   *
   * @return The mutated slot0
   */
  function _crossingInitializedTick(
    VPool storage self,
    Slot0 memory slot0_,
    uint256 availableLiquidity_,
    uint32 tick_
  )
    private
    view
    returns (
      Slot0 memory,
      uint256 utilizationRate,
      uint256 premiumRate
    )
  {
    uint256[] memory coverIds = self.ticks[tick_];

    uint256 insuredCapitalToRemove;
    for (uint256 i; i < coverIds.length; i++) {
      uint256 coverId = coverIds[i];
      // Add all the size of all covers in the tick
      insuredCapitalToRemove += self.coverSize(coverId);
    }

    uint256 previousPremiumRate = getPremiumRate(
      self,
      getUtilizationRate(
        0,
        0,
        slot0_.totalInsuredCapital,
        availableLiquidity_
      )
    );

    utilizationRate = getUtilizationRate(
      0,
      insuredCapitalToRemove,
      slot0_.totalInsuredCapital,
      availableLiquidity_
    );
    premiumRate = getPremiumRate(self, utilizationRate);

    // These are the mutated values
    slot0_.totalInsuredCapital -= insuredCapitalToRemove;
    slot0_.remainingCovers -= coverIds.length;
    slot0_.secondsPerTick = getSecondsPerTick(
      slot0_.secondsPerTick,
      previousPremiumRate,
      premiumRate
    );

    return (slot0_, utilizationRate, premiumRate);
  }

  /**
   * @notice Computes an updated slot0 & liquidity index up to a timestamp.
   * These changes are virtual an not reflected in storage in this function.
   *
   * @param self The pool
   * @param timestamp_ The timestamp to update the slot0 & liquidity index to
   *
   * @return slot0 The updated slot0
   * @return liquidityIndex The updated liquidity index
   */
  function _refresh(
    VPool storage self,
    uint256 timestamp_
  )
    private
    view
    returns (Slot0 memory /*slot0*/, uint256 /*liquidityIndex*/)
  {
    // Make copies in memory to allow for mutations
    Slot0 memory slot0 = self.slot0;

    uint256 liquidityIndex = self.liquidityIndex;
    uint256 available = availableLiquidity(self);
    // The remaining time in seconds to run through to sync up to the timestamp

    uint256 utilization = getUtilizationRate(
      0,
      0,
      slot0.totalInsuredCapital,
      available
    );
    uint256 premiumRate = getPremiumRate(self, utilization);
    uint32 currentTick = slot0.tick;
    uint256 remaining = timestamp_ - slot0.lastUpdateTimestamp;
    while (0 < remaining) {
      (uint32 nextTick, bool isInitialized) = self
        .tickBitmap
        .nextTick(currentTick);

      // Tick size in seconds
      uint256 tickSize = (nextTick - currentTick) *
        slot0.secondsPerTick;

      if (tickSize <= remaining) {
        currentTick = nextTick;

        if (isInitialized) {
          // If the tick has covers then expire then upon crossing the tick & update liquidity
          // Save the updated slot0
          (
            slot0,
            utilization,
            premiumRate
          ) = _crossingInitializedTick(
            self,
            slot0,
            available,
            nextTick
          );
        }

        liquidityIndex +=
          (utilization.rayMul(premiumRate) * tickSize) /
          YEAR;

        // Remove parsed tick size from remaining time to current timestamp
        remaining -= tickSize;
      } else {
        currentTick += uint32(remaining / slot0.secondsPerTick);

        liquidityIndex +=
          (utilization.rayMul(premiumRate) * remaining) /
          YEAR;

        break; // remaining is 0
      }
    }

    // Update current tick & last update timestamp
    slot0.tick = currentTick;
    slot0.lastUpdateTimestamp = timestamp_;

    return (slot0, liquidityIndex);
  }

  /**
   * @notice Computes the state changes of an LP position,
   * it aggregates the fees earned by the position in the pool and
   * computes the losses incurred by the claims in this pool.
   *
   * @dev Used for takeInterest, withdrawLiquidity and rewardsOf
   *
   * @param self The pool
   * @param tokenId_ The LP position token ID
   * @param userCapital_ The amount of liquidity in the position
   * @param poolIds_ The pool IDs of the position
   *
   * @return info Updated information about the position:
   * - newUserCapital The user's capital after claims
   * - coverRewards The rewards earned by covers in the pool
   * - strategyRewards The rewards earned by the strategy
   * - newLpInfo The updated LpInfo of the position
   */
  function _getUpdatedPositionInfo(
    VPool storage self,
    uint256 tokenId_,
    uint256 userCapital_,
    uint64[] storage poolIds_
  ) private view returns (UpdatedPositionInfo memory info) {
    info.newLpInfo = self.lpInfos[tokenId_];
    info.newUserCapital = userCapital_;

    uint256 strategyId = self.strategyId;
    // If strategy compounds then add to capital to compute next new rewards
    bool itCompounds = self.strategyManager.itCompounds(strategyId);

    uint256 compensationId = info.newLpInfo.beginClaimIndex;
    uint256 endCompensationId = self.compensationIds.length;
    uint256 nbPools = poolIds_.length;

    uint256 rewardIndex = self.posRewardIndex(tokenId_);
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

      // Check if the comp is incoming from one of the pools in the position
      for (uint256 j; j < nbPools; j++) {
        uint64 poolId = poolIds_[j];
        if (poolId != comp.fromPoolId) continue;

        uint256 liquidityIndexBeforeClaim = comp
          .liquidityIndexBeforeClaim[poolId];

        // Compute the rewards accumulated up to the claim
        info.coverRewards += info.newUserCapital.rayMul(
          liquidityIndexBeforeClaim -
            info.newLpInfo.beginLiquidityIndex
        );
        info.strategyRewards += self.strategyManager.computeReward(
          strategyId,
          itCompounds
            ? info.newUserCapital + info.strategyRewards
            : info.newUserCapital,
          rewardIndex,
          comp.rewardIndexBeforeClaim
        );

        // Register up to where the rewards have been accumulated
        rewardIndex = comp.rewardIndexBeforeClaim;
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
    uint256 latestRewardIndex = self.strategyManager.getRewardIndex(
      strategyId
    );

    info.strategyRewards += self.strategyManager.computeReward(
      strategyId,
      itCompounds
        ? info.newUserCapital + info.strategyRewards
        : info.newUserCapital,
      rewardIndex,
      latestRewardIndex
    );
    info.coverRewards += info.newUserCapital.rayMul(
      self.liquidityIndex - info.newLpInfo.beginLiquidityIndex
    );

    info.newLpInfo.beginLiquidityIndex = self.liquidityIndex;
    info.newLpInfo.beginClaimIndex = endCompensationId;
  }

  /**
   * @notice Computes the premium rate of a cover,
   * the premium rate is the APR cost for a cover in the pool,
   * these are paid by cover buyer on their cover amount.
   *
   * @param self The pool
   * @param utilizationRate_ The utilization rate of the pool
   *
   * @return The premium rate of the cover expressed in rays
   */
  function getPremiumRate(
    VPool storage self,
    uint256 utilizationRate_
  ) private view returns (uint256) {
    Formula storage formula = self.formula;
    // returns actual rate for insurance
    if (utilizationRate_ < formula.uOptimal) {
      // Return base rate + proportional slope 1 rate
      return
        formula.r0 +
        formula.rSlope1.rayMul(
          utilizationRate_.rayDiv(formula.uOptimal)
        );
    } else if (utilizationRate_ < FULL_UTILIZATION_RATE) {
      // Return base rate + slope 1 rate + proportional slope 2 rate
      return
        formula.r0 +
        formula.rSlope1 +
        formula.rSlope2.rayMul(
          (utilizationRate_ - formula.uOptimal).rayDiv(
            FULL_UTILIZATION_RATE - formula.uOptimal
          )
        );
    } else {
      /**
       * @dev Premium rate is capped because in case of overusage the
       * liquidity providers are exposed to the same risk as 100% usage but
       * cover buyers are not fully covered.
       * This means cover buyers only pay for the effective cover they have.
       */
      // Return base rate + slope 1 rate + slope 2 rate
      return formula.r0 + formula.rSlope1 + formula.rSlope2;
    }
  }

  // ======= PURE HELPERS ======= //

  function _feeFor(
    uint256 grossReward_,
    uint256 feeRate_,
    uint256 yieldBonus_
  ) private pure returns (uint256) {
    return
      ((grossReward_ * feeRate_ * (FEE_BASE - yieldBonus_)) /
        FEE_BASE) / FEE_BASE;
  }

  /**
   * @notice Computes the new emission rate of a cover,
   * the emmission rate is the daily cost of a cover in the pool.
   *
   * @param oldEmissionRate_ The emission rate of the cover before the change
   * @param oldPremiumRate_ The premium rate of the cover before the change
   * @param newPremiumRate_ The premium rate of the cover after the change
   *
   * @return The new emission rate of the cover expressed in tokens/day
   */
  function getEmissionRate(
    uint256 oldEmissionRate_,
    uint256 oldPremiumRate_,
    uint256 newPremiumRate_
  ) private pure returns (uint256) {
    return
      oldEmissionRate_.rayMul(newPremiumRate_).rayDiv(
        oldPremiumRate_
      );
  }

  function getSecondsPerTick(
    uint256 _oldSecondsPerTick,
    uint256 _oldPremiumRate,
    uint256 _newPremiumRate
  ) private pure returns (uint256) {
    return
      _oldSecondsPerTick.rayMul(_oldPremiumRate).rayDiv(
        _newPremiumRate
      );
  }

  function durationSecondsUnit(
    uint256 _premium,
    uint256 _insuredCapital,
    uint256 _premiumRate //Ray
  ) private pure returns (uint256) {
    return
      ((_premium * YEAR * 100) / _insuredCapital).rayDiv(
        _premiumRate
      );
  }

  // returns actual usage rate on capital insured / capital provided for insurance
  function getUtilizationRate(
    uint256 _insuredCapitalToAdd,
    uint256 _insuredCapitalToRemove,
    uint256 _totalInsuredCapital,
    uint256 _availableLiquidity
  ) private pure returns (uint256 rate) {
    if (_availableLiquidity == 0) {
      return 0;
    }
    rate = (((_totalInsuredCapital + _insuredCapitalToAdd) -
      _insuredCapitalToRemove) * 100).rayDiv(_availableLiquidity);

    /**
     * @dev Utilization rate is capped at 100% because in case of overusage the
     * liquidity providers are exposed to the same risk as 100% usage but
     * cover buyers are not fully covered.
     * This means cover buyers only pay for the effective cover they have.
     */
    return
      FULL_UTILIZATION_RATE < rate ? FULL_UTILIZATION_RATE : rate;
  }
}
