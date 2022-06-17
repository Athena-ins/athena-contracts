// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IPolicyCover.sol";

import "./libraries/RayMath.sol";
import "./libraries/Tick.sol";
import "./libraries/TickBitmap.sol";
import "./libraries/PremiumPosition.sol";

import "hardhat/console.sol";

contract PolicyCover is IPolicyCover, ReentrancyGuard {
  using RayMath for uint256;
  using Tick for mapping(uint24 => address[]);
  using TickBitmap for mapping(uint16 => uint256);
  using PremiumPosition for mapping(address => PremiumPosition.Info);
  using PremiumPosition for PremiumPosition.Info;

  //Thao@TODO: add event expiredPolicy
  event Actualizing(
    string msg,
    uint24 tick,
    uint256 useRate,
    uint256 emissionRate,
    uint256 hoursPerTick,
    uint256 availableCapital,
    uint256 lastUpdateTimestamp
  );
  event BuyPolicy(
    string msg,
    address owner,
    uint256 premium,
    uint256 capitalInsured,
    uint256 useRate,
    uint256 addingEmissionRate,
    uint256 hoursPerTick,
    uint24 tick
  );
  event WithdrawPolicy(address owner, uint256 remainedAmount);

  struct Slot0 {
    uint24 tick;
    uint256 premiumRate; //RAY
    uint256 emissionRate; //RAY
    uint256 hoursPerTick; //RAY
    uint256 totalInsuredCapital; //RAY
    uint256 availableCapital; //RAY
    uint256 lastUpdateTimestamp;
  }

  struct Formula {
    uint256 uOptimal;
    uint256 r0;
    uint256 rSlope1;
    uint256 rSlope2;
  }

  mapping(uint24 => address[]) internal ticks;
  mapping(uint16 => uint256) internal tickBitmap;
  mapping(address => PremiumPosition.Info) public positions;

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

  modifier onlyCore() virtual {
    _;
  }

  modifier existedOwner(address _owner) {
    require(positions.hasOwner(_owner), "Owner Not Exist");
    _;
  }

  modifier notExistedOwner(address _owner) {
    require(!positions.hasOwner(_owner), "Owner exist");
    _;
  }

  modifier hasCapital(uint256 _insuredCapital) {
    require(
      slot0.availableCapital >=
        slot0.totalInsuredCapital + RayMath.otherToRay(_insuredCapital),
      "Insufficient capital"
    );
    _;
  }

  function addPosition(
    address _owner,
    uint256 _capitalInsured,
    uint256 _beginPremiumRate,
    uint24 _tick
  ) internal {
    positions[_owner] = PremiumPosition.Info(
      _capitalInsured,
      _beginPremiumRate,
      ticks.addOwner(_owner, _tick),
      _tick
    );

    if (!tickBitmap.isInitializedTick(_tick)) {
      tickBitmap.flipTick(_tick);
    }
  }

  function removeTick(uint24 _tick) internal {
    address[] memory __owners = ticks[_tick];
    for (uint256 i = 0; i < __owners.length; i++) {
      positions.removeOwner(__owners[i]);
    }

    ticks.clear(_tick);
    tickBitmap.flipTick(_tick);
    //Thao@TODO: how we remove a key-value when we go out of wordPos
  }

  function getPremiumRate(uint256 _utilisationRate)
    public
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

  function getUtilisationRate(
    bool _isAdded,
    uint256 _insuredCapital,
    uint256 _totalInsuredCapital,
    uint256 _availableCapital
  ) public pure returns (uint256) {
    // returns actual usage rate on capital insured / capital provided for insurance
    if (_availableCapital == 0) {
      return 0;
    }
    return
      _isAdded
        ? ((_totalInsuredCapital + _insuredCapital) * 100).rayDiv(
          _availableCapital
        )
        : ((_totalInsuredCapital - _insuredCapital) * 100).rayDiv(
          _availableCapital
        );
  }

  function getEmissionRate(
    uint256 _oldEmissionRate,
    uint256 _oldPremiumRate,
    uint256 _newPremiumRate
  ) internal pure returns (uint256) {
    return _oldEmissionRate.rayMul(_newPremiumRate).rayDiv(_oldPremiumRate);
  }

  function getHoursPerTick(
    uint256 _oldHourPerTick,
    uint256 _oldPremiumRate,
    uint256 _newPremiumRate
  ) internal pure returns (uint256) {
    return _oldHourPerTick.rayMul(_oldPremiumRate).rayDiv(_newPremiumRate);
  }

  function durationHourUnit(
    uint256 _premium,
    uint256 _insuredCapital,
    uint256 _premiumRate
  ) internal pure returns (uint256) {
    //876000000000000000000000000000000 = 24 * 100 * 365 * RayMath.RAY
    return
      _premium
        .rayMul(876000000000000000000000000000000)
        .rayDiv(_insuredCapital)
        .rayDiv(_premiumRate);
  }

  function crossingInitializedTick(Slot0 memory __slot0, uint24 __tickNext)
    private
    view
  {
    (uint256 __insuredCapitalToRemove, uint256 __emissionRateToRemove) = ticks
      .cross(positions, __tickNext, __slot0.premiumRate);

    uint256 __newPremiumRate = getPremiumRate(
      getUtilisationRate(
        false,
        __insuredCapitalToRemove,
        __slot0.totalInsuredCapital,
        __slot0.availableCapital
      )
    );

    __slot0.emissionRate = getEmissionRate(
      __slot0.emissionRate - __emissionRateToRemove,
      __slot0.premiumRate,
      __newPremiumRate
    );

    __slot0.hoursPerTick = getHoursPerTick(
      __slot0.hoursPerTick,
      __slot0.premiumRate,
      __newPremiumRate
    );

    __slot0.premiumRate = __newPremiumRate;

    __slot0.totalInsuredCapital -= __insuredCapitalToRemove;
  }

  function actualizingSlot0(uint256 _dateInSecond)
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
      availableCapital: slot0.availableCapital,
      lastUpdateTimestamp: slot0.lastUpdateTimestamp
    });

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
        __slot0.availableCapital += (__hoursStep.rayMul(__slot0.emissionRate))
          .rayDiv(24000000000000000000000000000);

        __slot0.tick = __tickNext;

        __hoursPassed = __nextHoursPassed;
      } else {
        __slot0.availableCapital += (__hoursGaps - __hoursPassed)
          .rayMul(__slot0.emissionRate)
          .rayDiv(24000000000000000000000000000);

        __slot0.tick += uint24(
          (__hoursGaps - __hoursPassed) / __slot0.hoursPerTick
        );

        __hoursPassed = __hoursGaps;
      }

      if (__initialized && __nextHoursPassed <= __hoursGaps) {
        crossingInitializedTick(__slot0, __tickNext);
      }
    }

    __slot0.lastUpdateTimestamp = _dateInSecond;
  }

  function actualizing() internal {
    Slot0 memory __slot0 = actualizingSlot0(block.timestamp);

    //now, we remove crossed ticks
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
    slot0.availableCapital = __slot0.availableCapital;
    slot0.lastUpdateTimestamp = __slot0.lastUpdateTimestamp;

    emit Actualizing(
      "Actualizing",
      slot0.tick,
      slot0.premiumRate,
      slot0.emissionRate,
      slot0.hoursPerTick,
      slot0.availableCapital,
      slot0.lastUpdateTimestamp
    );
  }

  function buyPolicy(
    address _owner,
    uint256 _premium,
    uint256 _insuredCapital
  ) external onlyCore notExistedOwner(_owner) hasCapital(_insuredCapital) {
    actualizing();

    uint256 __premium = RayMath.otherToRay(_premium);
    uint256 __insuredCapital = RayMath.otherToRay(_insuredCapital);

    uint256 __newPremiumRate = getPremiumRate(
      //Thao@TODO: avoid storage variable
      getUtilisationRate(
        true,
        __insuredCapital,
        slot0.totalInsuredCapital,
        slot0.availableCapital
      )
    );

    slot0.totalInsuredCapital += __insuredCapital;

    uint256 __oldPremiumRate = slot0.premiumRate;

    uint256 __durationInHour = durationHourUnit(
      __premium,
      __insuredCapital,
      __newPremiumRate
    );

    uint256 __addingEmissionRate = __premium
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
    // console.log("__durationInHour:", __durationInHour);

    addPosition(_owner, __insuredCapital, __newPremiumRate, __lastTick);

    slot0.premiumRate = __newPremiumRate;
    slot0.hoursPerTick = __newHoursPerTick;

    emit BuyPolicy(
      "BuyPolicy",
      _owner,
      _premium,
      _insuredCapital,
      __newPremiumRate,
      __addingEmissionRate,
      __newHoursPerTick,
      __lastTick
    );
  }

  function withdrawPolicy(address _owner)
    external
    onlyCore
    existedOwner(_owner)
  {
    actualizing();

    PremiumPosition.Info storage __position = positions.get(_owner);
    uint24 __lastTick = __position.lastTick;

    require(slot0.tick < __lastTick, "Policy Expired");

    uint256 __ownerCurrentEmissionRate = getEmissionRate(
      __position.getBeginEmissionRate(),
      __position.beginPremiumRate,
      slot0.premiumRate
    );

    uint256 __remainedPremium = ((__lastTick - slot0.tick) *
      slot0.hoursPerTick.rayMul(__ownerCurrentEmissionRate)) / 24;

    uint256 __newPremiumRate = getPremiumRate(
      //Thao@NOTE: can we do better: avoid to use storage ?
      getUtilisationRate(
        false,
        __position.capitalInsured,
        slot0.totalInsuredCapital,
        slot0.availableCapital
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

    if (ticks.getOwnerNumber(__lastTick) > 1) {
      ticks.removeOwner(__position.ownerIndex, __lastTick);
      positions.replaceAndRemoveOwner(
        _owner,
        ticks.getLastOwnerInTick(__lastTick)
      );
    } else {
      removeTick(__lastTick);
    }

    emit WithdrawPolicy(_owner, __remainedPremium);
  }

  //__slot0 not in Ray
  function actualizingUntilGivenDate(uint256 _dateInSecond)
    public
    view
    returns (Slot0 memory __slot0)
  {
    require(
      _dateInSecond >= slot0.lastUpdateTimestamp,
      "Target timestamp less than last update timestamp"
    );

    __slot0 = actualizingSlot0(_dateInSecond);
  }

  function getInfo(address _owner)
    public
    view
    existedOwner(_owner)
    returns (uint256 __remainingPremium, uint256 __remainingDay)
  {
    Slot0 memory __slot0 = actualizingSlot0(block.timestamp);
    PremiumPosition.Info storage __position = positions.get(_owner);

    require(__slot0.tick < __position.lastTick, "Policy Expired");

    uint256 __ownerCurrentEmissionRate = getEmissionRate(
      __position.getBeginEmissionRate(),
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
        __hoursPassed.rayMul(__ownerCurrentEmissionRate).rayDiv(
          24000000000000000000000000000
        )
      );

      __remainingHours += __hoursPassed;
      __slot0.availableCapital += __hoursPassed
        .rayMul(__slot0.emissionRate)
        .rayDiv(24000000000000000000000000000);
      __slot0.tick = __tick;

      if (__initialized && __tickNext < __position.lastTick) {
        crossingInitializedTick(__slot0, __tickNext);

        __ownerCurrentEmissionRate = getEmissionRate(
          __position.getBeginEmissionRate(),
          __position.beginPremiumRate,
          __slot0.premiumRate
        );
      }
    }

    __remainingDay = __remainingHours / 24000000000000000000000000000;
  }
}
