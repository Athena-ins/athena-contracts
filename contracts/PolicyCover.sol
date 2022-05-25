// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./univ3-like/libraries/LowGasSafeMath.sol";
import "./univ3-like/libraries/SafeCast.sol";
import "./univ3-like/libraries/Tick.sol";
import "./univ3-like/libraries/TickBitmap.sol";
import "./univ3-like/libraries/Position.sol";

import "./interfaces/IPolicyCover.sol";

import "hardhat/console.sol";

//Thao@TODO: move calculs with rouding in fcts
//Thao@NOTE: calcul days, useRate, premiumSpent ???
contract PolicyCover is IPolicyCover, ReentrancyGuard {
  using LowGasSafeMath for uint256;
  using SafeCast for uint256;
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
    uint256 useRate;
    uint256 emissionRate;
    uint256 hoursPerTick;
    uint256 premiumSpent;
    uint256 lastUpdateTimestamp;
  }

  Slot0 internal slot0;

  mapping(uint24 => address[]) internal ticks;
  mapping(uint16 => uint256) internal tickBitmap;
  mapping(address => Position.Info) internal positions;

  uint256 internal availableCapital;
  uint256 internal totalInsured;

  address public underlyingAsset;

  //Thao@TODO: remove
  uint256 internal premiumSupply;

  constructor(address _underlyingAsset) {
    underlyingAsset = _underlyingAsset;
    //Thao@TODO: see how init a pool policy ???
    //Thao@NOTE: init for testing
    slot0.emissionRate = 0;
    slot0.useRate = 1; //Thao@NOTE: taux initiale = 1%
    slot0.hoursPerTick = 48;
    slot0.lastUpdateTimestamp = block.timestamp;
  }

  //Thao@TODO: remove testing fct
  function isInitializedTick(uint24 tick) public view returns (bool) {
    return tickBitmap.isInitializedTick(tick);
  }

  function addPosition(
    address owner,
    uint256 capitalInsured,
    uint256 beginUseRate,
    uint24 tick
  ) internal {
    positions[owner] = Position.Info(
      capitalInsured,
      beginUseRate,
      ticks.addOwner(owner, tick),
      tick
    );

    if (!tickBitmap.isInitializedTick(tick)) {
      tickBitmap.flipTick(tick);
    }
  }

  function removeTick(uint24 tick) internal {
    address[] memory owners = ticks[tick];
    for (uint256 i = 0; i < owners.length; i++) {
      positions.removeOwner(owners[i]);
    }

    ticks.clear(tick);
    tickBitmap.flipTick(tick);
  }

  //   uint256 premiumSpent;
  //   uint256 lastUpdateTimestamp;

  uint256[] private removeUseRates = [2, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1];
  uint256 private removeIndex = 0;
  uint256[] private addUseRates = [2, 4, 2, 4, 2, 4, 2, 4, 1, 1, 1, 1, 1, 1];
  uint256 private addIndex = 0;

  function myGetUseRate(bool isAdded, bool initialized)
    internal
    returns (uint256 useRate)
  {
    if (isAdded) {
      useRate = addUseRates[addIndex];
      addIndex = addIndex.add(1);
    } else {
      useRate = removeUseRates[removeIndex];
      if (initialized) removeIndex = removeIndex.add(1);
    }
  }

  function getUseRate(
    uint256 x,
    uint256 y,
    bool isMul
  ) internal pure returns (uint256) {
    return isMul ? x * y : x / y;
  }

  function getEmissionRate(
    uint256 oldEmissionRate,
    uint256 oldUseRate,
    uint256 newUseRate
  ) internal pure returns (uint256) {
    return (oldEmissionRate * newUseRate) / oldUseRate;
  }

  function getHoursPerTick(
    uint256 oldHourPerTick,
    uint256 oldUseRate,
    uint256 newUseRate
  ) internal pure returns (uint256) {
    return (oldHourPerTick * oldUseRate) / newUseRate;
  }

  function durationHourUnit(
    uint256 amount,
    uint256 capital,
    uint256 useRate
  ) internal pure returns (uint256) {
    return ((amount * 24 * 100 * 365) / capital) / useRate;
  }

  function actualizingUntilGivenDate(uint256 dateInSecond)
    external
    view
    returns (Slot0 memory vSlot0, uint256 vTotalInsured)
  {
    vSlot0 = Slot0({
      tick: slot0.tick,
      useRate: slot0.useRate,
      emissionRate: slot0.emissionRate,
      hoursPerTick: slot0.hoursPerTick,
      premiumSpent: slot0.premiumSpent,
      lastUpdateTimestamp: slot0.lastUpdateTimestamp
    });

    vTotalInsured = totalInsured;

    uint256 hoursGaps = (dateInSecond - vSlot0.lastUpdateTimestamp) / 3600; //3600 = 60 * 60
    uint256 hoursPassed;

    uint256 div = 1;
    while (hoursPassed < hoursGaps) {
      (uint24 tickNext, bool initialized) = tickBitmap
        .nextInitializedTickInTheRightWithinOneWord(vSlot0.tick);

      uint256 nextHoursPassed = hoursPassed +
        (tickNext - vSlot0.tick) *
        vSlot0.hoursPerTick;

      if (nextHoursPassed < hoursGaps) {
        vSlot0.premiumSpent +=
          ((tickNext - vSlot0.tick) *
            vSlot0.hoursPerTick *
            vSlot0.emissionRate) /
          24;

        vSlot0.tick = tickNext;

        hoursPassed = nextHoursPassed;
      } else {
        vSlot0.premiumSpent +=
          ((hoursGaps - hoursPassed) * vSlot0.emissionRate) /
          24;

        vSlot0.tick += uint24((hoursGaps - hoursPassed) / vSlot0.hoursPerTick);

        hoursPassed = hoursGaps;
      }

      if (initialized && nextHoursPassed <= hoursGaps) {
        (uint256 capitalToRemove, uint256 emissionRateToRemove) = ticks.cross(
          positions,
          tickNext,
          vSlot0.useRate
        );

        uint256 newUseRate = getUseRate(2, div, false);
        div++;

        vSlot0.emissionRate = getEmissionRate(
          vSlot0.emissionRate - emissionRateToRemove,
          vSlot0.useRate,
          newUseRate
        );

        vSlot0.hoursPerTick = getHoursPerTick(
          vSlot0.hoursPerTick,
          vSlot0.useRate,
          newUseRate
        );

        vSlot0.useRate = newUseRate;

        vTotalInsured -= capitalToRemove;
      }
    }

    vSlot0.lastUpdateTimestamp = dateInSecond;
  }

  function actualizing() internal {
    Slot0 memory step = Slot0({
      tick: slot0.tick,
      useRate: slot0.useRate,
      emissionRate: slot0.emissionRate,
      hoursPerTick: slot0.hoursPerTick,
      premiumSpent: slot0.premiumSpent,
      lastUpdateTimestamp: slot0.lastUpdateTimestamp
    });

    uint256 hoursGaps = (block.timestamp - step.lastUpdateTimestamp) / 3600; //3600 = 60 * 60
    // console.log(hoursGaps);

    uint256 hoursPassed;
    uint256 hoursToDay; //Thao@NOTE: remove after testing

    while (hoursPassed < hoursGaps) {
      (uint24 tickNext, bool initialized) = tickBitmap
        .nextInitializedTickInTheRightWithinOneWord(step.tick);

      emit TouchInitializedTick("Tick", tickNext, initialized);

      uint256 nextHoursPassed = hoursPassed +
        (tickNext - step.tick) *
        step.hoursPerTick;

      hoursToDay += (tickNext - step.tick) * step.hoursPerTick;

      if (nextHoursPassed < hoursGaps) {
        step.premiumSpent +=
          ((tickNext - step.tick) * step.hoursPerTick * step.emissionRate) /
          24;
        step.tick = tickNext;
        hoursPassed = nextHoursPassed;
      } else {
        step.premiumSpent +=
          ((hoursGaps - hoursPassed) * step.emissionRate) /
          24;
        step.tick += uint24((hoursGaps - hoursPassed) / step.hoursPerTick);
        hoursPassed = hoursGaps;
      }

      if (initialized && nextHoursPassed <= hoursGaps) {
        (uint256 capitalToRemove, uint256 emissionRateToRemove) = ticks.cross(
          positions,
          tickNext,
          step.useRate
        );

        // console.log("emissionRateToRemove:");
        // console.log(emissionRateToRemove);
        // console.log("-------------------------------");

        uint256 newUseRate = myGetUseRate(false, initialized);

        step.emissionRate = getEmissionRate(
          step.emissionRate - emissionRateToRemove,
          step.useRate,
          newUseRate
        );

        step.hoursPerTick = getHoursPerTick(
          step.hoursPerTick,
          step.useRate,
          newUseRate
        );
        // (step.hoursPerTick * step.useRate) / newUseRate;

        step.useRate = newUseRate;

        totalInsured -= capitalToRemove;

        removeTick(tickNext);

        emit HoursToDay("HoursToDay", hoursToDay, hoursToDay / 24);
        hoursToDay = 0;
        emit TouchInitializedTick("Touch", tickNext, initialized);
      }

      // step.lastUpdateTimestamp += hoursPassed * 3600;

      emit Actualizing(
        "ActualizingStep",
        step.tick,
        step.useRate,
        step.emissionRate,
        step.hoursPerTick,
        step.premiumSpent,
        step.lastUpdateTimestamp
      );
    }

    slot0.tick = step.tick;
    slot0.useRate = step.useRate;
    slot0.emissionRate = step.emissionRate;
    slot0.hoursPerTick = step.hoursPerTick;
    slot0.premiumSpent = step.premiumSpent;
    slot0.lastUpdateTimestamp = block.timestamp;

    emit Actualizing(
      "Actualizing",
      slot0.tick,
      slot0.useRate,
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
    uint256 newUseRate = myGetUseRate(true, false);

    totalInsured += capitalInsured;

    updateLiquidityIndex();

    uint256 oldUseRate = slot0.useRate;

    uint256 _durationInHour = durationHourUnit(
      premium,
      capitalInsured,
      newUseRate
    );

    uint256 addingEmissionRate = (premium * 24) / _durationInHour;
    slot0.emissionRate =
      getEmissionRate(slot0.emissionRate, oldUseRate, newUseRate) +
      addingEmissionRate;

    uint256 newHoursPerTick = getHoursPerTick(
      slot0.hoursPerTick,
      oldUseRate,
      newUseRate
    );

    uint24 lastTick = slot0.tick + uint24(_durationInHour / newHoursPerTick);

    addPosition(owner, capitalInsured, newUseRate, lastTick);

    slot0.useRate = newUseRate;
    slot0.hoursPerTick = newHoursPerTick;

    emit BuyPolicy(
      "BuyPolicy",
      owner,
      premium,
      capitalInsured,
      newUseRate,
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
      slot0.useRate
    );

    uint256 remainedAmount = ((lastTick - slot0.tick) *
      slot0.hoursPerTick *
      ownerCurrentEmissionRate) / 24;

    totalInsured -= position.capitalInsured;

    uint256 newUseRate = myGetUseRate(false, true);
    slot0.emissionRate = getEmissionRate(
      slot0.emissionRate - ownerCurrentEmissionRate,
      slot0.useRate,
      newUseRate
    );
    // ((slot0.emissionRate - ownerCurrentEmissionRate) * newUseRate) /
    //   slot0.useRate;

    slot0.hoursPerTick = getHoursPerTick(
      slot0.hoursPerTick,
      slot0.useRate,
      newUseRate
    );
    // (slot0.hoursPerTick * slot0.useRate) / newUseRate;

    slot0.useRate = newUseRate;

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
    //Thao@NOTE: remove warning
    _account;
    _amount;

    // totalShares += _amount;
    // _balances[_account] += _amount;
  }

  function _unstake(address _account, uint256 _amount)
    internal
    updateState(_account)
    nonReentrant
  {
    //Thao@NOTE: remove warning
    _account;
    _amount;

    // totalShares -= _amount;
    // _balances[_account] -= _amount;
  }

  function _withdraw(address _account, uint256 _amount)
    internal
    updateState(_account)
    nonReentrant
  {
    //Thao@NOTE: remove warning
    _account;
    _amount;
  }
}
