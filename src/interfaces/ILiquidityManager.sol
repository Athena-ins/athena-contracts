// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface ILiquidityManager {
  // ======= STRUCTS ======= //

  struct CoverRead {
    uint256 coverId;
    uint64 poolId;
    uint256 coverAmount;
    uint256 premiums; // @bw never actually used by the protocol
    uint256 start;
    uint256 end;
    uint256 premiumsLeft;
    uint256 currentEmissionRate;
    uint256 premiumRate;
  }

  struct Cover {
    uint64 poolId;
    uint256 coverAmount;
    uint256 premiums;
    uint256 start;
    uint256 end;
  }

  struct Position {
    uint256 supplied;
    uint256 commitWithdrawalTimestamp;
    uint64[] poolIds;
  }

  struct PoolOverlap {
    uint64 poolId;
    uint256 amount;
  }

  function positions(
    uint256 tokenId_
  ) external view returns (Position memory);

  function covers(
    uint256 tokenId_
  ) external view returns (CoverRead memory);

  function isCoverActive(
    uint256 tokenId
  ) external view returns (bool);

  function addClaimToPool(uint256 coverId_) external;

  function removeClaimFromPool(uint256 coverId_) external;

  function payoutClaim(uint256 poolId_, uint256 amount_) external;

  function yieldBonusUpdate(uint256[] calldata positionIds_) external;
}
