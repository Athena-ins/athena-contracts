// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./univ3-like/libraries/Tick.sol";
import "./univ3-like/libraries/TickBitmap.sol";
import "./univ3-like/libraries/Position.sol";
import "./libraries/WadRayMath.sol";

import "./interfaces/IPolicyCover.sol";

import "hardhat/console.sol";

contract PolicyCover is IPolicyCover, ReentrancyGuard {
  using WadRayMath for uint256;
  using Tick for mapping(uint24 => address[]);
  using TickBitmap for mapping(uint16 => uint256);
  using Position for mapping(address => Position.Info);
  using Position for Position.Info;

  event TouchInitializedTick(string msg, uint24 tick, bool initialized);
  event HoursToDay(string msg, uint256 nbrHours, uint256 nbrDays);
  event Actualizing(
    string msg,
    uint24 tick,
    uint256 useRate,
    uint256 emissionRate,
    uint256 hoursPerTick,
    uint256 premiumSpent,
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

  struct Slot0 {
    uint24 tick;
    uint256 premiumRate; //RAY
    uint256 emissionRate; //RAY
    uint256 hoursPerTick; //RAY
    uint256 premiumSpent; //RAY
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
  mapping(address => Position.Info) internal positions;

  Formula internal f;
  Slot0 internal slot0;

  uint256 internal availableCapital;
  uint256 internal totalInsured;

  address public underlyingAsset;

  constructor(
    address _underlyingAsset,
    uint256 _uOptimal,
    uint256 _r0,
    uint256 _rSlope1,
    uint256 _rSlope2
  ) {
    underlyingAsset = _underlyingAsset;
    f = Formula({
      uOptimal: _uOptimal,
      r0: _r0,
      rSlope1: _rSlope1,
      rSlope2: _rSlope2
    });

    availableCapital = 730000 * WadRayMath.RAY; //Thao@TODO: remove from constructor

    slot0.premiumRate = WadRayMath.RAY; //Thao@NOTE: taux initiale = 1%
    slot0.hoursPerTick = 48 * WadRayMath.RAY;
    slot0.lastUpdateTimestamp = block.timestamp;
  }

  //Thao@TODO: move in ProtocolPool.sol
  function addCapital(uint256 _capital) public {
    availableCapital += _capital;
    //event
  }

  //Thao@TODO: move in ProtocolPool.sol
  function removeCapital(uint256 _capital) public {
    availableCapital -= _capital;
    //event
  }

  function addPosition(
    address _owner,
    uint256 _capitalInsured,
    uint256 _beginPremiumRate,
    uint24 _tick
  ) internal {
    positions[_owner] = Position.Info(
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
  }

  function getPremiumRate(uint256 _utilisationRate)
    public
    view
    returns (uint256)
  {
    // returns actual rate for insurance
    console.log("Utilisation rate:", _utilisationRate);
    if (_utilisationRate < f.uOptimal) {
      return f.r0 + f.rSlope1.rayMul(_utilisationRate.rayDiv(f.uOptimal));
    } else {
      return
        f.r0 +
        f.rSlope1 +
        (f.rSlope2 * (_utilisationRate - f.uOptimal)) /
        (100 * WadRayMath.RAY - f.uOptimal) /
        100;
    }
  }

  function getUtilisationRate(
    bool _isAdded,
    uint256 _capitalInsured,
    uint256 _totalInsured,
    uint256 _availableCapital
  ) public view returns (uint256) {
    console.log("_isAdded:", _isAdded);
    console.log("_capitalInsured:", _capitalInsured);
    console.log("_totalInsured:", _totalInsured);
    console.log("_availableCapital", _availableCapital);
    // returns actual usage rate on capital insured / capital provided for insurance
    if (_availableCapital == 0) {
      return 0;
    }
    return
      _isAdded
        ? ((_totalInsured + _capitalInsured) * 100).rayDiv(_availableCapital)
        : ((_totalInsured - _capitalInsured) * 100).rayDiv(_availableCapital);
  }

  function getEmissionRate(
    uint256 _oldEmissionRate,
    uint256 _oldUseRate,
    uint256 _newUseRate
  ) internal pure returns (uint256) {
    return _oldEmissionRate.rayMul(_newUseRate).rayDiv(_oldUseRate);
  }

  function getHoursPerTick(
    uint256 _oldHourPerTick,
    uint256 _oldUseRate,
    uint256 _newUseRate
  ) internal pure returns (uint256) {
    return _oldHourPerTick.rayMul(_oldUseRate).rayDiv(_newUseRate);
  }

  function durationHourUnit(
    uint256 _amount,
    uint256 _capital,
    uint256 _useRate
  ) internal pure returns (uint256) {
    //876000000000000000000000000000000 = 24 * 100 * 365 * WadRayMath.RAY
    return
      _amount.rayMul(876000000000000000000000000000000).rayDiv(_capital).rayDiv(
        _useRate
      );
  }

  function actualizingUntilGivenDate(uint256 _dateInSecond)
    external
    view
    returns (Slot0 memory __slot0, uint256 __totalInsured)
  {
    uint256 __availableCapital = availableCapital;

    __slot0 = Slot0({
      tick: slot0.tick,
      premiumRate: slot0.premiumRate,
      emissionRate: slot0.emissionRate,
      hoursPerTick: slot0.hoursPerTick,
      premiumSpent: slot0.premiumSpent,
      lastUpdateTimestamp: slot0.lastUpdateTimestamp
    });

    __totalInsured = totalInsured;

    uint256 __hoursGaps = ((_dateInSecond - __slot0.lastUpdateTimestamp) /
      3600) * WadRayMath.RAY; //3600 = 60 * 60
    uint256 __hoursPassed;

    while (__hoursPassed < __hoursGaps) {
      (uint24 __tickNext, bool __initialized) = tickBitmap
        .nextInitializedTickInTheRightWithinOneWord(__slot0.tick);

      uint256 __nextHoursPassed = __hoursPassed +
        (__tickNext - __slot0.tick) *
        __slot0.hoursPerTick;

      if (__nextHoursPassed < __hoursGaps) {
        //24000000000000000000000000000 = 24 * WadRayMath.RAY
        __slot0.premiumSpent += ((__tickNext - __slot0.tick) *
          __slot0.hoursPerTick.rayMul(__slot0.emissionRate)).rayDiv(
            24000000000000000000000000000
          );

        __slot0.tick = __tickNext;

        __hoursPassed = __nextHoursPassed;
      } else {
        __slot0.premiumSpent += (__hoursGaps - __hoursPassed)
          .rayMul(__slot0.emissionRate)
          .rayDiv(24000000000000000000000000000);

        __slot0.tick += uint24(
          (__hoursGaps - __hoursPassed) / __slot0.hoursPerTick
        );

        __hoursPassed = __hoursGaps;
      }

      if (__initialized && __nextHoursPassed <= __hoursGaps) {
        (uint256 __capitalToRemove, uint256 __emissionRateToRemove) = ticks
          .cross(positions, __tickNext, __slot0.premiumRate);

        uint256 __newPremiumRate = getPremiumRate(
          getUtilisationRate(
            false,
            __capitalToRemove,
            __totalInsured,
            __availableCapital
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

        __totalInsured -= __capitalToRemove;
      }
    }

    __slot0.lastUpdateTimestamp = _dateInSecond;
  }

  function actualizing() internal {
    Slot0 memory __step = Slot0({
      tick: slot0.tick,
      premiumRate: slot0.premiumRate,
      emissionRate: slot0.emissionRate,
      hoursPerTick: slot0.hoursPerTick,
      premiumSpent: slot0.premiumSpent,
      lastUpdateTimestamp: slot0.lastUpdateTimestamp
    });

    uint256 __hoursGaps = ((block.timestamp - __step.lastUpdateTimestamp) /
      3600) * WadRayMath.RAY; //3600 = 60 * 60

    console.log("__hoursGaps:", __hoursGaps);

    uint256 __hoursPassed;
    uint256 __hoursToDay; //Thao@NOTE: remove after testing

    while (__hoursPassed < __hoursGaps) {
      (uint24 __tickNext, bool __initialized) = tickBitmap
        .nextInitializedTickInTheRightWithinOneWord(__step.tick);

      emit TouchInitializedTick("Tick", __tickNext, __initialized);

      uint256 __nextHoursPassed = __hoursPassed +
        (__tickNext - __step.tick) *
        __step.hoursPerTick;

      console.log("__nextHoursPassed:", __nextHoursPassed);

      __hoursToDay += (__tickNext - __step.tick) * __step.hoursPerTick;

      if (__nextHoursPassed < __hoursGaps) {
        __step.premiumSpent +=
          ((__tickNext - __step.tick) *
            __step.hoursPerTick *
            __step.emissionRate) /
          WadRayMath.RAY /
          24;
        __step.tick = __tickNext;
        __hoursPassed = __nextHoursPassed;
      } else {
        __step.premiumSpent +=
          ((__hoursGaps - __hoursPassed) * __step.emissionRate) /
          WadRayMath.RAY /
          24;
        __step.tick += uint24(
          (__hoursGaps - __hoursPassed) / __step.hoursPerTick
        );
        __hoursPassed = __hoursGaps;
      }

      if (__initialized && __nextHoursPassed <= __hoursGaps) {
        (uint256 __capitalToRemove, uint256 __emissionRateToRemove) = ticks
          .cross(positions, __tickNext, __step.premiumRate);

        console.log("__emissionRateToRemove:", __emissionRateToRemove);
        console.log("-------------------------------");

        uint256 __newPremiumRate = getPremiumRate(
          //Thao@TODO: avoid storage variable
          getUtilisationRate(
            false,
            __capitalToRemove,
            totalInsured,
            availableCapital
          )
        );

        __step.emissionRate = getEmissionRate(
          __step.emissionRate - __emissionRateToRemove,
          __step.premiumRate,
          __newPremiumRate
        );

        __step.hoursPerTick = getHoursPerTick(
          __step.hoursPerTick,
          __step.premiumRate,
          __newPremiumRate
        );

        __step.premiumRate = __newPremiumRate;

        totalInsured -= __capitalToRemove;

        removeTick(__tickNext);

        emit HoursToDay(
          "HoursToDay",
          __hoursToDay,
          __hoursToDay / WadRayMath.RAY / 24
        );
        __hoursToDay = 0;
        emit TouchInitializedTick("Touch", __tickNext, __initialized);
      }

      emit Actualizing(
        "ActualizingStep",
        __step.tick,
        __step.premiumRate,
        __step.emissionRate,
        __step.hoursPerTick,
        __step.premiumSpent,
        __step.lastUpdateTimestamp
      );
    }

    slot0.tick = __step.tick;
    slot0.premiumRate = __step.premiumRate;
    slot0.emissionRate = __step.emissionRate;
    slot0.hoursPerTick = __step.hoursPerTick;
    slot0.premiumSpent = __step.premiumSpent;
    slot0.lastUpdateTimestamp = block.timestamp;

    emit Actualizing(
      "Actualizing",
      slot0.tick,
      slot0.premiumRate,
      slot0.emissionRate,
      slot0.hoursPerTick,
      slot0.premiumSpent,
      slot0.lastUpdateTimestamp
    );
  }

  function updateLiquidityIndex() internal virtual {}

  function buyPolicy(
    address owner,
    uint256 premium,
    uint256 capitalInsured
  ) external {
    require(!positions.hasOwner(owner), "Owner exist");

    actualizing();

    uint256 __newPremiumRate = getPremiumRate(
      //Thao@TODO: avoid storage variable
      getUtilisationRate(true, capitalInsured, totalInsured, availableCapital)
    );

    totalInsured += capitalInsured;

    updateLiquidityIndex();

    uint256 oldPremiumRate = slot0.premiumRate;

    uint256 _durationInHour = durationHourUnit(
      premium,
      capitalInsured,
      __newPremiumRate
    );

    uint256 addingEmissionRate = premium.rayMul(24 * WadRayMath.RAY).rayDiv(
      _durationInHour
    );
    slot0.emissionRate =
      getEmissionRate(slot0.emissionRate, oldPremiumRate, __newPremiumRate) +
      addingEmissionRate;

    uint256 newHoursPerTick = getHoursPerTick(
      slot0.hoursPerTick,
      oldPremiumRate,
      __newPremiumRate
    );

    uint24 lastTick = slot0.tick + uint24(_durationInHour / newHoursPerTick);
    console.log("_durationInHour:", _durationInHour);

    addPosition(owner, capitalInsured, __newPremiumRate, lastTick);

    slot0.premiumRate = __newPremiumRate;
    slot0.hoursPerTick = newHoursPerTick;

    emit BuyPolicy(
      "BuyPolicy",
      owner,
      premium,
      capitalInsured,
      __newPremiumRate,
      addingEmissionRate,
      newHoursPerTick,
      lastTick
    );
  }

  event WithdrawPolicy(address owner, uint256 remainedAmount);

  function withdrawPolicy(address owner) external {
    require(positions.hasOwner(owner), "Owner Not Exist");

    Position.Info storage position = positions.get(owner);
    uint24 lastTick = position.lastTick;

    actualizing();

    require(slot0.tick < lastTick, "Policy Expired");

    uint256 ownerCurrentEmissionRate = getEmissionRate(
      position.getBeginEmissionRate(),
      position.beginUseRate,
      slot0.premiumRate
    );

    uint256 remainedAmount = ((lastTick - slot0.tick) *
      slot0.hoursPerTick *
      ownerCurrentEmissionRate) /
      24 /
      WadRayMath.RAY;

    uint256 __newPremiumRate = getPremiumRate(
      //Thao@TODO: avoid storage variable
      getUtilisationRate(
        false,
        position.capitalInsured,
        totalInsured,
        availableCapital
      )
    );

    totalInsured -= position.capitalInsured;

    slot0.emissionRate = getEmissionRate(
      slot0.emissionRate - ownerCurrentEmissionRate,
      slot0.premiumRate,
      __newPremiumRate
    );

    slot0.hoursPerTick = getHoursPerTick(
      slot0.hoursPerTick,
      slot0.premiumRate,
      __newPremiumRate
    );

    slot0.premiumRate = __newPremiumRate;

    if (ticks.getOwnerNumber(lastTick) > 1) {
      ticks.removeOwner(position.ownerIndex, lastTick);
      positions.replaceAndRemoveOwner(
        owner,
        ticks.getLastOwnerInTick(lastTick)
      );
    } else {
      removeTick(lastTick);
    }

    emit WithdrawPolicy(owner, remainedAmount);
  }

  function remainedDay(uint256 __newPremiumRate, uint24 lastTick)
    internal
    view
    returns (uint256)
  {
    uint256 oldPremiumRate = slot0.premiumRate;
    console.log(oldPremiumRate);

    uint256 newHoursPerTick = slot0.hoursPerTick.rayMul(oldPremiumRate).rayDiv(
      __newPremiumRate
    );
    console.log(newHoursPerTick);
    uint256 numberRemainedTick = lastTick - slot0.tick;
    console.log(numberRemainedTick);
    return (numberRemainedTick * newHoursPerTick) / 24 / WadRayMath.RAY;
  }
}
