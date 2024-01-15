// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface ILiquidityManager is IERC721Enumerable {
  struct Cover {
    uint128 poolId;
    uint256 coverAmount;
    uint256 premiums;
    uint256 start;
    uint256 end;
  }

  struct Position {
    uint256 createdAt;
    uint256 amountSupplied;
    uint256 aaveScaledBalance;
    // @bw should save account fee rate instead of each position
    uint128 feeRate;
    uint128 commitDelay;
    uint128[] poolIds;
  }

  struct PositionInfo {
    uint256 positionId;
    uint256 premiumReceived;
    Position position;
  }

  function positionSize(
    uint256 tokenId_
  ) external view returns (uint256);

  function covers(
    uint256 tokenId
  ) external view returns (Cover memory);

  function positions(
    uint256 tokenId
  ) external view returns (Position memory);

  function isCoverActive(
    uint256 tokenId
  ) external view returns (bool);

  function syncPool(uint128 poolId_) external;

  function allCapitalSuppliedByAccount(
    address account_
  ) external view returns (uint256 _capitalSupplied);

  function committingWithdraw(uint256 tokenId_) external;

  function checkDelayAndClosePosition(uint tokenId_) external;

  function removePoolId(uint256 tokenId, uint128 poolId) external;

  function hasPositionOf(address to) external returns (bool);

  function depositToPosition(
    address account,
    uint256 amount,
    uint256 newAaveScaledBalance,
    uint128 feeRate,
    uint128[] calldata poolIds
  ) external;

  function updatePosition(
    address account,
    uint256 tokenId,
    uint256 amount,
    uint256 newAaveScaledBalance
  ) external;

  function takePositionInterests(
    address account,
    uint256 tokenId,
    uint128 poolId
  ) external;

  function allPositionTokensOfOwner(
    address owner
  ) external view returns (uint256[] memory tokenList);

  function takeInterestsInAllPools(
    address account,
    uint256 tokenId
  ) external;

  function updateFeeLevel(
    uint256 tokenId,
    uint128 newFeeLevel
  ) external;

  function getFirstPositionPoolId(
    uint256 tokenId_
  ) external view returns (uint128);

  function claimLiquidityRemoval(
    uint128 coverPoolId_,
    uint256 amount_,
    uint256 reserveNormalizedIncome_
  ) external;

  function getAvailableCapital(
    uint128 poolId
  ) external view returns (uint256);

  function addClaimToPool(uint256 coverId_) external;

  function removeClaimFromPool(uint256 coverId_) external;

  function payoutClaim(uint256 poolId_, uint256 amount_) external;
}
