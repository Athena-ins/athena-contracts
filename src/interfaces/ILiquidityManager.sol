// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// Libraries
import { VirtualPool } from "../libs/VirtualPool.sol";
import { PoolMath } from "../libs/PoolMath.sol";
import { DataTypes } from "../libs/DataTypes.sol";

// Interfaces
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

  // ======= FUNCTIONS ======= //

  // View Functions
  function strategyManager() external view returns (IStrategyManager);

  function coverToPool(
    uint256 coverId
  ) external view returns (uint64);

  function positions(
    uint256 tokenId
  ) external view returns (Position memory);

  function positionInfo(
    uint256 positionId
  ) external view returns (PositionRead memory);

  function positionInfos(
    uint256[] calldata positionIds
  ) external view returns (PositionRead[] memory);

  function coverInfo(
    uint256 coverId
  ) external view returns (CoverRead memory);

  function coverInfos(
    uint256[] calldata coverIds
  ) external view returns (CoverRead[] memory);

  function poolInfo(
    uint64 poolId
  ) external view returns (VPoolRead memory);

  function poolInfos(
    uint256[] calldata poolIds
  ) external view returns (VPoolRead[] memory);

  function isCoverActive(
    uint256 coverId
  ) external view returns (bool);

  function poolOverlaps(
    uint64 poolIdA,
    uint64 poolIdB
  ) external view returns (uint256);

  // Position Management
  function openPosition(
    uint256 amount,
    bool isWrapped,
    uint64[] calldata poolIds
  ) external;

  function addLiquidity(
    uint256 positionId,
    uint256 amount,
    bool isWrapped
  ) external;

  function takeInterests(uint256 positionId) external;

  function commitRemoveLiquidity(uint256 positionId) external;

  function uncommitRemoveLiquidity(uint256 positionId) external;

  function removeLiquidity(
    uint256 positionId,
    uint256 amount,
    bool keepWrapped
  ) external;

  // Cover Management
  function openCover(
    uint64 poolId,
    uint256 coverAmount,
    uint256 premiums
  ) external;

  function updateCover(
    uint256 coverId,
    uint256 coverToAdd,
    uint256 coverToRemove,
    uint256 premiumsToAdd,
    uint256 premiumsToRemove
  ) external;

  // External Contract Functions
  function addClaimToPool(uint256 coverId_) external;

  function removeClaimFromPool(uint256 coverId_) external;

  function payoutClaim(
    uint256 coverId_,
    uint256 compensationAmount_
  ) external;

  function takeInterestsWithYieldBonus(
    address account_,
    uint256 yieldBonus_,
    uint256[] calldata positionIds_
  ) external;

  // Admin Functions
  function pausePool(uint64 poolId, bool isPaused) external;

  function freezeProtocol(bool isFrozen) external;

  function updatePoolCompatibility(
    uint64[] calldata poolIds,
    uint64[][] calldata poolIdCompatible,
    bool[][] calldata poolIdCompatibleStatus
  ) external;

  function updatePoolConfig(
    uint64 poolId,
    uint256 feeRate,
    uint256 uOptimal,
    uint256 r0,
    uint256 rSlope1,
    uint256 rSlope2
  ) external;

  function updateConfig(
    IEcclesiaDao ecclesiaDao,
    IStrategyManager strategyManager,
    address claimManager,
    address yieldRewarder,
    uint256 withdrawDelay,
    uint256 maxLeverage,
    uint256 leverageFeePerPool
  ) external;

  function purgeExpiredCoversUpTo(
    uint64 poolId,
    uint256 timestamp
  ) external;

  function updatePositionUpTo(
    uint256 positionId,
    uint256[] calldata endCompensationIndexes
  ) external;
}
