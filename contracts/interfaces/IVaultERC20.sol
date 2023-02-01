// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IVaultERC20 {
  function sendPolicyRefundReward(address to_, uint256 amount_) external;

  function sendStakingReward(address to_, uint256 amount_) external;
}
