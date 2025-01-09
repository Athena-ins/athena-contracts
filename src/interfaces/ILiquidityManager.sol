// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

interface ILiquidityManager {
  // Structs
  struct Position {
    uint256 supplied;
    uint256 commitWithdrawalTimestamp;
    uint64[] poolIds;
    uint256 strategyRewardIndex;
  }

  struct PositionRead {
    uint256 supplied;
    uint256 commitWithdrawalTimestamp;
    uint64[] poolIds;
    uint256 strategyRewardIndex;
    uint256 pendingRewards;
    uint256 coverRewards;
  }

  struct CoverRead {
    uint256 coverAmount;
    uint256 premiumsLeft;
    uint256 expirationTimestamp;
  }

  struct VPoolRead {
    uint256 totalLiquidity;
    uint256 availableLiquidity;
    uint256 premiumRate;
    uint256 secondsPerTick;
    uint256 feeRate;
    uint256 ongoingClaims;
    uint256 strategyId;
    bool isPaused;
    address underlyingAsset;
    address wrappedAsset;
  }

  // Pool Management Events
  event PoolCreated(uint64 indexed poolId);
  event PoolUpdated(uint64 indexed poolId);

  // Position Events
  event PositionOpenned(uint256 indexed positionId);
  event InterestsTaken(uint256 indexed positionId);
  event PositionLiquidityUpdated(
    uint256 indexed positionId,
    uint256 amountAdded,
    uint256 amountRemoved
  );

  // Cover Events
  event CoverOpenned(uint64 indexed poolId, uint256 indexed coverId);
  event CoverUpdated(uint256 indexed coverId);
  event CoverClosed(uint256 indexed coverId);
  event CompensationPaid(
    uint256 indexed poolId,
    uint256 indexed compensationId
  );

  // View Functions
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
    address ecclesiaDao,
    address strategyManager,
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
