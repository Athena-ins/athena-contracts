// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IAthena {
  function resolveClaim(uint256 _policyId, uint256 _amount, address _account) external;
}
