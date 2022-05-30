// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./Position.sol";

library Tick {
  using WadRayMath for uint256;
  using Position for mapping(address => Position.Info);
  using Position for Position.Info;

  function addOwner(
    mapping(uint24 => address[]) storage self,
    address owner,
    uint24 tick
  ) internal returns (uint256) {
    self[tick].push(owner);
    return self[tick].length - 1;
  }

  function removeOwner(
    mapping(uint24 => address[]) storage self,
    uint256 ownerIndexToRemove,
    uint24 tick
  ) internal {
    address[] storage owners = self[tick];
    owners[ownerIndexToRemove] = owners[owners.length - 1];
    owners.pop();
  }

  function getLastOwnerInTick(
    mapping(uint24 => address[]) storage self,
    uint24 tick
  ) internal view returns (address) {
    address[] memory owners = self[tick];
    return owners[owners.length - 1];
  }

  function getOwnerNumber(
    mapping(uint24 => address[]) storage self,
    uint24 tick
  ) internal view returns (uint256) {
    return self[tick].length;
  }

  function clear(mapping(uint24 => address[]) storage self, uint24 tick)
    internal
  {
    delete self[tick];
  }

  function cross(
    mapping(uint24 => address[]) storage self,
    mapping(address => Position.Info) storage positions,
    uint24 tick,
    uint256 currentUseRate
  )
    internal
    view
    returns (uint256 capitalToRemove, uint256 emissionRateToRemove)
  {
    address[] memory owners = self[tick];
    for (uint256 i = 0; i < owners.length; i++) {
      Position.Info storage position = positions.get(owners[i]);
      capitalToRemove += position.capitalInsured;
      emissionRateToRemove += position
        .getBeginEmissionRate()
        .rayMul(currentUseRate)
        .rayDiv(position.beginUseRate);
    }
  }
}
