// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IVaultERC20 {
  function sendReward(address to_, uint256 amount_) external;
}
