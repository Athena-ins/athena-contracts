// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./libraries/RayMath.sol";
import "./libraries/Tick.sol";
import "./libraries/TickBitmap.sol";
import "./libraries/PremiumPosition.sol";

import "./interfaces/IAthena.sol";
import "./interfaces/IPolicyManager.sol";
import "./interfaces/IPolicyCover.sol";

import "./ClaimCover.sol";

abstract contract PolicyCover is IPolicyCover, ClaimCover {
  using RayMath for uint256;
  using Tick for mapping(uint32 => address[]);
  using TickBitmap for mapping(uint24 => uint256);
  using PremiumPosition for mapping(address => PremiumPosition.Info);

  address internal immutable core;
  mapping(uint32 => address[]) internal ticks;
  mapping(uint24 => uint256) internal tickBitmap;
  mapping(address => PremiumPosition.Info) public premiumPositions;

  Formula internal f;
  Slot0 public slot0;

  constructor(
    address _core,
    uint256 _uOptimal, //Ray
    uint256 _r0, //Ray
    uint256 _rSlope1, //Ray
    uint256 _rSlope2 //Ray
  ) {
    core = _core;

    f = Formula({
      uOptimal: _uOptimal,
      r0: _r0,
      rSlope1: _rSlope1,
      rSlope2: _rSlope2
    });

    slot0.secondsPerTick = 86400;
    slot0.lastUpdateTimestamp = block.timestamp;
  }

  modifier existedOwner(address _owner) {
    require(premiumPositions.hasOwner(_owner), "Owner Not Exist");
    _;
  }

  modifier notExistedOwner(address _owner) {
    require(!premiumPositions.hasOwner(_owner), "Owner exist");
    _;
  }

  function addPremiumPosition(
    address _owner,
    uint256 _tokenId,
    uint256 _beginPremiumRate,
    uint32 _tick
  ) private {
    premiumPositions[_owner] = PremiumPosition.Info(
      _tokenId,
      _beginPremiumRate,
      _tick,
      ticks.addOwner(_owner, _tick)
    );

    if (!tickBitmap.isInitializedTick(_tick)) {
      tickBitmap.flipTick(_tick);
    }
  }

  function removeTick(uint32 _tick) private returns (uint256[] memory) {
    address[] memory __owners = ticks[_tick];
    uint256[] memory __tokensId = new uint256[](__owners.length);

    IPolicyManager policyManager_ = IPolicyManager(
      IAthena(core).policyManager()
    );
    for (uint256 i = 0; i < __owners.length; i++) {
      uint256 tokenId = premiumPositions.removeOwner(__owners[i]);
      __tokensId[i] = tokenId;

      emit ExpiredPolicy(
        __owners[i],
        policyManager_.policy(tokenId).amountCovered,
        _tick
      );
    }

    ticks.clear(_tick);
    tickBitmap.flipTick(_tick);

    return __tokensId;
  }

  function getPremiumRate(uint256 _utilisationRate)
    internal
    view
    returns (uint256)
  {
    // returns actual rate for insurance
    if (_utilisationRate < f.uOptimal) {
      return f.r0 + f.rSlope1.rayMul(_utilisationRate.rayDiv(f.uOptimal));
    } else {
      return
        f.r0 +
        f.rSlope1 +
        (f.rSlope2 * (_utilisationRate - f.uOptimal)) /
        (100 * RayMath.RAY - f.uOptimal) /
        100;
    }
  }

  function getEmissionRate(
    uint256 _oldEmissionRate,
    uint256 _oldPremiumRate,
    uint256 _newPremiumRate
  ) internal pure returns (uint256) {
    return _oldEmissionRate.rayMul(_newPremiumRate).rayDiv(_oldPremiumRate);
  }

  function getSecondsPerTick(
    uint256 _oldSecondsPerTick,
    uint256 _oldPremiumRate,
    uint256 _newPremiumRate
  ) private pure returns (uint256) {
    return _oldSecondsPerTick.rayMul(_oldPremiumRate).rayDiv(_newPremiumRate);
  }

  function durationSecondsUnit(
    uint256 _premium,
    uint256 _insuredCapital,
    uint256 _premiumRate //Ray
  ) private pure returns (uint256) {
    //31536000 * 100 = (365 * 24 * 60 * 60) * 100 // total seconds per year * 100
    return ((_premium * 3153600000) / _insuredCapital).rayDiv(_premiumRate);
  }

  function crossingInitializedTick(
    Slot0 memory _slot0,
    uint256 _availableCapital,
    uint32 _tick
  ) internal view {
    IPolicyManager policyManager_ = IPolicyManager(
      IAthena(core).policyManager()
    );
    address[] memory owners = ticks[_tick];
    uint256 __insuredCapitalToRemove;
    for (uint256 i = 0; i < owners.length; i++) {
      __insuredCapitalToRemove += policyManager_
        .policy(premiumPositions[owners[i]].tokenId)
        .amountCovered;
    }

    uint256 __currentPremiumRate = getPremiumRate(
      _utilisationRate(0, 0, _slot0.totalInsuredCapital, _availableCapital)
    );

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        __insuredCapitalToRemove,
        _slot0.totalInsuredCapital,
        _availableCapital
      )
    );

    _slot0.secondsPerTick = getSecondsPerTick(
      _slot0.secondsPerTick,
      __currentPremiumRate,
      __newPremiumRate
    );

    _slot0.totalInsuredCapital -= __insuredCapitalToRemove;

    _slot0.remainingPolicies -= owners.length;
  }

  function _updateSlot0WhenAvailableCapitalChange(
    uint256 _amountToAdd,
    uint256 _amountToRemove
  ) internal {
    uint256 __availableCapital = availableCapital;
    uint256 __totalInsuredCapital = slot0.totalInsuredCapital;

    uint256 __currentPremiumRate = getPremiumRate(
      _utilisationRate(0, 0, __totalInsuredCapital, __availableCapital)
    );

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        0,
        __totalInsuredCapital,
        __availableCapital + _amountToAdd - _amountToRemove
      )
    );

    slot0.secondsPerTick = getSecondsPerTick(
      slot0.secondsPerTick,
      __currentPremiumRate,
      __newPremiumRate
    );
  }

  function _actualizingUntil(uint256 _dateInSeconds)
    internal
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

    uint256 __availableCapital = availableCapital;
    uint256 __secondsGap = _dateInSeconds - __slot0.lastUpdateTimestamp;

    uint256 __uRate = _utilisationRate(
      0,
      0,
      __slot0.totalInsuredCapital,
      __availableCapital
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
          crossingInitializedTick(__slot0, __availableCapital, __tickNext);

          __uRate =
            _utilisationRate(
              0,
              0,
              __slot0.totalInsuredCapital,
              __availableCapital
            ) /
            100;

          __pRate = getPremiumRate(__uRate * 100) / 100;
        }
      } else {
        __slot0.tick += uint32(__secondsGap / __slot0.secondsPerTick);
        __liquidityIndex += (__uRate.rayMul(__pRate) * __secondsGap) / 31536000;
        __secondsGap = 0;
      }
    }

    __slot0.lastUpdateTimestamp = _dateInSeconds;
  }

  function _actualizing() internal returns (uint256[] memory) {
    if (slot0.remainingPolicies > 0) {
      (Slot0 memory __slot0, uint256 __liquidityIndex) = _actualizingUntil(
        block.timestamp
      );

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
          uint256[] memory __currentExpiredPoliciesTokenId = removeTick(
            __observedTick
          );

          for (uint256 i = 0; i < __currentExpiredPoliciesTokenId.length; i++) {
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

  function _buyPolicy(
    address _owner,
    uint256 _tokenId,
    uint256 _premium,
    uint256 _insuredCapital
  ) internal {
    uint256 __availableCapital = availableCapital;
    uint256 __totalInsuredCapital = slot0.totalInsuredCapital;

    require(
      __availableCapital >= __totalInsuredCapital + _insuredCapital,
      "Insufficient capital"
    );

    uint256 __currentPremiumRate = getPremiumRate(
      _utilisationRate(0, 0, __totalInsuredCapital, __availableCapital)
    );

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        _insuredCapital,
        0,
        __totalInsuredCapital,
        __availableCapital
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

    require(__durationInSeconds >= __newSecondsPerTick, "Min duration");

    uint32 __lastTick = slot0.tick +
      uint32(__durationInSeconds / __newSecondsPerTick);

    addPremiumPosition(_owner, _tokenId, __newPremiumRate, __lastTick);

    slot0.totalInsuredCapital += _insuredCapital;
    slot0.secondsPerTick = __newSecondsPerTick;

    slot0.remainingPolicies++;
  }

  function _withdrawPolicy(address _owner, uint256 _amountCovered)
    internal
    returns (uint256 __remainedPremium)
  {
    PremiumPosition.Info memory __position = premiumPositions.get(_owner);
    uint32 __currentTick = slot0.tick;

    require(__currentTick <= __position.lastTick, "Policy Expired");

    uint256 __totalInsuredCapital = slot0.totalInsuredCapital;
    uint256 __availableCapital = availableCapital;

    uint256 __currentPremiumRate = getPremiumRate(
      _utilisationRate(0, 0, __totalInsuredCapital, __availableCapital)
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
        __availableCapital
      )
    );

    slot0.totalInsuredCapital -= _amountCovered;

    slot0.secondsPerTick = getSecondsPerTick(
      slot0.secondsPerTick,
      __currentPremiumRate,
      __newPremiumRate
    );

    if (ticks.getOwnerNumber(__position.lastTick) > 1) {
      premiumPositions.replaceAndRemoveOwner(
        _owner,
        ticks.getLastOwnerInTick(__position.lastTick)
      );

      ticks.removeOwner(__position.ownerIndex, __position.lastTick);
    } else {
      removeTick(__position.lastTick);
    }

    slot0.remainingPolicies--;
  }

  function actualizingUntilGivenDate(uint256 _dateInSeconds)
    public
    view
    returns (Slot0 memory __slot0, uint256 __liquidityIndex)
  {
    require(_dateInSeconds >= slot0.lastUpdateTimestamp, "date is not valide");

    if (slot0.remainingPolicies > 0) {
      (__slot0, __liquidityIndex) = _actualizingUntil(_dateInSeconds);
    } else {
      __slot0 = slot0;
      __slot0.lastUpdateTimestamp = _dateInSeconds;
    }
  }

  function getInfo(address _owner)
    public
    view
    existedOwner(_owner)
    returns (
      uint256 __premiumLeft,
      uint256 __currentEmissionRate,
      uint256 __remainingSeconds
    )
  {
    uint256 __availableCapital = availableCapital;
    (Slot0 memory __slot0, ) = _actualizingUntil(block.timestamp);
    PremiumPosition.Info memory __position = premiumPositions[_owner];

    require(__slot0.tick <= __position.lastTick, "Policy Expired");

    uint256 __beginOwnerEmissionRate = IPolicyManager(
      IAthena(core).policyManager()
    ).policy(__position.tokenId).amountCovered.rayMul(
        __position.beginPremiumRate / 100
      ) / 365;

    uint256 __currentPremiumRate = getPremiumRate(
      _utilisationRate(0, 0, __slot0.totalInsuredCapital, __availableCapital)
    );

    __currentEmissionRate = getEmissionRate(
      __beginOwnerEmissionRate,
      __position.beginPremiumRate,
      __currentPremiumRate
    );

    uint256 __currentOwnerEmissionRate = __currentEmissionRate;

    while (__slot0.tick < __position.lastTick) {
      (uint32 __tickNext, bool __initialized) = tickBitmap
        .nextInitializedTickInTheRightWithinOneWord(__slot0.tick);

      uint32 __tick = __tickNext < __position.lastTick
        ? __tickNext
        : __position.lastTick;
      uint256 __secondsPassed = (__tick - __slot0.tick) *
        __slot0.secondsPerTick;

      __premiumLeft += (__secondsPassed * __currentOwnerEmissionRate) / 86400;

      __remainingSeconds += __secondsPassed;

      __slot0.tick = __tick;

      if (__initialized && __tickNext < __position.lastTick) {
        crossingInitializedTick(__slot0, __availableCapital, __tickNext);

        __currentPremiumRate = getPremiumRate(
          _utilisationRate(
            0,
            0,
            __slot0.totalInsuredCapital,
            __availableCapital
          )
        );

        __currentOwnerEmissionRate = getEmissionRate(
          __beginOwnerEmissionRate,
          __position.beginPremiumRate,
          __currentPremiumRate
        );
      }
    }
  }

  function getCurrentPremiumRate() public view returns (uint256) {
    return
      getPremiumRate(
        _utilisationRate(0, 0, slot0.totalInsuredCapital, availableCapital)
      );
  }
}
