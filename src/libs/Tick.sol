// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

// Libraries
import { RayMath } from "./RayMath.sol";

library Tick {
  using RayMath for uint256;

  function addCoverId(
    mapping(uint32 => uint256[]) storage self,
    uint256 coverId,
    uint32 tick
  ) internal returns (uint224) {
    self[tick].push(coverId);
    return uint224(self[tick].length - 1);
  }

  function removeCoverId(
    mapping(uint32 => uint256[]) storage self,
    uint224 coverIdIndexToRemove,
    uint32 tick
  ) internal {
    uint256[] storage coverIds = self[tick];

    if (coverIdIndexToRemove != coverIds.length - 1)
      coverIds[coverIdIndexToRemove] = coverIds[coverIds.length - 1];

    coverIds.pop();
  }

  function getLastCoverIdInTick(
    mapping(uint32 => uint256[]) storage self,
    uint32 tick
  ) internal view returns (uint256) {
    uint256[] storage coverIds = self[tick];

    return coverIds[coverIds.length - 1];
  }

  function nbCoversInTick(
    mapping(uint32 => uint256[]) storage self,
    uint32 tick
  ) internal view returns (uint256) {
    return self[tick].length;
  }

  function clear(
    mapping(uint32 => uint256[]) storage self,
    uint32 tick
  ) internal {
    delete self[tick];
  }
}
