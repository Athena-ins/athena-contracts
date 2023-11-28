// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IVaultERC20 {
  function coverRefundRewardsTotal() external view returns (uint256);

  function sendCoverRefundReward(address to_, uint256 amount_) external;

  function sendStakingReward(address to_, uint256 amount_) external;
}
