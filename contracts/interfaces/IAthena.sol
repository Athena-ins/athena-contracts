// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IAthena {
  function getNextProtocolId() external view returns (uint256);

  function getPoolAddressById(uint128 _poolId) external view returns (address);

  function resolveClaim(
    uint256 _policyId,
    uint256 _amount,
    address _account
  ) external;
}
