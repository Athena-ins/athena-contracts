// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "../libraries/LowGasSafeMath.sol";
import "../libraries/SafeCast.sol";
import "../libraries/Tick.sol";
import "../libraries/TickBitmap.sol";

contract PolicyCover {
  using LowGasSafeMath for uint256;
  using LowGasSafeMath for int256;
  using SafeCast for uint256;
  using SafeCast for int256;
  using Tick for mapping(uint24 => Tick.Info);
  using TickBitmap for mapping(uint16 => uint256);
  //   using Position for mapping(bytes32 => Position.Info);
  //   using Position for Position.Info;

  mapping(uint24 => Tick.Info) public ticks;
  mapping(uint16 => uint256) public tickBitmap;

  // mapping(bytes32 => Position.Info) public override positions;

  struct Slot0 {
    uint24 tick;
    uint256 useRate;
    uint256 emissionRate;
    uint256 lastUpdateTime;
  }
}

//getUseRateRatio(old, new)
//upToDateTicks <Slot0, ...>
//mintPremium
//addTick
//burnPremium
//removeTick
//withdrawPremium

//Thao@NOTE: pas besoin de emissionRateNet et grosse car on ajoute tj dans emissionRate quand qqun arrive et retire ce nombre plus tard

//Tick.Info{subEmissionRate}
