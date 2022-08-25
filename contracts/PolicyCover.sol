// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./libraries/RayMath.sol";
import "./libraries/Tick.sol";
import "./libraries/TickBitmap.sol";
import "./libraries/PremiumPosition.sol";
import "./interfaces/IPolicyCover.sol";
import "./ClaimCover.sol";

import "hardhat/console.sol";

abstract contract PolicyCover is IPolicyCover, ClaimCover {
  using RayMath for uint256;
  using Tick for mapping(uint24 => address[]);
  using TickBitmap for mapping(uint16 => uint256);
  using PremiumPosition for mapping(address => PremiumPosition.Info);

  mapping(uint24 => address[]) internal ticks;
  mapping(uint16 => uint256) internal tickBitmap;
  mapping(address => PremiumPosition.Info) public premiumPositions;

  Formula internal f;
  Slot0 public slot0;

  constructor(
    uint256 _uOptimal, //Ray
    uint256 _r0, //Ray
    uint256 _rSlope1, //Ray
    uint256 _rSlope2 //Ray
  ) {
    f = Formula({
      uOptimal: _uOptimal,
      r0: _r0,
      rSlope1: _rSlope1,
      rSlope2: _rSlope2
    });

    slot0.premiumRate = getPremiumRate(0);
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
    uint256 _capitalInsured,
    uint256 _beginPremiumRate,
    uint24 _tick
  ) private {
    premiumPositions[_owner] = PremiumPosition.Info(
      _capitalInsured,
      _beginPremiumRate,
      ticks.addOwner(_owner, _tick),
      _tick
    );

    if (!tickBitmap.isInitializedTick(_tick)) {
      tickBitmap.flipTick(_tick);
    }
  }

  function removeTick(uint24 _tick) private {
    address[] memory __owners = ticks[_tick];
    for (uint256 i = 0; i < __owners.length; i++) {
      premiumPositions.removeOwner(__owners[i]);
      //il faut event PolicyExpired ici
    }

    ticks.clear(_tick);
    tickBitmap.flipTick(_tick);
  }

  function getPremiumRate(uint256 _utilisationRate)
    private
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
  ) private pure returns (uint256) {
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
    uint24 _tick
  ) private view {
    (uint256 __policiesToRemove, uint256 __insuredCapitalToRemove) = ticks
      .cross(premiumPositions, _tick);

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
      _slot0.premiumRate,
      __newPremiumRate
    );

    _slot0.premiumRate = __newPremiumRate;

    _slot0.totalInsuredCapital -= __insuredCapitalToRemove;

    _slot0.remainingPolicies -= __policiesToRemove;
  }

  function _updateSlot0WhenAvailableCapitalChange(
    uint256 _amountToAdd,
    uint256 _amountToRemove
  ) internal {
    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        0,
        slot0.totalInsuredCapital,
        availableCapital + _amountToAdd - _amountToRemove
      )
    );

    slot0.secondsPerTick = getSecondsPerTick(
      slot0.secondsPerTick,
      slot0.premiumRate,
      __newPremiumRate
    );

    slot0.premiumRate = __newPremiumRate;
  }

  function _actualizingUntil(uint256 _dateInSeconds)
    internal
    view
    returns (Slot0 memory __slot0, uint256 __liquidityIndex)
  {
    __slot0 = Slot0({
      tick: slot0.tick,
      premiumRate: slot0.premiumRate,
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
      (uint24 __tickNext, bool __initialized) = tickBitmap
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
        __slot0.tick += uint24(__secondsGap / __slot0.secondsPerTick);
        __liquidityIndex += (__uRate.rayMul(__pRate) * __secondsGap) / 31536000;
        __secondsGap = 0;
      }
    }

    __slot0.lastUpdateTimestamp = _dateInSeconds;
  }

  function _actualizing() internal {
    if (slot0.remainingPolicies > 0) {
      (Slot0 memory __slot0, uint256 __liquidityIndex) = _actualizingUntil(
        block.timestamp
      );

      //now, we remove all crossed ticks
      uint24 __observedTick = slot0.tick;
      bool __initialized;
      while (__observedTick < __slot0.tick) {
        (__observedTick, __initialized) = tickBitmap
          .nextInitializedTickInTheRightWithinOneWord(__observedTick);

        if (__initialized && __observedTick <= __slot0.tick) {
          removeTick(__observedTick);
        }
      }

      slot0.tick = __slot0.tick;
      slot0.secondsPerTick = __slot0.secondsPerTick;
      slot0.totalInsuredCapital = __slot0.totalInsuredCapital;
      slot0.remainingPolicies = __slot0.remainingPolicies;
      liquidityIndex = __liquidityIndex;
    }

    slot0.lastUpdateTimestamp = block.timestamp;

    emit Actualizing(
      slot0.tick,
      slot0.premiumRate,
      slot0.secondsPerTick,
      slot0.remainingPolicies,
      liquidityIndex,
      slot0.lastUpdateTimestamp
    );
  }

  function _buyPolicy(
    address _owner,
    uint256 _premium,
    uint256 _insuredCapital
  ) internal {
    uint256 __availableCapital = availableCapital;
    uint256 __totalInsuredCapital = slot0.totalInsuredCapital;

    require(
      __availableCapital >= __totalInsuredCapital + _insuredCapital,
      "Insufficient capital"
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
      slot0.premiumRate,
      __newPremiumRate
    );

    uint24 __lastTick = slot0.tick +
      uint24(__durationInSeconds / __newSecondsPerTick);

    addPremiumPosition(_owner, _insuredCapital, __newPremiumRate, __lastTick);

    slot0.totalInsuredCapital += _insuredCapital;
    slot0.premiumRate = __newPremiumRate;
    slot0.secondsPerTick = __newSecondsPerTick;

    slot0.remainingPolicies++;
  }

  function _withdrawPolicy(address _owner)
    internal
    returns (uint256 __remainedPremium)
  {
    PremiumPosition.Info memory __position = premiumPositions.get(_owner);
    uint24 __currentTick = slot0.tick;

    require(__currentTick <= __position.lastTick, "Policy Expired");

    uint256 __ownerCurrentEmissionRate = getEmissionRate(
      PremiumPosition.getBeginEmissionRate(__position),
      __position.beginPremiumRate,
      slot0.premiumRate
    );

    __remainedPremium =
      ((__position.lastTick - __currentTick) *
        slot0.secondsPerTick *
        __ownerCurrentEmissionRate) /
      86400;

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        __position.capitalInsured,
        slot0.totalInsuredCapital,
        availableCapital
      )
    );

    slot0.totalInsuredCapital -= __position.capitalInsured;

    slot0.secondsPerTick = getSecondsPerTick(
      slot0.secondsPerTick,
      slot0.premiumRate,
      __newPremiumRate
    );

    slot0.premiumRate = __newPremiumRate;

    if (ticks.getOwnerNumber(__position.lastTick) > 1) {
      ticks.removeOwner(__position.ownerIndex, __position.lastTick);
      premiumPositions.replaceAndRemoveOwner(
        _owner,
        ticks.getLastOwnerInTick(__position.lastTick)
      );
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
    returns (uint256 __remainingPremium, uint256 __remainingDay)
  {
    uint256 __availableCapital = availableCapital;
    (Slot0 memory __slot0, ) = _actualizingUntil(block.timestamp);
    PremiumPosition.Info memory __position = premiumPositions.get(_owner);

    require(__slot0.tick <= __position.lastTick, "Policy Expired");

    uint256 __beginOwnerEmissionRate = PremiumPosition.getBeginEmissionRate(
      __position
    );

    uint256 __currentOwnerEmissionRate = getEmissionRate(
      __beginOwnerEmissionRate,
      __position.beginPremiumRate,
      __slot0.premiumRate
    );

    uint256 __remainingSeconds;

    while (__slot0.tick < __position.lastTick) {
      (uint24 __tickNext, bool __initialized) = tickBitmap
        .nextInitializedTickInTheRightWithinOneWord(__slot0.tick);

      uint24 __tick = __tickNext < __position.lastTick
        ? __tickNext
        : __position.lastTick;
      uint256 __secondsPassed = (__tick - __slot0.tick) *
        __slot0.secondsPerTick;

      __remainingPremium +=
        (__secondsPassed * __currentOwnerEmissionRate) /
        86400;

      __remainingSeconds += __secondsPassed;

      __slot0.tick = __tick;

      if (__initialized && __tickNext < __position.lastTick) {
        crossingInitializedTick(__slot0, __availableCapital, __tickNext);

        __currentOwnerEmissionRate = getEmissionRate(
          __beginOwnerEmissionRate,
          __position.beginPremiumRate,
          __slot0.premiumRate
        );
      }
    }

    __remainingDay = __remainingSeconds / 86400;
  }
}
