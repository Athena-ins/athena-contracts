// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./univ3-like/libraries/LowGasSafeMath.sol";
import "./univ3-like/libraries/SafeCast.sol";
import "./univ3-like/libraries/Tick.sol";
import "./univ3-like/libraries/TickBitmap.sol";
import "./univ3-like/libraries/Position.sol";

import "./interfaces/IPolicyCover.sol";

import "hardhat/console.sol";

contract PolicyCover is IPolicyCover, ReentrancyGuard {
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
    uint256 hoursPerTick;
    uint256 cumulativeRatio;
    uint256 lastUpdateTimestamp;
  }

  Slot0 public slot0;

  uint256 internal _uOptimal = 7500; // 75 / 100 * 10000
  uint256 internal _r0 = 10000; // 1 * 10000
  uint256 internal _rSlope1 = 1200; // 1.2 * 10000
  uint256 internal _rSlope2 = 1100; // 1.1 * 10000
  uint256 internal _powerSlope2 = 100;

  uint256 public precision = 1e4;
  uint256 public premiumSupply;
  uint256 public totalInsured;
  uint256 internal availableCapital = 100000;
  //Thao@NOTE: availableCapital = reserveCapitalPool

  address public underlyingAsset;

  constructor(address _underlyingAsset) {
    underlyingAsset = _underlyingAsset;

    slot0.useRate = getRate(0, true);
    slot0.hoursPerTick = 24;
    slot0.cumulativeRatio = 1;
    slot0.lastUpdateTimestamp = block.timestamp;

    // console.log(slot0.tick);
    // console.log(slot0.useRate);
    // console.log(slot0.emissionRate);
    // console.log(slot0.hoursPerTick);
    // console.log(slot0.cumulativeRatio);
    // console.log(slot0.lastUpdateTimestamp);
  }

  /**
        Si U < Uoptimal : 	P = R0 + Rslope1*(U - Uoptimal)
        Si U >= Uoptimal : 	P = R0 + Rslope1 + Rslope2 * (U - Uoptimal)^(Power_slope2)
     */
  function getRate(uint256 _addedPolicy, bool isAdded)
    public
    view
    returns (uint256)
  {
    // returns actual rate for insurance
    uint256 _uRate = getUtilisationRate(_addedPolicy, isAdded);
    // *precision (10000)
    // console.log("Utilisation rate:", _uRate);
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

  function getUtilisationRate(uint256 _addedPolicy, bool isAdded)
    public
    view
    returns (uint256)
  {
    // returns actual usage rate on capital insured / capital provided for insurance
    if (availableCapital == 0) {
      return 0;
    }

    return
      ((isAdded ? totalInsured + _addedPolicy : totalInsured - _addedPolicy) *
        precision) / availableCapital; // at precision
  }

  function getUseRateRatio(uint256 oldRate, uint256 newRate)
    public
    view
    returns (uint256)
  {
    if (oldRate == 0) return 1;

    return (newRate * precision) / oldRate;
  }

  function duration(
    uint256 premium,
    uint256 capital,
    uint256 rate
  ) public view returns (uint256) {
    return (premium * 100 * precision * 365 * 24) / (capital * (rate));
  }

  function actualize(uint256 timestamp) internal {
    uint256 hoursGaps = (timestamp - slot0.lastUpdateTimestamp) / 3600; //3600 = 60 * 60

    Slot0 memory step = Slot0({
      tick: slot0.tick,
      useRate: slot0.useRate,
      emissionRate: slot0.emissionRate,
      hoursPerTick: slot0.hoursPerTick,
      cumulativeRatio: slot0.cumulativeRatio,
      lastUpdateTimestamp: 0
    });

    uint256 hoursPassed;
    while (hoursPassed < hoursGaps) {
      (uint24 next, bool initialized) = tickBitmap
        .nextInitializedTickInTheRightWithinOneWord(step.tick);

      uint256 nextHoursPassed = hoursPassed +
        (next - step.tick) *
        step.hoursPerTick;

      if (initialized && nextHoursPassed <= hoursGaps) {
        (uint256 capitalToRemove, uint256 emissionRateToRemove) = ticks.cross(
          next,
          step.cumulativeRatio
        );

        uint256 newRate = getRate(capitalToRemove, false);
        uint256 ratio = getUseRateRatio(step.useRate, newRate);
        step.emissionRate = (step.emissionRate - emissionRateToRemove) * ratio;
        step.hoursPerTick /= ratio;
        step.cumulativeRatio *= ratio;
        step.useRate = newRate;

        totalInsured -= capitalToRemove;

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

  function buyPolicy(uint256 _amount, uint256 _capitalInsured) external {
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

    cache.useRate = getRate(_capitalInsured, true);
    uint256 ratio = getUseRateRatio(slot0.useRate, cache.useRate);
    cache.hoursPerTick = slot0.hoursPerTick / ratio;
    cache.cumulativeRatio = slot0.cumulativeRatio * ratio;
    uint256 _durationInHour = duration(_amount, _capitalInsured, cache.useRate);
    uint256 newEmissionRate = (_amount * 24) / _durationInHour;
    cache.emissionRate = slot0.emissionRate * ratio + newEmissionRate;
    uint24 lastTick = slot0.tick + uint24(_durationInHour / cache.hoursPerTick);

    if (!tickBitmap.isInitializedTick(lastTick)) {
      tickBitmap.flipTick(lastTick);
    }

    ticks.pushTickInfo(
      lastTick,
      _capitalInsured,
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

  //Thao@NOTE:
  modifier updateState(address account) {
    // rewardPerTokenStored = rewardPerToken();
    // accruedInterest += getAccruedInterest();
    // lastUpdateTime = block.timestamp;
    // updateTickers([Ticker(0, 0, 0), Ticker(0, 0, 0)]);

    // New rate, next date policy expire ?

    // rewards[account] = earned(account);
    // userRewardPerTokenPaid[account] = rewardPerTokenStored;
    _;
  }

  function _stake(address _account, uint256 _amount)
    internal
    updateState(_account)
    nonReentrant
  {
    // totalShares += _amount;
    // _balances[_account] += _amount;
  }

  function _unstake(address _account, uint256 _amount)
    internal
    updateState(_account)
    nonReentrant
  {
    // totalShares -= _amount;
    // _balances[_account] -= _amount;
  }

  function _withdraw(address _account, uint256 _amount)
    internal
    updateState(_account)
    nonReentrant
  {
    // require(_balances[_account] >= _amount, "Not enough balance");
    // totalShares -= _amount;
    // _balances[_account] -= _amount;
    IERC20(underlyingAsset).safeTransfer(_account, _amount);
  }
}
