// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// libraries
import { VirtualPool } from "../libs/VirtualPool.sol";
import { PoolMath } from "../libs/PoolMath.sol";
import { DataTypes } from "../libs/DataTypes.sol";
// interfaces
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";

interface ILiquidityManager {
  // ======= STRUCTS ======= //

  struct CoverRead {
    uint256 coverId;
    uint64 poolId;
    uint256 coverAmount;
    bool isActive;
    uint256 premiumsLeft;
    uint256 dailyCost;
    uint256 premiumRate;
    uint32 lastTick; // Last last tick for which the cover is active
  }

  struct PositionRead {
    uint256 positionId;
    uint256 supplied;
    uint256 suppliedWrapped;
    uint256 commitWithdrawalTimestamp;
    uint256 strategyRewardIndex;
    uint64[] poolIds;
    uint256 newUserCapital;
    uint256 newUserCapitalWrapped;
    uint256[] coverRewards;
    uint256 strategyRewards;
  }

  struct Position {
    uint256 supplied;
    uint256 commitWithdrawalTimestamp;
    uint256 strategyRewardIndex;
    uint64[] poolIds;
  }

  struct PoolOverlap {
    uint64 poolId;
    uint256 amount;
  }

  struct VPoolRead {
    uint64 poolId;
    uint256 feeRate; // amount of fees on premiums in RAY
    uint256 leverageFeePerPool; // amount of fees per pool when using leverage
    IEcclesiaDao dao;
    IStrategyManager strategyManager;
    PoolMath.Formula formula;
    DataTypes.Slot0 slot0;
    uint256 strategyId;
    uint256 strategyRewardRate;
    address paymentAsset; // asset used to pay LP premiums
    address underlyingAsset; // asset required by the strategy
    address wrappedAsset; // tokenised strategy shares (ex: aTokens)
    bool isPaused;
    uint64[] overlappedPools;
    uint256 ongoingClaims;
    uint256[] compensationIds;
    uint256[] overlappedCapital;
    uint256 utilizationRate;
    uint256 totalLiquidity;
    uint256 availableLiquidity;
    uint256 strategyRewardIndex;
    uint256 lastOnchainUpdateTimestamp;
    uint256 premiumRate;
    // The amount of liquidity index that is in the current unfinished tick
    uint256 liquidityIndexLead;
  }

  function strategyManager() external view returns (IStrategyManager);

  function positions(
    uint256 tokenId_
  ) external view returns (Position memory);

  function coverToPool(
    uint256 tokenId_
  ) external view returns (uint64);

  function poolOverlaps(
    uint64 poolIdA_,
    uint64 poolIdB_
  ) external view returns (uint256);

  function coverInfo(
    uint256 tokenId_
  ) external view returns (CoverRead memory);

  function isCoverActive(
    uint256 tokenId
  ) external view returns (bool);

  function addClaimToPool(uint256 coverId_) external;

  function removeClaimFromPool(uint256 coverId_) external;

  function payoutClaim(uint256 poolId_, uint256 amount_) external;

  function takeInterestsWithYieldBonus(
    address account_,
    uint256 yieldBonus_,
    uint256[] calldata positionIds_
  ) external;
}
