// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./LowGasSafeMath.sol";

library Tick {
  using LowGasSafeMath for uint256;

  //Thao@NOTE: Info contient aussi lien vers position
  struct Info {
    uint256 capitalInsured; //dans position
    uint256 beginEmissionRate;
    uint256 beginNumerator;
  }

  function pushTickInfo(
    mapping(uint24 => Tick.Info[]) storage self,
    uint24 tick,
    uint256 capitalInsured,
    uint256 beginEmissionRate,
    uint256 beginNumerator
  ) internal {
    Info memory newInfo = Info(
      capitalInsured,
      beginEmissionRate,
      beginNumerator
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
    uint256 currentNumerator
  )
    internal
    view
    returns (uint256 capitalInsuredToRemove, uint256 emissionRateToRemove)
  {
    Tick.Info[] memory tickInfos = self[tick];
    for (uint256 i = 0; i < tickInfos.length; i++) {
      capitalInsuredToRemove += tickInfos[i].capitalInsured;
      emissionRateToRemove += ((tickInfos[i].beginEmissionRate *
        currentNumerator) / tickInfos[i].beginNumerator);
    }
  }
}
