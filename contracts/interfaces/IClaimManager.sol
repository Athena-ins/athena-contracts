// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IClaimManager {
  function claim(
     address _account,
    uint256 _policyId,
    uint256 _amount
  ) external payable;
}
