// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IStakedAten {
  struct RewardRateLevel {
    uint256 amountSupplied;
    uint128 aprStaking;
  }

  function stake(
    address _account,
    uint256 _amount,
    uint256 _usdCapitalSupplied
  ) external;

  function claimRewards(address account_) external returns (uint256);

  function withdraw(address _account, uint256 _amount) external;

  function updateUserRewardRate(address account_, uint256 newUsdCapital_)
    external;

  function setStakingRewards(RewardRateLevel[] calldata stakingLevels_)
    external;

  function positionOf(address _account) external view returns (uint256);
}
