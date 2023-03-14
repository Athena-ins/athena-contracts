// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IProtocolFactory {
  struct Protocol {
    uint128 id; //id in mapping
    uint128 claimsOngoing; // claim ongoing, lock funds when claim is ongoing
    uint128 commitDelay;
    bool paused; //is Active or paused
    string name; //Protocol name
    address stablecoin;
    address deployed; //Protocol Pool Address deployed
  }

  function getNextPoolId() external view returns (uint128);

  function getPool(uint128 poolId_) external view returns (Protocol memory);

  function getPoolAddress(uint128 poolId_) external view returns (address);

  function validePoolIds(uint128[] calldata poolIds) external view;

  function deployProtocol(
    address stablecoin,
    string calldata name,
    uint128[] calldata incompatiblePools,
    uint128 commitDelay,
    uint256 uOptimal,
    uint256 r0,
    uint256 rSlope1,
    uint256 rSlope2
  ) external returns (uint128 poolId);

  function addClaimToPool(uint128 poolId_) external;

  function removeClaimFromPool(uint128 poolId_) external;
}
