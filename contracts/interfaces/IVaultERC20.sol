// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IVaultERC20 {
  function depositFrom(address account_, uint256 amount_) external;

  function sendReward(address to_, uint256 amount_) external;
}
