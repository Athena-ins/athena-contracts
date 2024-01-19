// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface ILiquidityManager {
  function addClaimToPool(uint256 coverId_) external;

  function removeClaimFromPool(uint256 coverId_) external;

  function payoutClaim(uint256 poolId_, uint256 amount_) external;

  function feeDiscountUpdate(
    address account_,
    uint256 prevFeeDiscount_
  ) external;
}
