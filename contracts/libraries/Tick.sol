// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./PremiumPosition.sol";

library Tick {
  using RayMath for uint256;
  using PremiumPosition for mapping(address => PremiumPosition.Info);

  function addOwner(
    mapping(uint32 => address[]) storage self,
    address owner,
    uint32 tick
  ) internal returns (uint224) {
    self[tick].push(owner);
    return uint224(self[tick].length - 1);
  }

  function removeOwner(
    mapping(uint32 => address[]) storage self,
    uint224 ownerIndexToRemove,
    uint32 tick
  ) internal {
    address[] storage owners = self[tick];
    owners[ownerIndexToRemove] = owners[owners.length - 1];
    owners.pop();
  }

  function getLastOwnerInTick(
    mapping(uint32 => address[]) storage self,
    uint32 tick
  ) internal view returns (address) {
    address[] memory owners = self[tick];
    return owners[owners.length - 1];
  }

  function getOwnerNumber(
    mapping(uint32 => address[]) storage self,
    uint32 tick
  ) internal view returns (uint256) {
    return self[tick].length;
  }

  function clear(mapping(uint32 => address[]) storage self, uint32 tick)
    internal
  {
    delete self[tick];
  }

  function cross(
    mapping(uint32 => address[]) storage self,
    mapping(address => PremiumPosition.Info) storage positions,
    uint32 tick
  ) internal view returns (uint256 policiesToRemove, uint256 capitalToRemove) {
    address[] memory owners = self[tick];
    for (uint256 i = 0; i < owners.length; i++) {
      capitalToRemove += positions.get(owners[i]).capitalInsured;
    }

    policiesToRemove = owners.length;
  }
}
