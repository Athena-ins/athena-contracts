// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IPositionsManager is IERC721Enumerable {
  struct Position {
    uint256 createdAt;
    uint256 amountSupplied;
    uint256 aaveScaledBalance;
    uint128 feeRate;
    uint128 commitDelay;
    uint128[] poolIds;
  }

  struct PositionInfo {
    uint256 positionId;
    uint256 premiumReceived;
    Position position;
  }

  function position(uint256 tokenId) external view returns (Position memory);

  function allCapitalSuppliedByAccount(
    address account_
  ) external view returns (uint256 _capitalSupplied);

  function committingWithdraw(uint256 tokenId_) external;

  function checkDelayAndClosePosition(uint tokenId_) external;

  function removePoolId(uint256 tokenId, uint128 poolId) external;

  function hasPositionOf(address to) external returns (bool);

  function deposit(
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

  function takeInterest(
    address account,
    uint256 tokenId,
    uint128 poolId
  ) external;

  function allPositionTokensOfOwner(
    address owner
  ) external view returns (uint256[] memory tokenList);

  function takeInterestsInAllPools(address account, uint256 tokenId) external;

  function updateFeeLevel(uint256 tokenId, uint128 newFeeLevel) external;

  function getFirstPositionPoolId(
    uint256 tokenId_
  ) external view returns (uint128);
}
