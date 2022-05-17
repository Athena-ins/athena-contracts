// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./PolicyCover.sol";

import "hardhat/console.sol";

contract PolicyCoverTest is PolicyCover {
  constructor(address _underlyingAsset) PolicyCover(_underlyingAsset) {}

  function getSlot0() public view returns (Slot0 memory) {
    return slot0;
  }

  function getTick() public view returns (uint256) {
    return slot0.tick;
  }

  function setTick(uint24 tick) public {
    slot0.tick = tick;
  }

  function getRate() public view returns (uint256) {
    return slot0.useRate;
  }

  function setRate(uint256 rate) public {
    slot0.useRate = rate;
  }

  function getEmissionRate() public view returns (uint256) {
    return slot0.emissionRate;
  }

  function setEmissionRate(uint256 emissionRate) public {
    slot0.emissionRate = emissionRate;
  }

  function getHoursPerTick() public view returns (uint256) {
    return slot0.hoursPerTick;
  }

  function setHoursPerTick(uint256 hoursPerTick) public {
    slot0.hoursPerTick = hoursPerTick;
  }

  function getNumerator() public view returns (uint256) {
    return slot0.numerator;
  }

  function setNumerator(uint256 numerator) public {
    slot0.numerator = numerator;
  }

  function getDenumerator() public view returns (uint256) {
    return slot0.denumerator;
  }

  function setDenumerator(uint256 denumerator) public {
    slot0.denumerator = denumerator;
  }

  function getLastUpdateTimestamp() public view returns (uint256) {
    return slot0.lastUpdateTimestamp;
  }

  function setLastUpdateTimestamp(uint256 timestamp) public {
    slot0.lastUpdateTimestamp = timestamp;
  }

  function mineTick(
    uint24 tick,
    uint256 capitalInsured,
    uint256 emissionRate,
    uint256 numerator,
    uint256 denumerator
  ) public {
    totalInsured += capitalInsured;
    pushTickInfo(tick, capitalInsured, emissionRate, numerator, denumerator);
    flipTick(tick);
  }

  function testIsInitializedTick(uint24 tick) public view returns (bool) {
    return isInitializedTick(tick);
  }

  function testGetEmissionRatePerDay(uint256 capital, uint256 rate)
    public
    pure
    returns (uint256)
  {
    return (capital * rate) / 100 / 365;
  }

  function testDurationHourUnit(
    uint256 premium,
    uint256 capital,
    uint256 rate
  ) public pure returns (uint256) {
    return durationHourUnit(premium, capital, rate);
  }

  function testActualizing() public {
    actualizing();
  }

  function testBuyPolicy(uint256 _amount, uint256 _capitalInsured) public {
    this.buyPolicy(_amount, _capitalInsured);
  }

  function testPerformBuyPolicy(
    uint256 newUseRate,
    uint256 _amount,
    uint256 _capitalInsured
  ) public {
    performBuyPolicy(newUseRate, _amount, _capitalInsured);
  }

  function testRemainedDay(uint256 newUseRate, uint24 lastTick)
    public
    view
    returns (uint256)
  {
    return remainedDay(newUseRate, lastTick);
  }
}
