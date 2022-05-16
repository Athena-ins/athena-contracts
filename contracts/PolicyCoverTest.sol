// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./PolicyCover.sol";

import "hardhat/console.sol";

contract PolicyCoverTest is PolicyCover {
  constructor(address _underlyingAsset) PolicyCover(_underlyingAsset) {}

  function testGetSlot0() public view returns (Slot0 memory) {
    return slot0;
  }

  function testGetRate() public view returns (uint256) {
    return slot0.useRate;
  }

  function testSetRate(uint256 rate) public {
    slot0.useRate = rate;
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
