// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

interface IStrategyManager {
  function depositToStrategy(
    uint256 tokenId,
    uint256 amount
  ) external;

  function withdrawFromStrategy(
    uint256 tokenId,
    uint256 amount,
    address account,
    uint256 feeDiscount
  ) external;

  function payoutFromStrategy(
    uint256 amount,
    address claimant
  ) external;
}
