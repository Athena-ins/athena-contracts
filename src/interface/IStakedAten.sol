// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IStakedAten {
  function stake(address _account, uint256 _amount) external;

  function claimRewards(address account_) external returns (uint256);

  function withdraw(address _account, uint256 _amount) external;

  function updateUserRewardRate(address account_) external;

  function positionOf(
    address _account
  ) external view returns (uint256);

  function getUserFeeRate(
    address account_
  ) external view returns (uint128);
}
