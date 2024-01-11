// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Libraries
import { RayMath } from "../libs/RayMath.sol";
import { Tick } from "../libs/Tick.sol";
import { TickBitmap } from "../libs/TickBitmap.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ======= ERRORS ======= //

error ZeroAddressAsset();
error UpdateMustBeGreaterThanLast();
error CoverAlreadyExpired();
error DurationTooLow();
error InsufficientCapacity();
error LiquidityNotAvailable();

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

  struct LPInfo {
    uint256 beginLiquidityIndex;
    uint256 beginClaimIndex;
  }

  struct PoolClaim {
    uint128 fromPoolId;
    uint256 ratio; // Ray //ratio = claimAmount / capital
    uint256 liquidityIndexBeforeClaim;
    uint256 rewardIndexBeforeClaim;
  }

  struct CoverPremiums {
    uint256 beginPremiumRate;
    uint32 lastTick; // The tick at which the cover will expire
    uint224 coverIdIndex; // CoverId index in its initalization tick's cover array
  }

  struct CoverInfo {
    uint256 premiumsLeft;
    uint256 currentEmissionRate;
    uint256 remainingSeconds;
  }

  // ======= VIRTUAL STORAGE ======= //

  struct VPoolInfo {
    uint128 poolId;
    uint256 protocolShare;
    Formula formula;
    Slot0 slot0;
    uint256 liquidityIndex;
    uint256 strategyId;
    address paymentAsset;
    address underlyingAsset;
    address wrappedAsset;
    bool isPaused;
    uint128[] overlappedPools;
    PoolClaim[] processedClaims;
  }

  struct VPool {
    uint128 poolId;
    uint256 protocolShare; // amount of fees on premiums
    Formula formula;
    Slot0 slot0;
    uint256 liquidityIndex;
    uint256 strategyId;
    address paymentAsset; // asset used to pay LP premiums
    address underlyingAsset; // asset required by the strategy
    address wrappedAsset; // tokenised strategy shares (ex: aTokens)
    bool isPaused;
    uint128[] overlappedPools;
    // @bw should change to ids to fetch in map to use storage pointers
    PoolClaim[] processedClaims;
    /// @dev poolId 0 -> poolId 0 points to a pool's available liquidity
    /// @dev liquidity overlap is always registered in the lower poolId
    // Maps poolId 0 -> poolId 1 -> overlapping capital
    mapping(uint128 _poolId => uint256 _amount) overlaps;
    mapping(uint256 _positionId => LPInfo) lpInfos;
    mapping(uint24 => uint256) tickBitmap;
    // Maps a tick to the list of cover IDs
    mapping(uint32 _tick => uint256[] _coverIds) ticks;
    // Maps a cover ID to the premium position of the cover
    mapping(uint256 _coverId => CoverPremiums) coverPremiums;
    // Function pointers to access child contract data
    function(uint256) view returns (uint256) coverSize;
  }

  // ======= VIRTUAL CONSTRUCTOR ======= //

  struct VPoolConstructorParams {
    uint128 poolId;
    uint256 strategyId;
    address paymentAsset;
    address underlyingAsset;
    address wrappedAsset;
    uint256 protocolShare; //Ray
    uint256 uOptimal; //Ray
    uint256 r0; //Ray
    uint256 rSlope1; //Ray
    uint256 rSlope2; //Ray
    // Function pointer to child contract cover data
    function(uint256) view returns (uint256) coverSize;
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
    self.paymentAsset = params.paymentAsset;
    self.strategyId = params.strategyId;
    self.underlyingAsset = params.underlyingAsset;
    self.wrappedAsset = params.wrappedAsset;
    self.protocolShare = params.protocolShare;

    self.formula = Formula({
      uOptimal: params.uOptimal,
      r0: params.r0,
      rSlope1: params.rSlope1,
      rSlope2: params.rSlope2
    });

    self.slot0.secondsPerTick = MAX_SECONDS_PER_TICK;
    self.slot0.lastUpdateTimestamp = block.timestamp;

    self.overlappedPools.push(params.poolId);
    self.overlaps[params.poolId] = 1; // 1 wei

    self.coverSize = params.coverSize;
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

  // @bw ex: availableCapital
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
    // Add deposit to pool's own intersecting amounts
    self.overlaps[self.poolId] += amount_;

    self._updateSlot0WhenAvailableLiquidityChange(amount_, 0);

    self.lpInfos[tokenId_] = LPInfo({
      beginLiquidityIndex: self.liquidityIndex,
      beginClaimIndex: self.processedClaims.length
    });
  }

  /// -------- TAKE INTERESTS -------- ///

  function _takePoolInterests(
    VPool storage self,
    address account_,
    uint256 tokenId_,
    uint256 _userCapital,
    uint128[] storage _poolIds,
    uint256 _feeRate
  ) internal returns (uint256, uint256) {
    (
      uint256 newUserCapital,
      uint256 totalRewards,
      LPInfo memory newLPInfo,
      uint256 scaledAmountToRemove
    ) = _actualizingLPInfoWithClaims(
        self,
        tokenId_,
        _userCapital,
        _poolIds
      );

    uint256 liquidityIndex = self.liquidityIndex;

    totalRewards += newUserCapital.rayMul(
      liquidityIndex - newLPInfo.beginLiquidityIndex
    );

    // Compute net rewards earned from cover premiums
    uint256 interestNet = (totalRewards * (1000 - _feeRate)) / 1000;

    // @bw check that each pool pays its own fees (can be different tokens)
    // @bw here should safe to position instead of initiating transfer when called for fee update
    // @bw init transfer call in liq manager to strat holding funds
    // IERC20(paymentAsset).safeTransfer(account_,  interestNet);
    // transfer to treasury
    // @bw FEE WARN! core has no way of using funds
    // @bw init transfer call in liq manager to strat holding funds
    // IERC20(paymentAsset).safeTransfer(
    //   core,
    //    totalRewards -  interestNet
    // );

    newLPInfo.beginLiquidityIndex = liquidityIndex;
    self.lpInfos[tokenId_] = newLPInfo;

    return (newUserCapital, scaledAmountToRemove);
  }

  /// -------- WITHDRAW -------- ///

  function _withdrawLiquidity(
    VPool storage self,
    uint128[] storage _poolIds,
    uint256 tokenId_,
    uint256 _userCapital,
    uint256 feeDiscount_
  ) internal returns (uint256, uint256) {
    if (
      RayMath.RAY * 100 <
      utilizationRate(
        0,
        0,
        self.slot0.totalInsuredCapital,
        availableLiquidity(self) - _userCapital
      )
    ) {
      revert LiquidityNotAvailable();
    }

    (
      // The initial capital impacted by the claims
      uint256 __newUserCapital,
      // The rewards earned through premiums
      uint256 __totalRewards,
      LPInfo memory __newLPInfo,
      uint256 __scaledAmountToRemove
    ) = _actualizingLPInfoWithClaims(
        self,
        tokenId_,
        _userCapital,
        _poolIds
      );

    // Add investment strategy rewards
    __totalRewards += __newUserCapital.rayMul(
      self.liquidityIndex - __newLPInfo.beginLiquidityIndex
    );

    // Remove protocol fees from rewards
    // @bw needs to be fixed with pool specific fee - currntly fee rate
    uint256 __rewardsNet;
    if (__totalRewards > 0) {
      __rewardsNet =
        (__totalRewards * (10000 - feeDiscount_)) /
        10000;
      // @bw check that each pool pays its own fees (can be different tokens)
      // @bw init transfer call in liq manager to strat holding funds
      // IERC20(paymentAsset).safeTransfer(account_, __rewardsNet);
      // @bw FEES are sent to core here
      // @bw init transfer call in liq manager to strat holding funds
      // IERC20(paymentAsset).safeTransfer(
      //   core,
      //   __totalRewards - __rewardsNet
      // );
    }

    self._updateSlot0WhenAvailableLiquidityChange(
      0,
      __newUserCapital
    );

    for (uint256 i; i < _poolIds.length; i++) {
      uint128 poolIdB = _poolIds[i];
      // Overlapping liquidity is always registered in poolId 0
      // We allow equal values to withdraw from the pool's own liquidity
      if (poolIdB <= self.poolId)
        self.overlaps[poolIdB] -= __newUserCapital;
    }

    emit WithdrawLiquidity(
      tokenId_,
      __newUserCapital,
      __totalRewards,
      __rewardsNet,
      __totalRewards - __rewardsNet
    );

    delete self.lpInfos[tokenId_];

    return (__newUserCapital, __scaledAmountToRemove);
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
    uint256 _availableLiquidity = availableLiquidity(self);
    uint256 totalInsuredCapital = self.slot0.totalInsuredCapital;

    if (_availableLiquidity < totalInsuredCapital + coverAmount_) {
      revert InsufficientCapacity();
    }

    uint256 __currentPremiumRate = getPremiumRate(
      self,
      utilizationRate(0, 0, totalInsuredCapital, _availableLiquidity)
    );

    uint256 __newPremiumRate = getPremiumRate(
      self,
      utilizationRate(
        coverAmount_,
        0,
        totalInsuredCapital,
        _availableLiquidity
      )
    );

    uint256 __durationInSeconds = durationSecondsUnit(
      premiums_,
      coverAmount_,
      __newPremiumRate
    );

    uint256 __newSecondsPerTick = getSecondsPerTick(
      self.slot0.secondsPerTick,
      __currentPremiumRate,
      __newPremiumRate
    );

    if (__durationInSeconds < __newSecondsPerTick)
      revert DurationTooLow();

    uint32 __lastTick = self.slot0.tick +
      uint32(__durationInSeconds / __newSecondsPerTick);

    _addPremiumPosition(self, coverId_, __newPremiumRate, __lastTick);

    self.slot0.totalInsuredCapital += coverAmount_;
    self.slot0.secondsPerTick = __newSecondsPerTick;

    self.slot0.remainingCovers++;
  }

  /// -------- MODIFY -------- ///

  function _modifyCover(
    VPool storage self,
    uint256 coverId_,
    uint256 coverToAdd_,
    uint256 coverToRemove_,
    uint256 premiumsToAdd_,
    uint256 premiumsToRemove_
  ) internal {
    // @bw need fn to change cover without closing & opening new one
  }

  /// -------- CLOSE -------- ///

  function _closeCover(
    VPool storage self,
    uint256 coverId_,
    uint256 coverAmount_
  ) internal returns (uint256 __remainedPremium) {
    PremiumPosition.Info memory __position = self.premiumPositions[
      coverId_
    ];
    uint32 __currentTick = self.slot0.tick;

    if (__position.lastTick < __currentTick)
      revert CoverAlreadyExpired();

    uint256 __totalInsuredCapital = self.slot0.totalInsuredCapital;
    uint256 __availableLiquidity = availableLiquidity(self);

    uint256 __currentPremiumRate = getPremiumRate(
      self,
      utilizationRate(
        0,
        0,
        __totalInsuredCapital,
        __availableLiquidity
      )
    );

    uint256 __ownerCurrentEmissionRate = getEmissionRate(
      coverAmount_.rayMul(__position.beginPremiumRate / 100) / 365,
      __position.beginPremiumRate,
      __currentPremiumRate
    );

    __remainedPremium =
      ((__position.lastTick - __currentTick) *
        self.slot0.secondsPerTick *
        __ownerCurrentEmissionRate) /
      86400;

    uint256 __newPremiumRate = getPremiumRate(
      self,
      utilizationRate(
        0,
        coverAmount_,
        __totalInsuredCapital,
        __availableLiquidity
      )
    );

    self.slot0.totalInsuredCapital -= coverAmount_;

    self.slot0.secondsPerTick = getSecondsPerTick(
      self.slot0.secondsPerTick,
      __currentPremiumRate,
      __newPremiumRate
    );

    if (self.ticks.getCoverIdNumber(__position.lastTick) > 1) {
      self.premiumPositions.replaceAndRemoveCoverId(
        coverId_,
        self.ticks.getLastCoverIdInTick(__position.lastTick)
      );

      self.ticks.removeCoverId(
        __position.coverIdIndex,
        __position.lastTick
      );
    } else {
      _removeTick(self, __position.lastTick);
    }

    self.slot0.remainingCovers--;
  }

  // ======= CLAIMS ======= //

  function _claims(
    VPool storage self,
    uint256 beginIndex
  ) private view returns (PoolClaim[] memory) {
    uint256 nbProcessed = self.processedClaims.length;
    if (nbProcessed == beginIndex) return new PoolClaim[](0);

    uint256 toProcess = nbProcessed - beginIndex;
    PoolClaim[] memory claims = new PoolClaim[](toProcess);

    for (uint256 i; i < toProcess; i++) {
      claims[i] = self.processedClaims[beginIndex + i];
    }

    return claims;
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

    for (uint256 i = 0; i < coverIds.length; i++) {
      uint256 coverId = coverIds[i];
      delete self.coverPremiums[coverId];

      emit CoverExpired(coverId, _tick);
    }

    self.ticks.clear(_tick);
    self.tickBitmap.flipTick(_tick);
  }

  function _updateSlot0WhenAvailableLiquidityChange(
    VPool storage self,
    uint256 _amountToAdd,
    uint256 _amountToRemove
  ) internal {
    uint256 available = availableLiquidity(self);
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
        available + _amountToAdd - _amountToRemove
      )
    );

    self.slot0.secondsPerTick = getSecondsPerTick(
      self.slot0.secondsPerTick,
      currentPremiumRate,
      newPremiumRate
    );
  }

  function _actualizing(
    VPool storage self
  ) internal returns (uint256[] memory expiredCoverIds) {
    if (self.slot0.remainingCovers > 0) {
      (
        Slot0 memory __slot0,
        uint256 __liquidityIndex
      ) = _actualizingUntil(self, block.timestamp);

      //now, we remove all crossed ticks
      expiredCoverIds = new uint256[](
        self.slot0.remainingCovers - __slot0.remainingCovers
      );
      uint256 index;

      uint32 __observedTick = self.slot0.tick;
      bool __initialized;
      while (__observedTick < __slot0.tick) {
        (__observedTick, __initialized) = self
          .tickBitmap
          .nextInitializedTickInTheRightWithinOneWord(__observedTick);

        if (__initialized && __observedTick <= __slot0.tick) {
          uint256[]
            memory __currentExpiredCoversTokenId = _removeTick(
              self,
              __observedTick
            );

          for (
            uint256 i = 0;
            i < __currentExpiredCoversTokenId.length;
            i++
          ) {
            expiredCoverIds[index] = __currentExpiredCoversTokenId[i];

            index++;
          }
        }
      }

      self.slot0.tick = __slot0.tick;
      self.slot0.secondsPerTick = __slot0.secondsPerTick;
      self.slot0.totalInsuredCapital = __slot0.totalInsuredCapital;
      self.slot0.remainingCovers = __slot0.remainingCovers;
      self.slot0.lastUpdateTimestamp = block.timestamp;
      self.liquidityIndex = __liquidityIndex;
    }

    self.slot0.lastUpdateTimestamp = block.timestamp;
    return expiredCoverIds;
  }

  // ======= VIEW HELPERS ======= //

  function _actualizingUntilGivenDate(
    VPool storage self,
    uint256 _dateInSeconds
  )
    internal
    view
    returns (Slot0 memory __slot0, uint256 __liquidityIndex)
  {
    if (_dateInSeconds < self.slot0.lastUpdateTimestamp)
      revert UpdateMustBeGreaterThanLast();

    if (self.slot0.remainingCovers > 0) {
      (__slot0, __liquidityIndex) = _actualizingUntil(
        self,
        _dateInSeconds
      );
    } else {
      __slot0 = self.slot0;
      __slot0.lastUpdateTimestamp = _dateInSeconds;
    }
  }

  // @bw is used ? Stack too deep err
  // function _getInfo(
  //   VPool storage self,
  //   uint256 coverId_,
  //   address coverManager
  // )
  //   internal
  //   view
  //   returns (
  //     uint256 __premiumLeft,
  //     uint256 __currentEmissionRate,
  //     uint256 __remainingSeconds
  //   )
  // {
  //   uint256 __availableLiquidity = availableLiquidity(self);
  //   (Slot0 memory __slot0, ) = _actualizingUntil(
  //     self,
  //     block.timestamp
  //   );
  //   CoverPremiums  storage coverPremium = self.coverPremiums[
  //     coverId_
  //   ];

  //   if (coverPremium.lastTick < __slot0.tick) {
  //     /// @dev If the tick in slot0 is greater than the position's last tick then the cover is expired
  //     __premiumLeft = 0;
  //     __currentEmissionRate = 0;
  //     __remainingSeconds = 0;
  //   } else {
  //     uint256 __coverBeginEmissionRate = ICoverManager(coverManager)
  //       .getCover(coverId_)
  //       .amountCovered
  //       .rayMul(coverPremium.beginPremiumRate / 100) / 365;

  //     uint256 __currentPremiumRate = getPremiumRate(
  //       self,
  //       utilizationRate(
  //         0,
  //         0,
  //         __slot0.totalInsuredCapital,
  //         __availableLiquidity
  //       )
  //     );

  //     __currentEmissionRate = getEmissionRate(
  //       __coverBeginEmissionRate,
  //       coverPremium.beginPremiumRate,
  //       __currentPremiumRate
  //     );

  //     uint256 __coverCurrentEmissionRate = __currentEmissionRate;

  //     while (__slot0.tick < coverPremium.lastTick) {
  //       (uint32 __tickNext, bool __initialized) = self
  //         .tickBitmap
  //         .nextInitializedTickInTheRightWithinOneWord(__slot0.tick);

  //       {
  //         uint32 __tick = __tickNext < coverPremium.lastTick
  //           ? __tickNext
  //           : coverPremium.lastTick;
  //         uint256 __secondsPassed = (__tick - __slot0.tick) *
  //           __slot0.secondsPerTick;

  //         __premiumLeft +=
  //           (__secondsPassed * __coverCurrentEmissionRate) /
  //           SECONDS_PER_TICK;

  //         __remainingSeconds += __secondsPassed;

  //         __slot0.tick = __tick;
  //       }

  //       if (__initialized && __tickNext < coverPremium.lastTick) {
  //         _crossingInitializedTick(
  //           self,
  //           __slot0,
  //           __availableLiquidity,
  //           __tickNext
  //         );

  //         __currentPremiumRate = getPremiumRate(
  //           self,
  //           utilizationRate(
  //             0,
  //             0,
  //             __slot0.totalInsuredCapital,
  //             __availableLiquidity
  //           )
  //         );

  //         __coverCurrentEmissionRate = getEmissionRate(
  //           __coverBeginEmissionRate,
  //           coverPremium.beginPremiumRate,
  //           __currentPremiumRate
  //         );
  //       }
  //     }
  //   }
  // }

  function _crossingInitializedTick(
    VPool storage self,
    Slot0 memory _slot0,
    uint256 _availableLiquidity,
    uint32 _tick
  ) private view {
    uint256[] memory coverIds = self.ticks[_tick];
    uint256 __insuredCapitalToRemove;

    for (uint256 i = 0; i < coverIds.length; i++) {
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

    while (__secondsGap > 0) {
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

  // @bw high gas consumpton - only place saved claims are consummed
  function _actualizingLPInfoWithClaims(
    VPool storage self,
    uint256 tokenId_,
    uint256 _userCapital,
    uint128[] storage _poolIds
  )
    private
    view
    returns (
      uint256 __newUserCapital,
      uint256 __totalRewards,
      LPInfo memory __newLPInfo,
      uint256 __scaledAmountToRemove
    )
  {
    __newLPInfo = self.lpInfos[tokenId_];
    PoolClaim[] memory __claims = _claims(
      self,
      __newLPInfo.beginClaimIndex
    );

    __newUserCapital = _userCapital;

    for (uint256 i = 0; i < __claims.length; i++) {
      PoolClaim memory __claim = __claims[i];

      __totalRewards += __newUserCapital.rayMul(
        __claim.liquidityIndexBeforeClaim -
          __newLPInfo.beginLiquidityIndex
      );

      for (uint256 j = 0; j < _poolIds.length; j++) {
        if (_poolIds[j] == __claim.fromPoolId) {
          uint256 capitalToRemove = __newUserCapital.rayMul(
            __claim.ratio
          );

          // @bw Check how this impact claim withdraws, should only work with underlying if possible.
          __scaledAmountToRemove += capitalToRemove.rayDiv(
            __claim.rewardIndexBeforeClaim
          );

          __newUserCapital = __newUserCapital - capitalToRemove;
          break;
        }
      }
      __newLPInfo.beginLiquidityIndex = __claim
        .liquidityIndexBeforeClaim;
    }
    __newLPInfo.beginClaimIndex += __claims.length;
  }

  function _rewardsOf(
    VPool storage self,
    uint256 tokenId_,
    uint256 _userCapital,
    uint128[] storage _poolIds,
    uint256 _feeRate,
    uint256 _dateInSecond
  )
    internal
    view
    returns (
      uint256 __newUserCapital,
      uint256 __totalRewards,
      LPInfo memory __newLPInfo
    )
  {
    (
      __newUserCapital,
      __totalRewards,
      __newLPInfo,

    ) = _actualizingLPInfoWithClaims(
      self,
      tokenId_,
      _userCapital,
      _poolIds
    );

    uint256 __liquidityIndex;

    if (self.slot0.remainingCovers > 0) {
      (, __liquidityIndex) = _actualizingUntil(self, _dateInSecond);
    } else {
      __liquidityIndex = self.liquidityIndex;
    }

    __totalRewards += __newUserCapital.rayMul(
      __liquidityIndex - __newLPInfo.beginLiquidityIndex
    );

    __totalRewards = (__totalRewards * (1000 - _feeRate)) / 1000;

    __newLPInfo.beginLiquidityIndex = __liquidityIndex;
  }

  /**
   * @notice Computes the premium rate of a cover,
   * the premium rate represents the premium fees APR paid by a cover buyer
   * in relation to the cover amount.
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
