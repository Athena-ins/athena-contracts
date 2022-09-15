// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8;

import "./RayMath.sol";

library PremiumPosition {
  using RayMath for uint256;

  struct Info {
    uint256 tokenId;
    uint256 capitalInsured;
    uint256 beginPremiumRate;
    uint32 lastTick;
    uint224 ownerIndex;
  }

  function get(
    mapping(address => PremiumPosition.Info) storage self,
    address owner
  ) internal view returns (PremiumPosition.Info storage) {
    return self[owner];
  }

  function replaceAndRemoveOwner(
    mapping(address => PremiumPosition.Info) storage self,
    address ownerToRemove,
    address ownerToReplace
  ) internal {
    self[ownerToReplace].ownerIndex = self[ownerToRemove].ownerIndex;
    delete self[ownerToRemove];
  }

  function removeOwner(
    mapping(address => PremiumPosition.Info) storage self,
    address owner
  ) internal returns (uint256 tokenId, uint256 insuredCapital) {
    tokenId = self[owner].tokenId;
    insuredCapital = self[owner].capitalInsured;
    delete self[owner];
  }

  function getBeginEmissionRate(PremiumPosition.Info memory positionInfo)
    internal
    pure
    returns (uint256)
  {
    return
      positionInfo.capitalInsured.rayMul(positionInfo.beginPremiumRate / 100) /
      365;
  }

  function hasOwner(
    mapping(address => PremiumPosition.Info) storage self,
    address owner
  ) internal view returns (bool) {
    return self[owner].capitalInsured > 0;
  }
}
