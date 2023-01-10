// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IFixedRateStakeable {
  struct RewardRateLevel {
    uint256 amountSupplied;
    uint128 aprStaking;
  }
}
