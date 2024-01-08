// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

interface IStrategyManager {
  function getRewardIndex(
    uint256 strategyId
  ) external view returns (uint256);

  function rewardsOf(
    uint256 strategyId_,
    uint256 tokenId_
  ) external view returns (uint256);

  function underlyingAsset(
    uint256 strategyId_
  ) external view returns (address);

  function assets(
    uint256 strategyId_
  ) external view returns (address underlying, address wrapped);

  function wrappedToUnderlying(
    uint256 strategyId_,
    uint256 amountWrapped_
  ) external view returns (uint256);

  function depositToStrategy(
    uint256 strategyId_,
    uint256 tokenId,
    uint256 amount
  ) external;

  function withdrawFromStrategy(
    uint256 strategyId_,
    uint256 tokenId,
    uint256 amount,
    address account,
    uint256 /*feeDiscount_*/
  ) external;

  function depositWrappedToStrategy(
    uint256 strategyId_,
    uint256 tokenId_
  ) external;

  function withdrawWrappedFromStrategy(
    uint256 strategyId_,
    uint256 tokenId_,
    uint256 amountUnderlying_,
    address account_,
    uint256 /*feeDiscount_*/
  ) external;

  function lockRewardsPostWithdrawalCommit(
    uint256 strategyId_,
    uint256 tokenId_
  ) external;

  function withdrawRewards(
    uint256 strategyId_,
    uint256 tokenId_,
    address account_,
    uint256 /*feeDiscount_*/
  ) external;

  function payoutFromStrategy(
    uint256 strategyId_,
    uint256 amount,
    address claimant
  ) external;
}
