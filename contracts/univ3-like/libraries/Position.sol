// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8;

import "../../libraries/RayMath.sol";

library Position {
  using RayMath for uint256;

  struct Info {
    uint256 capitalInsured;
    uint256 beginUseRate;
    //Thao@TODO: pack ownerIndex and lastTick in uint256 for saving gas
    uint256 ownerIndex;
    uint24 lastTick;
  }

  function get(mapping(address => Position.Info) storage self, address owner)
    internal
    view
    returns (Position.Info storage)
  {
    return self[owner];
  }

  function replaceAndRemoveOwner(
    mapping(address => Position.Info) storage self,
    address ownerToRemove,
    address ownerToReplace
  ) internal {
    self[ownerToReplace].ownerIndex = self[ownerToRemove].ownerIndex;
    delete self[ownerToRemove];
  }

  function removeOwner(
    mapping(address => Position.Info) storage self,
    address owner
  ) internal {
    delete self[owner];
  }

  function getBeginEmissionRate(Position.Info storage self)
    internal
    view
    returns (uint256)
  {
    return
      self.capitalInsured.rayMul(self.beginUseRate).rayDiv(
        36500000000000000000000000000000
      ); //36500000000000000000000000000000 = 100 * 365 * 1e27
  }

  function hasOwner(
    mapping(address => Position.Info) storage self,
    address owner
  ) internal view returns (bool) {
    return self[owner].capitalInsured > 0;
  }
}
