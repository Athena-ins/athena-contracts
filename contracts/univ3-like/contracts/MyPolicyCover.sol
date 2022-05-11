// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../libraries/LowGasSafeMath.sol";
import "../libraries/SafeCast.sol";
import "../libraries/Tick.sol";
import "../libraries/TickBitmap.sol";
import "../libraries/Position.sol";

import "hardhat/console.sol";

contract MyPolicyCover {
  using SafeERC20 for IERC20;

  using LowGasSafeMath for uint256;
  using LowGasSafeMath for int256;
  using SafeCast for uint256;
  using SafeCast for int256;
  using Tick for mapping(uint24 => Tick.Info[]);
  using TickBitmap for mapping(uint16 => uint256);
  using Position for mapping(bytes32 => Position.Info);
  using Position for Position.Info;

  mapping(uint24 => Tick.Info[]) public ticks;
  mapping(uint16 => uint256) public tickBitmap;
  mapping(bytes32 => Position.Info) public positions;

  struct Slot0 {
    uint24 tick;
    uint256 useRate;
    uint256 emissionRate;
    uint256 hoursPerTick; //uint128???
    uint256 cumulativeRatio;
    uint256 lastUpdateTimestamp;
  }

  Slot0 internal slot0;

  uint256 internal _uOptimal = 7500; // 75 / 100 * 10000
  uint256 internal _r0 = 10000; // 1 * 10000
  uint256 internal _rSlope1 = 1200; // 1.2 * 10000
  uint256 internal _rSlope2 = 1100; // 1.1 * 10000
  uint256 internal _powerSlope2 = 100;

  uint256 public precision = 10000;
  uint256 public premiumSupply;
  uint256 public totalInsured;
  uint256 internal availableCapital = 100000;
  //Thao@NOTE: availableCapital + totalInsured = reserveCapitalPool

  address public underlyingAsset;

  constructor(address _underlyingAsset) {
    underlyingAsset = _underlyingAsset;
  }

  /**
        Si U < Uoptimal : 	P = R0 + Rslope1*(U - Uoptimal)
        Si U >= Uoptimal : 	P = R0 + Rslope1 + Rslope2 * (U - Uoptimal)^(Power_slope2)
     */
  function getRate(uint256 _addedPolicy) public view returns (uint256) {
    // returns actual rate for insurance
    uint256 _uRate = getUtilisationRate(_addedPolicy);
    // *precision (10000)
    console.log("Utilisation rate:", _uRate);
    if (_uRate < _uOptimal) {
      return _r0 + _rSlope1 * (_uRate / _uOptimal);
    } else {
      return
        _r0 +
        _rSlope1 +
        (_rSlope2 * (_uRate - _uOptimal)) /
        (10000 - _uOptimal) /
        100;
    }
  }

  function getUtilisationRate(uint256 _addedPolicy)
    public
    view
    returns (uint256)
  {
    // returns actual usage rate on capital insured / capital provided for insurance
    if (availableCapital == 0) {
      return 0;
    }
    return ((totalInsured + _addedPolicy) * precision) / availableCapital; // at precision
  }

  function getUseRateRatio(uint256 oldRate, uint256 newRate)
    private
    pure
    returns (uint256)
  {
    return newRate / oldRate; //Thao@WARN: il n'y a pas de flotant
  }

  function getNewSecondsPerTick(uint256 oldSecondsPerTick, uint256 ratio)
    internal
    pure
    returns (uint256)
  {
    return oldSecondsPerTick / ratio;
  }

  function getNewEmissionRate(uint256 oldEmissionRate, uint256 ratio)
    internal
    pure
    returns (uint256)
  {
    return oldEmissionRate * ratio;
  }

  function duration(
    uint256 premium,
    uint256 capital,
    uint256 rate
  ) public view returns (uint256) {
    return (premium * 100 * precision * 365 * 24) / (capital * (rate));
  }

  function deleteTick(uint24 tick) internal {
    ticks.clear(tick);
    tickBitmap.flipTick(tick);
  }

  function crossTick(uint24 tick, uint256 totalCumulativeRatio)
    internal
    view
    returns (
      uint256 capitalToRemove,
      uint256 rateToRemove,
      uint256 emissionRateToRemove
    )
  {
    Tick.Info[] memory tickInfos = ticks.cross(tick);
    for (uint256 i = 0; i < tickInfos.length; i++) {
      capitalToRemove += tickInfos[i].capitalInsured;
      rateToRemove += tickInfos[i].addedRate;
      emissionRateToRemove +=
        tickInfos[i].beginEmissionRate *
        (totalCumulativeRatio / tickInfos[i].beginCumutativeRatio);
    }
  }

  function actualize(uint256 timestamp) internal {
    uint256 hoursGaps = timestamp - slot0.lastUpdateTimestamp / 3600; //3600 = 60 * 60

    Slot0 memory step = Slot0({
      tick: slot0.tick,
      useRate: slot0.useRate,
      emissionRate: slot0.emissionRate,
      hoursPerTick: slot0.hoursPerTick,
      cumulativeRatio: slot0.cumulativeRatio,
      lastUpdateTimestamp: 0
    });

    uint256 hoursPassed;
    while (hoursPassed != hoursGaps) {
      (uint24 next, bool initialized) = tickBitmap
        .nextInitializedTickWithinOneWord(step.tick);

      uint256 nextHoursPassed = hoursPassed +
        (next - step.tick) *
        step.hoursPerTick;

      if (initialized && nextHoursPassed <= hoursGaps) {
        (
          uint256 capitalToRemove,
          uint256 rateToRemove,
          uint256 emissionRateToRemove
        ) = crossTick(next, step.cumulativeRatio);

        totalInsured -= capitalToRemove;

        uint256 ratio = (step.useRate - rateToRemove) / step.useRate;
        step.emissionRate = (step.emissionRate - emissionRateToRemove) * ratio;
        step.hoursPerTick /= ratio;
        step.cumulativeRatio *= ratio;
        step.useRate -= rateToRemove;
        ticks.clear(next);
        tickBitmap.flipTick(next);
      }

      if (nextHoursPassed < hoursGaps) {
        step.tick = next;
        hoursPassed = nextHoursPassed;
      } else {
        step.tick += uint24((hoursGaps - hoursPassed) / step.hoursPerTick);
        hoursPassed = hoursGaps;
      }
    }

    slot0.tick = step.tick;
    slot0.useRate = step.useRate;
    slot0.emissionRate = step.emissionRate;
    slot0.hoursPerTick = step.hoursPerTick;
    slot0.cumulativeRatio = step.cumulativeRatio;
    slot0.lastUpdateTimestamp = timestamp;
  }

  function buyPolicyWithPremium(uint256 _amount, uint256 _capitalInsured)
    external
  {
    IERC20(underlyingAsset).safeTransferFrom(
      msg.sender,
      address(this),
      _amount
    );

    Slot0 memory cache;
    cache.lastUpdateTimestamp = block.timestamp;

    //1
    actualize(cache.lastUpdateTimestamp);

    premiumSupply += _amount;
    totalInsured += _capitalInsured;

    //2
    cache.useRate = getRate(_capitalInsured);
    //4
    uint256 ratio = cache.useRate / slot0.useRate;
    //8
    cache.hoursPerTick = slot0.hoursPerTick / ratio;
    //10
    cache.cumulativeRatio = slot0.cumulativeRatio * ratio;
    //3
    uint256 _durationInHour = duration(_amount, _capitalInsured, cache.useRate);
    //6
    uint256 newEmissionRate = (_amount * 24) / _durationInHour;
    //5 et 7
    cache.emissionRate = slot0.emissionRate * ratio + newEmissionRate;
    //9
    uint24 lastTick = slot0.tick + uint24(_durationInHour / cache.hoursPerTick);
    //11
    if (!tickBitmap.isInitializedTick(lastTick)) {
      tickBitmap.flipTick(lastTick);
    }

    ticks.pushTickInfo(
      lastTick,
      _capitalInsured,
      cache.useRate - slot0.useRate,
      newEmissionRate,
      cache.cumulativeRatio
    );

    slot0.useRate = cache.useRate;
    slot0.emissionRate = cache.emissionRate;
    slot0.hoursPerTick = cache.hoursPerTick;
    slot0.cumulativeRatio = cache.cumulativeRatio;
    slot0.lastUpdateTimestamp = cache.lastUpdateTimestamp;

    //Thao@TODO: event
  }
}

//withdrawPremium
