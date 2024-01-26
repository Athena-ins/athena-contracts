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
 * - ticks: a tick is a variable time unit expressed in seconds. The first tick is initialized with the tick max value of 86400 seconds (1 day). It can be explained as a variable amount of cover time bought with the premiums. This is why when the pool's usage rises, the current tick's value decreases and conversely when the pool's usage decreases, the tick increases.
 */
library VirtualPool {
  using VirtualPool for VPool;
  using RayMath for uint256;
  using SafeERC20 for IERC20;
  using Tick for mapping(uint32 => uint256[]);
  using TickBitmap for mapping(uint24 => uint256);

  // ======= CONSTANTS ======= //

  uint256 internal constant MAX_SECONDS_PER_TICK = 86400;
  uint256 internal constant FEE_BASE = RayMath.RAY; // RAY = 1e27

  // ======= STRUCTS ======= //

  struct Formula {
    uint256 uOptimal;
    uint256 r0;
    uint256 rSlope1;
    uint256 rSlope2;
  }

  struct Slot0 {
    uint32 tick; // The last tick at which the pool's liquidity was updated
    uint256 secondsPerTick;
    uint256 totalInsuredCapital;
    uint256 remainingCovers;
    uint256 lastUpdateTimestamp;
  }

  struct LpInfo {
    uint256 beginLiquidityIndex;
    uint256 beginClaimIndex;
    uint256 beginRewardIndex;
  }

  struct CoverPremiums {
    uint256 beginPremiumRate;
    uint32 lastTick; // The tick at which the cover will expire
    uint224 coverIdIndex; // CoverId index in its initalization tick's cover array
  }

  struct CoverInfo {
    uint256 premiumsLeft;
    uint256 currentEmissionRate;
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
    mapping(uint24 => uint256) tickBitmap;
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

  // @bw need to update to latests on external reads
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
    self._updateSlot0WhenAvailableLiquidityChange(amount_, 0);

    uint256 beginRewardIndex = self.strategyManager.getRewardIndex(
      self.strategyId
    );

    // This sets the point from which the position earns rewards & is impacted by claims
    // also overwrites previous LpInfo after a withdrawal
    self.lpInfos[tokenId_] = LpInfo({
      beginLiquidityIndex: self.liquidityIndex,
      beginClaimIndex: self.compensationIds.length,
      beginRewardIndex: beginRewardIndex
    });
  }

  function _payRewardsAndFees(
    VPool storage self,
    uint256 rewards_,
    address account_,
    uint256 yieldBonus_
  ) private {
    if (0 < rewards_) {
      uint256 fees = _feeFor(rewards_, self.feeRate, yieldBonus_);
      uint256 net = rewards_ - fees;

      // Pay position owner
      IERC20(self.paymentAsset).safeTransfer(account_, net);
      // Pay treasury
      IERC20(self.paymentAsset).safeTransfer(address(self.dao), fees);
      self.dao.accrueRevenue(self.paymentAsset, fees);
    }
  }

  /// -------- TAKE INTERESTS -------- ///

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
      yieldBonus_
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
    address account_,
    uint256 amount_,
    uint256 yieldBonus_,
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

    // Pay cover rewards and send fees to treasury
    _payRewardsAndFees(
      self,
      info.coverRewards,
      account_,
      yieldBonus_
    );

    // Update liquidity index
    self._updateSlot0WhenAvailableLiquidityChange(
      0,
      info.newUserCapital
    );

    // Check that the pool has enough liquidity to withdraw
    if (
      RayMath.RAY * 100 <
      utilizationRate(
        0,
        0,
        self.slot0.totalInsuredCapital,
        availableLiquidity(self) - info.newUserCapital
      )
    ) revert LiquidityNotAvailable();

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
      utilizationRate(0, 0, totalInsuredCapital, available)
    );

    uint256 beginPremiumRate = getPremiumRate(
      self,
      utilizationRate(coverAmount_, 0, totalInsuredCapital, available)
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
      utilizationRate(0, 0, totalInsuredCapital, available)
    );
    uint256 newPremiumRate = getPremiumRate(
      self,
      utilizationRate(0, coverAmount_, totalInsuredCapital, available)
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
      self.replaceAndRemoveCoverId(
        coverId_,
        self.ticks.getLastCoverIdInTick(coverPremium.lastTick)
      );

      self.ticks.removeCoverId(
        coverPremium.coverIdIndex,
        coverPremium.lastTick
      );
    } else {
      _removeTick(self, coverPremium.lastTick);
    }
  }

  // ======= INTERNAL POOL HELPERS ======= //

  function replaceAndRemoveCoverId(
    VPool storage self,
    uint256 coverIdToRemove,
    uint256 coverIdToReplace
  ) internal {
    if (coverIdToRemove != coverIdToReplace) {
      self.coverPremiums[coverIdToReplace].coverIdIndex = self
        .coverPremiums[coverIdToRemove]
        .coverIdIndex;
    }

    delete self.coverPremiums[coverIdToRemove];
  }

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

  function _updateSlot0WhenAvailableLiquidityChange(
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
      utilizationRate(0, 0, totalInsured, available)
    );
    uint256 newPremiumRate = getPremiumRate(
      self,
      utilizationRate(
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
      (
        Slot0 memory slot0,
        uint256 liquidityIndex
      ) = _actualizingUntil(self, block.timestamp);

      uint32 observedTick = self.slot0.tick;
      bool isInitialized;
      while (observedTick < slot0.tick) {
        (observedTick, isInitialized) = self
          .tickBitmap
          .nextInitializedTickInTheRightWithinOneWord(observedTick);

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
      ? _actualizingUntil(self, block.timestamp)
      : (self.slot0, 0);
    CoverPremiums storage coverPremium = self.coverPremiums[coverId_];

    if (coverPremium.lastTick < slot0.tick) {
      // If the cover's last tick is overtaken then it's expired and all values are 0
      return CoverInfo({ premiumsLeft: 0, currentEmissionRate: 0 });
    } else {
      uint256 available = availableLiquidity(self);
      uint256 coverBeginEmissionRate = self
        .coverSize(coverId_)
        .rayMul(coverPremium.beginPremiumRate / 100) / 365;
      uint256 currentPremiumRate = getPremiumRate(
        self,
        utilizationRate(0, 0, slot0.totalInsuredCapital, available)
      );

      info.currentEmissionRate = getEmissionRate(
        coverBeginEmissionRate,
        coverPremium.beginPremiumRate,
        currentPremiumRate
      );

      uint256 coverCurrentEmissionRate = info.currentEmissionRate;
      uint32 currentTick = slot0.tick;

      while (currentTick < coverPremium.lastTick) {
        (uint32 tickNext, bool initialized) = self
          .tickBitmap
          .nextInitializedTickInTheRightWithinOneWord(currentTick);

        {
          uint32 tick = tickNext < coverPremium.lastTick
            ? tickNext
            : coverPremium.lastTick;
          uint256 secondsPassed = (tick - currentTick) *
            slot0.secondsPerTick;

          info.premiumsLeft +=
            (secondsPassed * coverCurrentEmissionRate) /
            MAX_SECONDS_PER_TICK;

          currentTick = tick;
        }

        if (initialized && tickNext < coverPremium.lastTick) {
          _crossingInitializedTick(self, slot0, available, tickNext);

          currentPremiumRate = getPremiumRate(
            self,
            utilizationRate(
              0,
              0,
              slot0.totalInsuredCapital,
              available
            )
          );

          coverCurrentEmissionRate = getEmissionRate(
            coverBeginEmissionRate,
            coverPremium.beginPremiumRate,
            currentPremiumRate
          );
        }
      }
    }
  }

  function _crossingInitializedTick(
    VPool storage self,
    Slot0 memory _slot0,
    uint256 _availableLiquidity,
    uint32 _tick
  ) private view {
    uint256[] memory coverIds = self.ticks[_tick];
    uint256 __insuredCapitalToRemove;

    for (uint256 i; i < coverIds.length; i++) {
      uint256 coverId = coverIds[i];

      __insuredCapitalToRemove += self.coverSize(coverId);
    }

    uint256 __currentPremiumRate = getPremiumRate(
      self,
      utilizationRate(
        0,
        0,
        _slot0.totalInsuredCapital,
        _availableLiquidity
      )
    );

    uint256 __newPremiumRate = getPremiumRate(
      self,
      utilizationRate(
        0,
        __insuredCapitalToRemove,
        _slot0.totalInsuredCapital,
        _availableLiquidity
      )
    );

    _slot0.secondsPerTick = getSecondsPerTick(
      _slot0.secondsPerTick,
      __currentPremiumRate,
      __newPremiumRate
    );

    _slot0.totalInsuredCapital -= __insuredCapitalToRemove;
    _slot0.remainingCovers -= coverIds.length;
  }

  function _actualizingUntil(
    VPool storage self,
    uint256 _dateInSeconds
  )
    private
    view
    returns (Slot0 memory __slot0, uint256 __liquidityIndex)
  {
    __slot0 = Slot0({
      tick: self.slot0.tick,
      secondsPerTick: self.slot0.secondsPerTick,
      totalInsuredCapital: self.slot0.totalInsuredCapital,
      remainingCovers: self.slot0.remainingCovers,
      lastUpdateTimestamp: self.slot0.lastUpdateTimestamp
    });

    __liquidityIndex = self.liquidityIndex;

    uint256 __availableLiquidity = availableLiquidity(self);
    uint256 __secondsGap = _dateInSeconds -
      __slot0.lastUpdateTimestamp;

    uint256 __uRate = utilizationRate(
      0,
      0,
      __slot0.totalInsuredCapital,
      __availableLiquidity
    ) / 100;

    uint256 __pRate = getPremiumRate(self, __uRate * 100) / 100;

    while (0 < __secondsGap) {
      (uint32 __tickNext, bool __initialized) = self
        .tickBitmap
        .nextInitializedTickInTheRightWithinOneWord(__slot0.tick);

      uint256 __secondsStep = (__tickNext - __slot0.tick) *
        __slot0.secondsPerTick;

      if (__secondsStep <= __secondsGap) {
        __slot0.tick = __tickNext;
        __liquidityIndex +=
          (__uRate.rayMul(__pRate) * __secondsStep) /
          31536000;
        __secondsGap -= __secondsStep;

        if (__initialized) {
          _crossingInitializedTick(
            self,
            __slot0,
            __availableLiquidity,
            __tickNext
          );

          __uRate =
            utilizationRate(
              0,
              0,
              __slot0.totalInsuredCapital,
              __availableLiquidity
            ) /
            100;

          __pRate = getPremiumRate(self, __uRate * 100) / 100;
        }
      } else {
        __slot0.tick += uint32(__secondsGap / __slot0.secondsPerTick);
        __liquidityIndex +=
          (__uRate.rayMul(__pRate) * __secondsGap) /
          31536000;
        __secondsGap = 0;
      }
    }

    __slot0.lastUpdateTimestamp = _dateInSeconds;
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
          info.newLpInfo.beginRewardIndex,
          comp.rewardIndexBeforeClaim
        );

        // Register up to where the rewards have been accumulated
        info.newLpInfo.beginRewardIndex = comp.rewardIndexBeforeClaim;
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
      info.newLpInfo.beginRewardIndex,
      latestRewardIndex
    );
    info.coverRewards += info.newUserCapital.rayMul(
      self.liquidityIndex - info.newLpInfo.beginLiquidityIndex
    );

    info.newLpInfo.beginRewardIndex = latestRewardIndex;
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
    // @bw case for overusage ? see utilizationRate
    if (utilizationRate_ < formula.uOptimal) {
      return
        formula.r0 +
        formula.rSlope1.rayMul(
          utilizationRate_.rayDiv(formula.uOptimal)
        );
    } else {
      return
        formula.r0 +
        formula.rSlope1 +
        (formula.rSlope2 * (utilizationRate_ - formula.uOptimal)) /
        (100 * RayMath.RAY - formula.uOptimal) /
        100;
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
    //31536000 * 100 = (365 * 24 * 60 * 60) * 100 // total seconds per year * 100
    return
      ((_premium * 3153600000) / _insuredCapital).rayDiv(
        _premiumRate
      );
  }

  // returns actual usage rate on capital insured / capital provided for insurance
  function utilizationRate(
    uint256 _insuredCapitalToAdd,
    uint256 _insuredCapitalToRemove,
    uint256 _totalInsuredCapital,
    uint256 _availableLiquidity
  ) private pure returns (uint256) {
    if (_availableLiquidity == 0) {
      return 0;
    }
    uint256 rate = (((_totalInsuredCapital + _insuredCapitalToAdd) -
      _insuredCapitalToRemove) * 100).rayDiv(_availableLiquidity);

    //  @bw problem if usage is above 100% (ex: 100$ insured and 1$ capital)
    // In this case the usage should be ajusted to reflect available capital
    // The ratio should be slightly favorable for liquidity provider to incentivise equilibrium
    // Special rules for +100% -> adapt uRate to be based on capital + bonus to incentivize provider
    // 100% = 100 1e27 (rays)

    return rate;
  }
}
