// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./LowGasSafeMath.sol";

library Tick {
  using LowGasSafeMath for uint256;

  struct Info {
    uint256 capitalInsured;
    uint256 beginEmissionRate;
    uint256 beginCumutativeRatio;
  }

  function pushTickInfo(
    mapping(uint24 => Tick.Info[]) storage self,
    uint24 tick,
    uint256 capitalInsured,
    uint256 beginEmissionRate,
    uint256 beginCumutativeRatio
  ) internal {
    Info memory newInfo = Info(
      capitalInsured,
      beginEmissionRate,
      beginCumutativeRatio
    );
    self[tick].push(newInfo);
  }

  function clear(mapping(uint24 => Tick.Info[]) storage self, uint24 tick)
    internal
  {
    delete self[tick];
  }

  function cross(
    mapping(uint24 => Tick.Info[]) storage self,
    uint24 tick,
    uint256 totalCumulativeRatio
  )
    internal
    view
    returns (uint256 capitalInsuredToRemove, uint256 emissionRateToRemove)
  {
    Tick.Info[] memory tickInfos = self[tick];
    for (uint256 i = 0; i < tickInfos.length; i++) {
      capitalInsuredToRemove += tickInfos[i].capitalInsured;
      emissionRateToRemove +=
        tickInfos[i].beginEmissionRate *
        (totalCumulativeRatio / tickInfos[i].beginCumutativeRatio);
    }
  }
}
