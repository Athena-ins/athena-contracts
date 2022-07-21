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
    uint256 _uOptimal,
    uint256 _r0,
    uint256 _rSlope1,
    uint256 _rSlope2
  ) {
    f = Formula({
      uOptimal: _uOptimal,
      r0: _r0,
      rSlope1: _rSlope1,
      rSlope2: _rSlope2
    });

    slot0.premiumRate = getPremiumRate(0);
    slot0.hoursPerTick = 24000000000000000000000000000;
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

  function getHoursPerTick(
    uint256 _oldHourPerTick,
    uint256 _oldPremiumRate,
    uint256 _newPremiumRate
  ) private pure returns (uint256) {
    return _oldHourPerTick.rayMul(_oldPremiumRate).rayDiv(_newPremiumRate);
  }

  function durationHourUnit(
    uint256 _premium,
    uint256 _insuredCapital,
    uint256 _premiumRate
  ) private pure returns (uint256) {
    //876000000000000000000000000000000 = 24 * 100 * 365 * RayMath.RAY
    return
      _premium
        .rayMul(876000000000000000000000000000000)
        .rayDiv(_insuredCapital)
        .rayDiv(_premiumRate);
  }

  function crossingInitializedTick(
    Slot0 memory _slot0,
    uint256 _availableCapital,
    uint24 _tickNext
  ) private view {
    (
      uint256 __policiesToRemove,
      uint256 __insuredCapitalToRemove,
      uint256 __emissionRateToRemove
    ) = ticks.cross(premiumPositions, _tickNext, _slot0.premiumRate);

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        __insuredCapitalToRemove,
        _slot0.totalInsuredCapital,
        _availableCapital
      )
    );

    _slot0.emissionRate = getEmissionRate(
      _slot0.emissionRate - __emissionRateToRemove,
      _slot0.premiumRate,
      __newPremiumRate
    );

    _slot0.hoursPerTick = getHoursPerTick(
      _slot0.hoursPerTick,
      _slot0.premiumRate,
      __newPremiumRate
    );

    _slot0.premiumRate = __newPremiumRate;

    _slot0.totalInsuredCapital -= __insuredCapitalToRemove;

    _slot0.remainingPolicies -= __policiesToRemove;
  }

  function _updateSlot0WithClaimAmount(uint256 _amountToRemoveByClaim)
    internal
  {
    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        0,
        slot0.totalInsuredCapital,
        availableCapital - _amountToRemoveByClaim
      )
    );

    slot0.emissionRate = getEmissionRate(
      slot0.emissionRate,
      slot0.premiumRate,
      __newPremiumRate
    );

    slot0.hoursPerTick = getHoursPerTick(
      slot0.hoursPerTick,
      slot0.premiumRate,
      __newPremiumRate
    );

    slot0.premiumRate = __newPremiumRate;
    slot0.currentPremiumSpent = 0;
  }

  function _actualizingUntil(uint256 _dateInSecond)
    internal
    view
    returns (Slot0 memory __slot0)
  {
    __slot0 = Slot0({
      tick: slot0.tick,
      premiumRate: slot0.premiumRate,
      emissionRate: slot0.emissionRate,
      hoursPerTick: slot0.hoursPerTick,
      totalInsuredCapital: slot0.totalInsuredCapital,
      currentPremiumSpent: slot0.currentPremiumSpent,
      cumulatedPremiumSpent: slot0.cumulatedPremiumSpent,
      remainingPolicies: slot0.remainingPolicies,
      lastUpdateTimestamp: slot0.lastUpdateTimestamp
    });

    uint256 __availableCapital = availableCapital;
    uint256 __hoursGaps = RayMath
      .otherToRay((_dateInSecond - __slot0.lastUpdateTimestamp))
      .rayDiv(3600000000000000000000000000000);

    uint256 __hoursPassed;

    while (__hoursPassed < __hoursGaps) {
      (uint24 __tickNext, bool __initialized) = tickBitmap
        .nextInitializedTickInTheRightWithinOneWord(__slot0.tick);

      uint256 __hoursStep = (__tickNext - __slot0.tick) * __slot0.hoursPerTick;
      uint256 __nextHoursPassed = __hoursPassed + __hoursStep;

      if (__nextHoursPassed < __hoursGaps) {
        uint256 __premiumSpent = (__hoursStep.rayMul(__slot0.emissionRate))
          .rayDiv(24000000000000000000000000000);

        __slot0.currentPremiumSpent += __premiumSpent;
        __slot0.cumulatedPremiumSpent += __premiumSpent;
        __slot0.tick = __tickNext;

        __hoursPassed = __nextHoursPassed;
      } else {
        uint256 __premiumSpent = (__hoursGaps - __hoursPassed)
          .rayMul(__slot0.emissionRate)
          .rayDiv(24000000000000000000000000000);

        __slot0.currentPremiumSpent += __premiumSpent;
        __slot0.cumulatedPremiumSpent += __premiumSpent;
        __slot0.tick += uint24(
          (__hoursGaps - __hoursPassed) / __slot0.hoursPerTick
        );

        __hoursPassed = __hoursGaps;
      }

      if (__initialized && __nextHoursPassed <= __hoursGaps) {
        crossingInitializedTick(__slot0, __availableCapital, __tickNext);
      }
    }

    __slot0.lastUpdateTimestamp = _dateInSecond;
  }

  function _actualizing() internal {
    if (slot0.remainingPolicies > 0) {
      Slot0 memory __slot0 = _actualizingUntil(block.timestamp);

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
      slot0.premiumRate = __slot0.premiumRate;
      slot0.emissionRate = __slot0.emissionRate;
      slot0.hoursPerTick = __slot0.hoursPerTick;
      slot0.totalInsuredCapital = __slot0.totalInsuredCapital;
      slot0.currentPremiumSpent = __slot0.currentPremiumSpent;
      slot0.cumulatedPremiumSpent = __slot0.cumulatedPremiumSpent;
      slot0.remainingPolicies = __slot0.remainingPolicies;
    }

    slot0.lastUpdateTimestamp = block.timestamp;

    emit Actualizing(
      slot0.tick,
      slot0.premiumRate,
      slot0.emissionRate,
      slot0.hoursPerTick,
      availableCapital, //Thao@TODO: remove from event
      slot0.currentPremiumSpent, //Thao@TODO: il faut ajouter cumulatedPremiumSpent aussi
      slot0.remainingPolicies,
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

    uint256 __oldPremiumRate = slot0.premiumRate;

    uint256 __durationInHour = durationHourUnit(
      _premium,
      _insuredCapital,
      __newPremiumRate
    );

    uint256 __addingEmissionRate = _premium
      .rayMul(24000000000000000000000000000)
      .rayDiv(__durationInHour);

    slot0.emissionRate =
      getEmissionRate(slot0.emissionRate, __oldPremiumRate, __newPremiumRate) +
      __addingEmissionRate;

    uint256 __newHoursPerTick = getHoursPerTick(
      slot0.hoursPerTick,
      __oldPremiumRate,
      __newPremiumRate
    );

    uint24 __lastTick = slot0.tick +
      uint24(__durationInHour / __newHoursPerTick);

    addPremiumPosition(_owner, _insuredCapital, __newPremiumRate, __lastTick);

    slot0.totalInsuredCapital += _insuredCapital;
    slot0.premiumRate = __newPremiumRate;
    slot0.hoursPerTick = __newHoursPerTick;

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
        slot0.hoursPerTick.rayMul(__ownerCurrentEmissionRate)) /
      24;

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        __position.capitalInsured,
        slot0.totalInsuredCapital,
        availableCapital
      )
    );

    slot0.totalInsuredCapital -= __position.capitalInsured;

    slot0.emissionRate = getEmissionRate(
      slot0.emissionRate - __ownerCurrentEmissionRate,
      slot0.premiumRate,
      __newPremiumRate
    );

    slot0.hoursPerTick = getHoursPerTick(
      slot0.hoursPerTick,
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

  function actualizingUntilGivenDate(uint256 _dateInSecond)
    public
    view
    returns (Slot0 memory __slot0)
  {
    require(_dateInSecond >= slot0.lastUpdateTimestamp, "date is not valide");

    if (slot0.remainingPolicies > 0) {
      __slot0 = _actualizingUntil(_dateInSecond);
    } else {
      __slot0 = slot0;
      __slot0.lastUpdateTimestamp = _dateInSecond;
    }

    __slot0.premiumRate = RayMath.rayToOther(__slot0.premiumRate);
    __slot0.emissionRate = RayMath.rayToOther(__slot0.emissionRate);
    __slot0.hoursPerTick = RayMath.rayToOther(__slot0.hoursPerTick);
    __slot0.totalInsuredCapital = RayMath.rayToOther(
      __slot0.totalInsuredCapital
    );
    __slot0.currentPremiumSpent = RayMath.rayToOther(
      __slot0.currentPremiumSpent
    );
    __slot0.cumulatedPremiumSpent = RayMath.rayToOther(
      __slot0.cumulatedPremiumSpent
    );
  }

  function getInfo(address _owner)
    public
    view
    existedOwner(_owner)
    returns (uint256 __remainingPremium, uint256 __remainingDay)
  {
    uint256 __availableCapital = availableCapital;
    Slot0 memory __slot0 = _actualizingUntil(block.timestamp);
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

    uint256 __remainingHours;

    while (__slot0.tick < __position.lastTick) {
      (uint24 __tickNext, bool __initialized) = tickBitmap
        .nextInitializedTickInTheRightWithinOneWord(__slot0.tick);

      uint24 __tick = __tickNext < __position.lastTick
        ? __tickNext
        : __position.lastTick;
      uint256 __hoursPassed = (__tick - __slot0.tick) * __slot0.hoursPerTick;

      __remainingPremium += RayMath.rayToOther(
        __hoursPassed.rayMul(__currentOwnerEmissionRate).rayDiv(
          24000000000000000000000000000
        )
      );

      __remainingHours += __hoursPassed;

      uint256 __premiumSpent = __hoursPassed
        .rayMul(__slot0.emissionRate)
        .rayDiv(24000000000000000000000000000);

      __slot0.currentPremiumSpent += __premiumSpent;
      __slot0.cumulatedPremiumSpent += __premiumSpent;
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

    __remainingDay = __remainingHours / 24000000000000000000000000000;
  }
}
