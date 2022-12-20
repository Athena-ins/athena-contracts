// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IVaultERC20 {
  function deposit(uint256 _amount) external;

  function transfer(address _account, uint256 _amount) external;

  function sendReward(address to_, uint256 amount_) external;
}
