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

  event TouchInitializedTick(string msg, uint24 tick, bool initialized);

  event Actualizing(
    string msg,
    uint24 tick,
    uint256 useRate,
    uint256 emissionRate,
    uint256 hourPerTick,
    uint256 numerator,
    uint256 denumerator,
    uint256 lastUpdateTimestamp
  );

  event BuyPolicy(
    uint256 useRate,
    uint256 addingEmissionRate,
    uint256 hourPerTick,
    uint24 tick
  );

  struct Slot0 {
    uint24 tick;
    uint256 useRate;
    uint256 emissionRate;
    uint256 hoursPerTick;
    uint256 numerator;
    uint256 denumerator;
    uint256 lastUpdateTimestamp;
  }

  Slot0 internal slot0;

  mapping(uint24 => Tick.Info[]) internal ticks;
  mapping(uint16 => uint256) internal tickBitmap;
  mapping(bytes32 => Position.Info) internal positions;

  //Thao@NOTE: availableCapital = reserveCapitalPool
  uint256 internal availableCapital = 100000;
  uint256 internal premiumSupply;
  uint256 internal totalInsured;

  address public underlyingAsset;

  constructor(address _underlyingAsset) {
    underlyingAsset = _underlyingAsset;
    //Thao@TODO: see how init a pool policy ???
    //Thao@NOTE: init for testing
    slot0.emissionRate = 0;
    slot0.useRate = 1; //Thao@NOTE: taux initiale = 1%
    slot0.hoursPerTick = 48;
    slot0.numerator = 1;
    slot0.denumerator = 1;
    slot0.lastUpdateTimestamp = block.timestamp;
  }

  function isInitializedTick(uint24 tick) public view returns (bool) {
    return tickBitmap.isInitializedTick(tick);
  }

  function pushTickInfo(
    uint24 tick,
    uint256 capitalInsured,
    uint256 emissionRate,
    uint256 numerator,
    uint256 denumerator
  ) internal {
    ticks.pushTickInfo(
      tick,
      capitalInsured,
      emissionRate,
      numerator,
      denumerator
    );
  }

  function flipTick(uint24 tick) internal {
    tickBitmap.flipTick(tick);
  }

  uint256[] useRateTable = [2, 4, 1, 1, 1, 1, 1, 1, 1, 1];
  uint256 index = 0;

  function getUseRate(bool initialized) internal returns (uint256 useRate) {
    useRate = useRateTable[index];
    if (initialized) index++;
  }

  function durationHourUnit(
    uint256 premium,
    uint256 capital,
    uint256 rate
  ) internal pure returns (uint256) {
    return ((premium * 24 * 100 * 365) / capital) / rate;
  }

  function actualizing() internal {
    Slot0 memory step = Slot0({
      tick: slot0.tick,
      useRate: slot0.useRate,
      emissionRate: slot0.emissionRate,
      hoursPerTick: slot0.hoursPerTick,
      numerator: slot0.numerator,
      denumerator: slot0.denumerator,
      lastUpdateTimestamp: slot0.lastUpdateTimestamp
    });

    uint256 hoursGaps = (block.timestamp - step.lastUpdateTimestamp) / 3600; //3600 = 60 * 60
    // console.log(hoursGaps);

    uint256 hoursPassed;

    while (hoursPassed < hoursGaps) {
      (uint24 tickNext, bool initialized) = tickBitmap
        .nextInitializedTickInTheRightWithinOneWord(step.tick);

      emit TouchInitializedTick("Tick", tickNext, initialized);

      uint256 nextHoursPassed = hoursPassed +
        (tickNext - step.tick) *
        step.hoursPerTick;

      if (initialized && nextHoursPassed <= hoursGaps) {
        (uint256 capitalToRemove, uint256 emissionRateToRemove) = ticks.cross(
          tickNext,
          step.numerator,
          step.denumerator
        );

        console.log("*******************************");
        console.log(emissionRateToRemove);

        uint256 newUseRate = getUseRate(initialized);

        step.emissionRate =
          ((step.emissionRate - emissionRateToRemove) * newUseRate) /
          step.useRate;
        step.hoursPerTick = (step.hoursPerTick * step.useRate) / newUseRate;
        step.numerator = newUseRate;
        // step.denumerator = step.useRate;
        step.useRate = newUseRate;

        totalInsured -= capitalToRemove;

        ticks.clear(tickNext);
        tickBitmap.flipTick(tickNext);

        emit TouchInitializedTick("Touch", tickNext, initialized);
      }

      if (nextHoursPassed < hoursGaps) {
        step.tick = tickNext;
        // step.useRate = getUseRate(false);
        hoursPassed = nextHoursPassed;
      } else {
        step.tick += uint24((hoursGaps - hoursPassed) / step.hoursPerTick);
        // step.useRate = getUseRate(false);
        hoursPassed = hoursGaps;
      }

      step.lastUpdateTimestamp += hoursPassed * 3600;

      emit Actualizing(
        "ActualizingStep",
        step.tick,
        step.useRate,
        step.emissionRate,
        step.hoursPerTick,
        step.numerator,
        step.denumerator,
        step.lastUpdateTimestamp
      );
    }

    slot0.tick = step.tick;
    slot0.useRate = step.useRate;
    slot0.emissionRate = step.emissionRate;
    slot0.hoursPerTick = step.hoursPerTick;
    slot0.numerator = step.numerator;
    slot0.denumerator = step.denumerator;
    slot0.lastUpdateTimestamp = block.timestamp;

    emit Actualizing(
      "Actualizing",
      slot0.tick,
      slot0.useRate,
      slot0.emissionRate,
      slot0.hoursPerTick,
      slot0.numerator,
      slot0.denumerator,
      slot0.lastUpdateTimestamp
    );
  }

  //Thao@TODO:
  function buyPolicy(uint256 _amount, uint256 _capitalInsured) external {
    actualizing();
    uint256 newUseRate = getUseRate(false);

    premiumSupply += _amount;
    totalInsured += _capitalInsured;

    performBuyPolicy(newUseRate, _amount, _capitalInsured);
  }

  function performBuyPolicy(
    uint256 newUseRate,
    uint256 _amount,
    uint256 _capitalInsured
  ) internal {
    uint256 oldUseRate = slot0.useRate;

    uint256 _durationInHour = durationHourUnit(
      _amount,
      _capitalInsured,
      newUseRate
    );

    uint256 addingEmissionRate = (_amount * 24) / _durationInHour;
    slot0.emissionRate =
      addingEmissionRate +
      (slot0.emissionRate * newUseRate) /
      oldUseRate;

    uint256 newHoursPerTick = (slot0.hoursPerTick * oldUseRate) / newUseRate;
    // uint256 newHoursPerTick = 24;
    uint24 lastTick = slot0.tick + uint24(_durationInHour / newHoursPerTick);

    if (!tickBitmap.isInitializedTick(lastTick)) {
      tickBitmap.flipTick(lastTick);
    }

    uint256 newNumerator = slot0.numerator * newUseRate;
    uint256 newDenumerator = slot0.denumerator * oldUseRate;

    ticks.pushTickInfo(
      lastTick,
      _capitalInsured,
      addingEmissionRate,
      newNumerator,
      newDenumerator
    );

    slot0.useRate = newUseRate;
    slot0.hoursPerTick = newHoursPerTick;
    slot0.numerator = newNumerator;
    slot0.denumerator = newDenumerator;
    slot0.lastUpdateTimestamp = block.timestamp;

    emit BuyPolicy(newUseRate, addingEmissionRate, newHoursPerTick, lastTick);
  }

  function remainedDay(uint256 newUseRate, uint24 lastTick)
    internal
    view
    returns (uint256)
  {
    uint256 oldUseRate = slot0.useRate;
    console.log(oldUseRate);
    //Thao@WARN: newHoursPerTick contient que la parti entière (9 au lieu de 9,6)
    uint256 newHoursPerTick = (slot0.hoursPerTick * oldUseRate * 1e27) /
      newUseRate;
    console.log(newHoursPerTick);
    uint256 numberRemainedTick = lastTick - slot0.tick;
    console.log(numberRemainedTick);
    return (numberRemainedTick * newHoursPerTick) / 24 / 1e27;
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
  {}
}
