// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./IFixedRateStakeable.sol";

interface IStakedAten is IFixedRateStakeable {
  function stake(
    address _account,
    uint256 _amount,
    uint256 _usdCapitalSupplied
  ) external;

  function withdraw(address _account, uint256 _amount) external;

  function setStakingRewards(RewardRateLevel[] calldata stakingLevels_)
    external;

  function positionOf(address _account) external view returns (uint256);
}
