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

  function getPremiumSpent() public view returns (uint256) {
    return slot0.premiumSpent;
  }

  function setPremiumSpent(uint256 premiumSpent) public {
    slot0.premiumSpent = premiumSpent;
  }

  function getLastUpdateTimestamp() public view returns (uint256) {
    return slot0.lastUpdateTimestamp;
  }

  function setLastUpdateTimestamp(uint256 timestamp) public {
    slot0.lastUpdateTimestamp = timestamp;
  }

  function getTotalInsured() public view returns (uint256) {
    return totalInsured;
  }

  function setTotalInsured(uint256 _totalInsured) public {
    totalInsured = _totalInsured;
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

  function testBuyPolicy(
    address owner,
    uint256 _amount,
    uint256 _capitalInsured
  ) public {
    this.buyPolicy(owner, _amount, _capitalInsured);
  }

  function testRemainedDay(uint256 newUseRate, uint24 lastTick)
    public
    view
    returns (uint256)
  {
    return remainedDay(newUseRate, lastTick);
  }
}
