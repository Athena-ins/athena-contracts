// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Libs
import { RayMath } from "../../libs/RayMath.sol";
import { Tick } from "../../libs/Tick.sol";
import { TickBitmap } from "../../libs/TickBitmap.sol";
import { PremiumPosition } from "../../libs/PremiumPosition.sol";
// Interfaces
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ======= ERRORS ======= //

error ZeroAddressAsset();

library VirtualPool {
  using RayMath for uint256;
  using SafeERC20 for IERC20;
  using Tick for mapping(uint32 => uint256[]);
  using TickBitmap for mapping(uint24 => uint256);
  using PremiumPosition for mapping(uint256 => PremiumPosition.Info);

  // ======= VIRTUAL STORAGE ======= //

  struct Formula {
    uint256 uOptimal;
    uint256 r0;
    uint256 rSlope1;
    uint256 rSlope2;
  }

  struct Slot0 {
    uint32 tick;
    uint256 secondsPerTick;
    uint256 totalInsuredCapital;
    uint256 remainingPolicies;
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
    uint256 aaveReserveNormalizedIncomeBeforeClaim;
  }

  struct VPool {
    uint128 poolId;
    uint256 protocolShare; // amount of fees on rewards
    Formula f;
    Slot0 slot0;
    uint256 liquidityIndex;
    address underlyingAsset; // @bw to be replaced by strat id
    bool isPaused;
    /// @dev poolId 0 -> poolId 0 points to a pool's available liquidity
    /// @dev liquidity overlap is always registered in the lower poolId
    // Maps poolId 0 -> poolId 1 -> overlapping capital
    mapping(uint128 _poolId => uint256 _amount) overlaps;
    uint128[] overlappedPools;
    mapping(uint256 => LPInfo _lpInfo) lpInfos;
    mapping(uint24 => uint256) tickBitmap;
    // Maps a tick to the list of cover IDs
    mapping(uint32 _tick => uint256[] _coverIds) ticks;
    // Maps a cover ID to the premium position of the cover
    mapping(uint256 _coverId => PremiumPosition.Info _premiumsInfo) premiumPositions;
    PoolClaim[] processedClaims; // @bw should change to ids to fetch in map to use storage pointers
  }

  // ======= VIRTUAL CONSTRUCTOR ======= //

  function _vPoolConstructor(
    VPool storage self,
    uint128 poolId,
    address underlyingAsset_,
    uint256 protocolShare_, //Ray
    uint256 uOptimal_, //Ray
    uint256 r0_, //Ray
    uint256 rSlope1_, //Ray
    uint256 rSlope2_ //Ray
  ) internal {
    if (underlyingAsset_ == address(0)) {
      revert ZeroAddressAsset();
    }

    self.poolId = poolId;
    self.underlyingAsset = underlyingAsset_;
    self.protocolShare = protocolShare_;

    self.f = Formula({
      uOptimal: uOptimal_,
      r0: r0_,
      rSlope1: rSlope1_,
      rSlope2: rSlope2_
    });

    self.slot0.secondsPerTick = 86400;
    self.slot0.lastUpdateTimestamp = block.timestamp;

    self.overlappedPools[0] = poolId;
    self.overlaps[poolId] = 1; // 1 wei
  }

  // ======= READ METHODS ======= //

  // @bw ex: availableCapital
  function availableLiquidity(
    VPool storage self
  ) public view returns (uint256) {
    return self.overlaps[self.poolId];
  }

  // ======= LIQUIDITY ======= //

  function _depositToPool(
    VPool storage self,
    uint256 tokenId_,
    uint256 amount_
  ) external {
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
    uint128[] calldata _poolIds,
    uint256 _feeRate
  ) public returns (uint256, uint256) {
    (
      uint256 __newUserCapital,
      uint256 __totalRewards,
      LPInfo memory __newLPInfo,
      uint256 __aaveScaledBalanceToRemove
    ) = _actualizingLPInfoWithClaims(
        tokenId_,
        _userCapital,
        _poolIds
      );

    uint256 __liquidityIndex = liquidityIndex;

    __totalRewards += __newUserCapital.rayMul(
      __liquidityIndex - __newLPInfo.beginLiquidityIndex
    );

    __newLPInfo.beginLiquidityIndex = __liquidityIndex;

    // transfer to account:
    uint256 __interestNet = (__totalRewards * (1000 - _feeRate)) /
      1000;
    // @bw here should safe to position instead of initiating transfer when called for fee update
    IERC20(underlyingAsset).safeTransfer(account_, __interestNet);

    // transfer to treasury
    // @bw FEE WARN! core has no way of using funds
    IERC20(underlyingAsset).safeTransfer(
      core,
      __totalRewards - __interestNet
    );

    LPsInfo[tokenId_] = __newLPInfo;

    emit TakeInterest(
      tokenId_,
      __newUserCapital,
      __totalRewards,
      __interestNet,
      __totalRewards - __interestNet
    );

    return (__newUserCapital, __aaveScaledBalanceToRemove);
  }

  /// -------- WITHDRAW -------- ///

  function _withdrawLiquidity(
    VPool storage self,
    address account_,
    uint256 tokenId_,
    uint256 _userCapital,
    uint128[] calldata _poolIds,
    uint128 _feeRate
  ) external returns (uint256, uint256) {
    require(
      _utilisationRate(
        0,
        0,
        slot0.totalInsuredCapital,
        availableLiquidity - _userCapital
      ) <= RayMath.RAY * 100,
      "PP: use rate > 100%"
    );

    (
      // The initial capital impacted by the claims
      uint256 __newUserCapital,
      // The rewards earned through premiums
      uint256 __totalRewards,
      LPInfo memory __newLPInfo,
      uint256 __aaveScaledBalanceToRemove
    ) = _actualizingLPInfoWithClaims(
        tokenId_,
        _userCapital,
        _poolIds
      );

    // Add investment strategy rewards
    __totalRewards += __newUserCapital.rayMul(
      liquidityIndex - __newLPInfo.beginLiquidityIndex
    );

    // Remove protocol fees from rewards
    uint256 __rewardsNet;
    if (__totalRewards > 0) {
      __rewardsNet = (__totalRewards * (1000 - _feeRate)) / 1000;
      IERC20(underlyingAsset).safeTransfer(account_, __rewardsNet);
      // @bw FEES are sent to core here
      IERC20(underlyingAsset).safeTransfer(
        core,
        __totalRewards - __rewardsNet
      );
    }

    _updateSlot0WhenAvailableLiquidityChange(0, __newUserCapital);

    for (uint256 i = 0; i < _poolIds.length; i++) {
      intersectingAmounts[
        intersectingAmountIndexes[_poolIds[i]]
      ] -= __newUserCapital;
    }

    availableLiquidity -= __newUserCapital;

    emit WithdrawLiquidity(
      tokenId_,
      __newUserCapital,
      __totalRewards,
      __rewardsNet,
      __totalRewards - __rewardsNet
    );

    delete LPsInfo[tokenId_];

    return (__newUserCapital, __aaveScaledBalanceToRemove);
  }

  // ======= COVERS ======= //

  function _addPremiumPosition(
    VPool storage self,
    uint256 _tokenId,
    uint256 _beginPremiumRate,
    uint32 _tick
  ) private {
    uint224 nbCoversInTick = ticks.addCoverId(_tokenId, _tick);

    premiumPositions[_tokenId] = PremiumPosition.Info(
      _beginPremiumRate,
      _tick,
      nbCoversInTick
    );

    if (!tickBitmap.isInitializedTick(_tick)) {
      tickBitmap.flipTick(_tick);
    }
  }

  function _buyPolicy(
    VPool storage self,
    uint256 _tokenId,
    uint256 _premium,
    uint256 _insuredCapital
  ) private {
    uint256 _availableLiquidity = availableLiquidity;
    uint256 totalInsuredCapital = slot0.totalInsuredCapital;

    require(
      totalInsuredCapital + _insuredCapital < _availableLiquidity,
      "Insufficient capital"
    );

    uint256 __currentPremiumRate = getPremiumRate(
      _utilisationRate(0, 0, totalInsuredCapital, _availableLiquidity)
    );

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        _insuredCapital,
        0,
        totalInsuredCapital,
        _availableLiquidity
      )
    );

    uint256 __durationInSeconds = durationSecondsUnit(
      _premium,
      _insuredCapital,
      __newPremiumRate
    );

    uint256 __newSecondsPerTick = getSecondsPerTick(
      slot0.secondsPerTick,
      __currentPremiumRate,
      __newPremiumRate
    );

    require(
      __durationInSeconds >= __newSecondsPerTick,
      "Min duration"
    );

    uint32 __lastTick = slot0.tick +
      uint32(__durationInSeconds / __newSecondsPerTick);

    addPremiumPosition(_tokenId, __newPremiumRate, __lastTick);

    slot0.totalInsuredCapital += _insuredCapital;
    slot0.secondsPerTick = __newSecondsPerTick;

    slot0.remainingPolicies++;
  }

  function _withdrawPolicy(
    VPool storage self,
    uint256 coverId,
    uint256 _amountCovered
  ) private returns (uint256 __remainedPremium) {
    PremiumPosition.Info memory __position = premiumPositions[
      coverId
    ];
    uint32 __currentTick = slot0.tick;

    require(__currentTick <= __position.lastTick, "Policy Expired");

    uint256 __totalInsuredCapital = slot0.totalInsuredCapital;
    uint256 __availableLiquidity = availableLiquidity;

    uint256 __currentPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        0,
        __totalInsuredCapital,
        __availableLiquidity
      )
    );

    uint256 __ownerCurrentEmissionRate = getEmissionRate(
      _amountCovered.rayMul(__position.beginPremiumRate / 100) / 365,
      __position.beginPremiumRate,
      __currentPremiumRate
    );

    __remainedPremium =
      ((__position.lastTick - __currentTick) *
        slot0.secondsPerTick *
        __ownerCurrentEmissionRate) /
      86400;

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        _amountCovered,
        __totalInsuredCapital,
        __availableLiquidity
      )
    );

    slot0.totalInsuredCapital -= _amountCovered;

    slot0.secondsPerTick = getSecondsPerTick(
      slot0.secondsPerTick,
      __currentPremiumRate,
      __newPremiumRate
    );

    if (ticks.getCoverIdNumber(__position.lastTick) > 1) {
      premiumPositions.replaceAndRemoveCoverId(
        coverId,
        ticks.getLastCoverIdInTick(__position.lastTick)
      );

      ticks.removeCoverId(
        __position.coverIdIndex,
        __position.lastTick
      );
    } else {
      removeTick(__position.lastTick);
    }

    slot0.remainingPolicies--;
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

  function _removeTick(
    VPool storage self,
    uint32 _tick
  ) private returns (uint256[] memory coverIds) {
    coverIds = ticks[_tick];

    for (uint256 i = 0; i < coverIds.length; i++) {
      uint256 coverId = coverIds[i];
      delete premiumPositions[coverId];

      emit ExpiredPolicy(coverId, _tick);
    }

    ticks.clear(_tick);
    tickBitmap.flipTick(_tick);
  }

  function _updateSlot0WhenAvailableLiquidityChange(
    VPool storage self,
    uint256 _amountToAdd,
    uint256 _amountToRemove
  ) private {
    uint256 available = self.availableLiquidity();
    uint256 totalInsured = self.slot0.totalInsuredCapital;

    uint256 currentPremiumRate = self.getPremiumRate(
      utilisationRate(0, 0, totalInsured, available)
    );

    uint256 newPremiumRate = self.getPremiumRate(
      utilisationRate(
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
  ) private returns (uint256[] memory) {
    if (slot0.remainingPolicies > 0) {
      (
        Slot0 memory __slot0,
        uint256 __liquidityIndex
      ) = _actualizingUntil(block.timestamp);

      //now, we remove all crossed ticks
      uint256[] memory __expiredPoliciesTokens = new uint256[](
        slot0.remainingPolicies - __slot0.remainingPolicies
      );
      uint256 __expiredPoliciesTokenIdCurrentIndex;

      uint32 __observedTick = slot0.tick;
      bool __initialized;
      while (__observedTick < __slot0.tick) {
        (__observedTick, __initialized) = tickBitmap
          .nextInitializedTickInTheRightWithinOneWord(__observedTick);

        if (__initialized && __observedTick <= __slot0.tick) {
          uint256[]
            memory __currentExpiredPoliciesTokenId = removeTick(
              __observedTick
            );

          for (
            uint256 i = 0;
            i < __currentExpiredPoliciesTokenId.length;
            i++
          ) {
            __expiredPoliciesTokens[
              __expiredPoliciesTokenIdCurrentIndex
            ] = __currentExpiredPoliciesTokenId[i];

            __expiredPoliciesTokenIdCurrentIndex++;
          }
        }
      }

      slot0.tick = __slot0.tick;
      slot0.secondsPerTick = __slot0.secondsPerTick;
      slot0.totalInsuredCapital = __slot0.totalInsuredCapital;
      slot0.remainingPolicies = __slot0.remainingPolicies;
      slot0.lastUpdateTimestamp = block.timestamp;
      liquidityIndex = __liquidityIndex;

      return __expiredPoliciesTokens;
    }

    slot0.lastUpdateTimestamp = block.timestamp;
    return new uint256[](0);
  }

  // ======= VIEW HELPERS ======= //

  function _actualizingUntilGivenDate(
    VPool storage self,
    uint256 _dateInSeconds
  )
    public
    view
    returns (Slot0 memory __slot0, uint256 __liquidityIndex)
  {
    require(
      _dateInSeconds >= slot0.lastUpdateTimestamp,
      "date is not valide"
    );

    if (slot0.remainingPolicies > 0) {
      (__slot0, __liquidityIndex) = _actualizingUntil(_dateInSeconds);
    } else {
      __slot0 = slot0;
      __slot0.lastUpdateTimestamp = _dateInSeconds;
    }
  }

  function _getInfo(
    VPool storage self,
    uint256 coverId_
  )
    public
    view
    returns (
      uint256 __premiumLeft,
      uint256 __currentEmissionRate,
      uint256 __remainingSeconds
    )
  {
    uint256 __availableLiquidity = availableLiquidity;
    (Slot0 memory __slot0, ) = _actualizingUntil(block.timestamp);
    PremiumPosition.Info memory __position = premiumPositions[
      coverId_
    ];

    if (__position.lastTick < __slot0.tick) {
      /// @dev If the tick in slot0 is greater than the position's last tick then the policy is expired
      __premiumLeft = 0;
      __currentEmissionRate = 0;
      __remainingSeconds = 0;
    } else {
      uint256 __coverBeginEmissionRate = policyManagerInterface
        .policy(coverId_)
        .amountCovered
        .rayMul(__position.beginPremiumRate / 100) / 365;

      uint256 __currentPremiumRate = getPremiumRate(
        _utilisationRate(
          0,
          0,
          __slot0.totalInsuredCapital,
          __availableLiquidity
        )
      );

      __currentEmissionRate = getEmissionRate(
        __coverBeginEmissionRate,
        __position.beginPremiumRate,
        __currentPremiumRate
      );

      uint256 __coverCurrentEmissionRate = __currentEmissionRate;

      while (__slot0.tick < __position.lastTick) {
        (uint32 __tickNext, bool __initialized) = tickBitmap
          .nextInitializedTickInTheRightWithinOneWord(__slot0.tick);

        uint32 __tick = __tickNext < __position.lastTick
          ? __tickNext
          : __position.lastTick;
        uint256 __secondsPassed = (__tick - __slot0.tick) *
          __slot0.secondsPerTick;

        __premiumLeft +=
          (__secondsPassed * __coverCurrentEmissionRate) /
          86400;

        __remainingSeconds += __secondsPassed;

        __slot0.tick = __tick;

        if (__initialized && __tickNext < __position.lastTick) {
          crossingInitializedTick(
            __slot0,
            __availableLiquidity,
            __tickNext
          );

          __currentPremiumRate = getPremiumRate(
            _utilisationRate(
              0,
              0,
              __slot0.totalInsuredCapital,
              __availableLiquidity
            )
          );

          __coverCurrentEmissionRate = getEmissionRate(
            __coverBeginEmissionRate,
            __position.beginPremiumRate,
            __currentPremiumRate
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
    uint256[] memory coverIds = ticks[_tick];
    uint256 __insuredCapitalToRemove;

    for (uint256 i = 0; i < coverIds.length; i++) {
      uint256 coverId = coverIds[i];

      __insuredCapitalToRemove += policyManagerInterface
        .policy(coverId)
        .amountCovered;
    }

    uint256 __currentPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        0,
        _slot0.totalInsuredCapital,
        _availableLiquidity
      )
    );

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
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
    _slot0.remainingPolicies -= coverIds.length;
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
      tick: slot0.tick,
      secondsPerTick: slot0.secondsPerTick,
      totalInsuredCapital: slot0.totalInsuredCapital,
      remainingPolicies: slot0.remainingPolicies,
      lastUpdateTimestamp: slot0.lastUpdateTimestamp
    });

    __liquidityIndex = liquidityIndex;

    uint256 __availableLiquidity = availableLiquidity;
    uint256 __secondsGap = _dateInSeconds -
      __slot0.lastUpdateTimestamp;

    uint256 __uRate = _utilisationRate(
      0,
      0,
      __slot0.totalInsuredCapital,
      __availableLiquidity
    ) / 100;

    uint256 __pRate = getPremiumRate(__uRate * 100) / 100;

    while (__secondsGap > 0) {
      (uint32 __tickNext, bool __initialized) = tickBitmap
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
          crossingInitializedTick(
            __slot0,
            __availableLiquidity,
            __tickNext
          );

          __uRate =
            _utilisationRate(
              0,
              0,
              __slot0.totalInsuredCapital,
              __availableLiquidity
            ) /
            100;

          __pRate = getPremiumRate(__uRate * 100) / 100;
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
    uint128[] calldata _poolIds
  )
    private
    view
    returns (
      uint256 __newUserCapital,
      uint256 __totalRewards,
      LPInfo memory __newLPInfo,
      uint256 __aaveScaledBalanceToRemove
    )
  {
    __newLPInfo = LPsInfo[tokenId_];
    Claim[] memory __claims = _claims(__newLPInfo.beginClaimIndex);

    __newUserCapital = _userCapital;

    for (uint256 i = 0; i < __claims.length; i++) {
      Claim memory __claim = __claims[i];

      __totalRewards += __newUserCapital.rayMul(
        __claim.liquidityIndexBeforeClaim -
          __newLPInfo.beginLiquidityIndex
      );

      for (uint256 j = 0; j < _poolIds.length; j++) {
        if (_poolIds[j] == __claim.fromPoolId) {
          uint256 capitalToRemove = __newUserCapital.rayMul(
            __claim.ratio
          );

          __aaveScaledBalanceToRemove += capitalToRemove.rayDiv(
            __claim.aaveReserveNormalizedIncomeBeforeClaim
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
    uint128[] calldata _poolIds,
    uint256 _feeRate,
    uint256 _dateInSecond
  )
    public
    view
    override
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
      tokenId_,
      _userCapital,
      _poolIds
    );

    uint256 __liquidityIndex;

    if (slot0.remainingPolicies > 0) {
      (, __liquidityIndex) = _actualizingUntil(_dateInSecond);
    } else {
      __liquidityIndex = liquidityIndex;
    }

    __totalRewards += __newUserCapital.rayMul(
      __liquidityIndex - __newLPInfo.beginLiquidityIndex
    );

    __totalRewards = (__totalRewards * (1000 - _feeRate)) / 1000;

    __newLPInfo.beginLiquidityIndex = __liquidityIndex;
  }

  function getPremiumRate(
    VPool storage self,
    uint256 utilisationRate_
  ) private view returns (uint256) {
    Formula storage f = self.f;
    // returns actual rate for insurance
    // @bw case for overusage ?
    if (utilisationRate_ < f.uOptimal) {
      return
        f.r0 + f.rSlope1.rayMul(utilisationRate_.rayDiv(f.uOptimal));
    } else {
      return
        f.r0 +
        f.rSlope1 +
        (f.rSlope2 * (utilisationRate_ - f.uOptimal)) /
        (100 * RayMath.RAY - f.uOptimal) /
        100;
    }
  }

  // ======= PURE HELPERS ======= //

  function getEmissionRate(
    uint256 _oldEmissionRate,
    uint256 _oldPremiumRate,
    uint256 _newPremiumRate
  ) private pure returns (uint256) {
    return
      _oldEmissionRate.rayMul(_newPremiumRate).rayDiv(
        _oldPremiumRate
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
  function utilisationRate(
    uint256 _insuredCapitalToAdd,
    uint256 _insuredCapitalToRemove,
    uint256 _totalInsuredCapital,
    uint256 _availableLiquidity
  ) private pure returns (uint256) {
    if (_availableLiquidity == 0) {
      return 0;
    }
    uint256 utilizationRate = (((_totalInsuredCapital +
      _insuredCapitalToAdd) - _insuredCapitalToRemove) * 100).rayDiv(
        _availableLiquidity
      );

    //  @bw problem if usage is above 100% (ex: 100$ insured and 1$ capital)
    // In this case the usage should be ajusted to reflect available capital
    // The ratio should be slightly favorable for liquidity provider to incentivise equilibrium
    // Special rules for +100% -> adapt uRate to be based on capital + bonus to incentivize provider
    // 100% = 100 1e27 (rays)

    return utilizationRate;
  }
}
