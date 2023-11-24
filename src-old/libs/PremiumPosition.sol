// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

import "./RayMath.sol";

library PremiumPosition {
  using RayMath for uint256;

  struct Info {
    uint256 beginPremiumRate;
    uint32 lastTick;
    uint224 coverIdIndex;
  }

  function replaceAndRemoveCoverId(
    mapping(uint256 => PremiumPosition.Info) storage self,
    uint256 coverIdToRemove,
    uint256 coverIdToReplace
  ) internal {
    if (coverIdToRemove != coverIdToReplace)
      self[coverIdToReplace].coverIdIndex = self[coverIdToRemove]
        .coverIdIndex;

    delete self[coverIdToRemove];
  }
}
