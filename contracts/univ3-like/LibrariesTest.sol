// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./libraries/LowGasSafeMath.sol";
import "./libraries/SafeCast.sol";
import "./libraries/Tick.sol";
import "./libraries/TickBitmap.sol";
import "./libraries/Position.sol";

contract LibrariesTest {
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

  //Thao@TEST
  function crossTick(uint24 tick, uint256 totalCumulativeRatio)
    public
    view
    returns (uint256, uint256)
  {
    return ticks.cross(tick, totalCumulativeRatio);
  }

  //Thao@TEST
  function isInitialized(uint24 tick) public view returns (bool) {
    return tickBitmap.isInitializedTick(tick);
  }

  //Thao@TEST
  function flipTick(uint24 tick) public {
    tickBitmap.flipTick(tick);
  }

  //Thao@TEST
  function nextInitializedTickInTheRightWithinOneWord(uint24 tick)
    public
    view
    returns (uint256, bool)
  {
    return tickBitmap.nextInitializedTickInTheRightWithinOneWord(tick);
  }

  //Thao@TEST
  function pushTick(
    uint24 tick,
    uint256 capitalInsured,
    uint256 emissionRate,
    uint256 cumulativeRatio
  ) public {
    if (!tickBitmap.isInitializedTick(tick)) {
      tickBitmap.flipTick(tick);
    }

    ticks.pushTickInfo(tick, capitalInsured, emissionRate, cumulativeRatio);
  }

  //Thao@TEST
  function removeTick(uint24 tick) public {
    ticks.clear(tick);
    tickBitmap.flipTick(tick);
  }
}
