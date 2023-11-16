// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IStakedAtenPolicy {
  function hasPosition(uint256 coverId) external view returns (bool);

  function createStakingPosition(uint256 coverId, uint256 amount) external;

  function addToStake(uint256 coverId, uint256 amount) external;

  function withdrawStakedAten(
    uint256 coverId,
    uint256 amount,
    address account
  ) external;

  function withdrawRewards(
    uint256 coverId
  ) external returns (uint256 netRewards);

  function endStakingPositions(uint256[] calldata coverIds) external;

  function closePosition(
    uint256 coverId,
    address account
  ) external returns (uint256 netRewards);

  function updateBeforePremiumChange(uint256 coverId) external;
}
