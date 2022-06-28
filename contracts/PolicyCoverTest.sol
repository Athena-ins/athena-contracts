// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./PolicyCover.sol";

import "hardhat/console.sol";

contract PolicyCoverTest is PolicyCover {
  using TickBitmap for mapping(uint16 => uint256);

  constructor(
    uint256 _uOptimal,
    uint256 _r0,
    uint256 _rSlope1,
    uint256 _rSlope2
  ) ERC20("", "") PolicyCover(_uOptimal, _r0, _rSlope1, _rSlope2) {}

  function addTotalInsured(uint256 capital) public {
    slot0.totalInsuredCapital += capital;
  }

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
    return slot0.premiumRate;
  }

  function setRate(uint256 rate) public {
    slot0.premiumRate = rate;
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

  // function getPremiumSpent() public view returns (uint256) {
  //   return slot0.premiumSpent;
  // }

  // function setPremiumSpent(uint256 premiumSpent) public {
  //   slot0.premiumSpent = premiumSpent;
  // }

  function getLastUpdateTimestamp() public view returns (uint256) {
    return slot0.lastUpdateTimestamp;
  }

  function setLastUpdateTimestamp(uint256 timestamp) public {
    slot0.lastUpdateTimestamp = timestamp;
  }

  function getTotalInsured() public view returns (uint256) {
    return slot0.totalInsuredCapital;
  }

  function setTotalInsured(uint256 _totalInsured) public {
    slot0.totalInsuredCapital = _totalInsured;
  }

  function getAvailableCapital() public view returns (uint256) {
    return availableCapital;
  }

  function setAvailableCapital(uint256 _availableCapital) public {
    availableCapital = _availableCapital;
  }

  function testIsInitializedTick(uint24 tick) public view returns (bool) {
    return tickBitmap.isInitializedTick(tick);
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

  function testGetInfo(address owner) public view returns (uint256, uint256) {
    return getInfo(owner);
  }

  function testMulOverFlow() public pure returns (uint256) {
    return type(uint256).max * type(uint256).max;
  }

  function testAddOverFlow() public pure returns (uint256) {
    return type(uint256).max + type(uint256).max;
  }

  function testSubOverFlow() public pure returns (uint256) {
    return 1 - type(uint256).max;
  }

  function testDivByZero() public pure returns (uint256) {
    uint256 zero = 0;
    return 30 / zero;
  }
}
