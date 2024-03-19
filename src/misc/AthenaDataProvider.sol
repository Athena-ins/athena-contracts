// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

// interfaces
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
// libraries
import { VirtualPool } from "../libs/VirtualPool.sol";
import { DataTypes } from "../libs/DataTypes.sol";
import { PoolMath } from "../libs/PoolMath.sol";

library AthenaDataProvider {
  /**
   * @notice Returns the up to date position data of a token
   * @param positionId_ The ID of the position
   * @return The position data
   */
  function positionInfo(
    ILiquidityManager.Position storage position_,
    uint256 positionId_
  ) external view returns (ILiquidityManager.PositionRead memory) {
    uint256[] memory coverRewards = new uint256[](
      position_.poolIds.length
    );
    VirtualPool.UpdatedPositionInfo memory info;

    DataTypes.VPool storage pool = VirtualPool.getPool(
      position_.poolIds[0]
    );

    // All pools have same strategy since they are compatible
    uint256 latestStrategyRewardIndex = ILiquidityManager(
      address(this)
    ).strategyManager().getRewardIndex(pool.strategyId);

    for (uint256 i; i < position_.poolIds.length; i++) {
      uint256 currentLiquidityIndex = VirtualPool
        ._refreshSlot0(position_.poolIds[i], block.timestamp)
        .liquidityIndex;

      info = VirtualPool._getUpdatedPositionInfo(
        position_.poolIds[i],
        position_.poolIds,
        VirtualPool.UpdatePositionParams({
          tokenId: positionId_,
          currentLiquidityIndex: currentLiquidityIndex,
          userCapital: position_.supplied,
          strategyRewardIndex: position_.strategyRewardIndex,
          latestStrategyRewardIndex: latestStrategyRewardIndex,
          strategyId: pool.strategyId,
          itCompounds: pool.strategyManager.itCompounds(
            pool.strategyId
          ),
          endCompensationId: pool.compensationIds.length,
          nbPools: position_.poolIds.length
        })
      );

      coverRewards[i] = info.coverRewards;
    }

    return
      ILiquidityManager.PositionRead({
        supplied: position_.supplied,
        commitWithdrawalTimestamp: position_
          .commitWithdrawalTimestamp,
        strategyRewardIndex: latestStrategyRewardIndex,
        poolIds: position_.poolIds,
        newUserCapital: info.newUserCapital,
        coverRewards: coverRewards,
        strategyRewards: info.strategyRewards
      });
  }

  /**
   * @notice Returns the up to date cover data of a token
   * @param coverId_ The ID of the cover
   * @return The cover data formatted for reading
   */
  function coverInfo(
    uint256 coverId_
  ) public view returns (ILiquidityManager.CoverRead memory) {
    uint64 poolId = ILiquidityManager(address(this)).coverToPool(
      coverId_
    );
    DataTypes.VPool storage pool = VirtualPool.getPool(poolId);

    VirtualPool.CoverInfo memory info = VirtualPool
      ._computeRefreshedCoverInfo(poolId, coverId_);

    uint32 lastTick = pool.covers[coverId_].lastTick;
    uint256 coverAmount = pool.covers[coverId_].coverAmount;

    return
      ILiquidityManager.CoverRead({
        coverId: coverId_,
        poolId: poolId,
        coverAmount: coverAmount,
        premiumsLeft: info.premiumsLeft,
        dailyCost: info.dailyCost,
        premiumRate: info.premiumRate,
        isActive: info.isActive,
        lastTick: lastTick
      });
  }

  /**
   * @notice Returns the virtual pool's storage
   * @param poolId_ The ID of the pool
   * @return The virtual pool's storage
   */
  function poolInfo(
    uint64 poolId_
  ) public view returns (ILiquidityManager.VPoolRead memory) {
    DataTypes.VPool storage pool = VirtualPool.getPool(poolId_);

    // Save the last update timestamp to know when the pool was last updated onchain
    uint256 lastOnchainUpdateTimestamp = pool
      .slot0
      .lastUpdateTimestamp;

    DataTypes.Slot0 memory slot0 = VirtualPool._refreshSlot0(
      poolId_,
      block.timestamp
    );

    uint256 nbOverlappedPools = pool.overlappedPools.length;
    uint256[] memory overlappedCapital = new uint256[](
      nbOverlappedPools
    );
    for (uint256 i; i < nbOverlappedPools; i++) {
      overlappedCapital[i] = ILiquidityManager(address(this))
        .poolOverlaps(pool.poolId, pool.overlappedPools[i]);
    }

    uint256 totalLiquidity = VirtualPool.totalLiquidity(poolId_);
    uint256 utilization = PoolMath._utilization(
      slot0.coveredCapital,
      totalLiquidity
    );
    uint256 premiumRate = PoolMath.getPremiumRate(
      pool.formula,
      utilization
    );

    uint256 liquidityIndexLead = PoolMath.computeLiquidityIndex(
      utilization,
      premiumRate,
      // This is the ignoredDuration in the _refreshSlot0 function
      block.timestamp - slot0.lastUpdateTimestamp
    );

    return
      ILiquidityManager.VPoolRead({
        poolId: pool.poolId,
        feeRate: pool.feeRate,
        leverageFeePerPool: pool.leverageFeePerPool,
        dao: pool.dao,
        strategyManager: pool.strategyManager,
        formula: pool.formula,
        slot0: slot0,
        strategyId: pool.strategyId,
        paymentAsset: pool.paymentAsset,
        underlyingAsset: pool.underlyingAsset,
        wrappedAsset: pool.wrappedAsset,
        isPaused: pool.isPaused,
        overlappedPools: pool.overlappedPools,
        ongoingClaims: pool.ongoingClaims,
        compensationIds: pool.compensationIds,
        overlappedCapital: overlappedCapital,
        utilizationRate: utilization,
        totalLiquidity: totalLiquidity,
        availableLiquidity: VirtualPool.availableLiquidity(poolId_),
        strategyRewardIndex: ILiquidityManager(address(this))
          .strategyManager()
          .getRewardIndex(pool.strategyId),
        lastOnchainUpdateTimestamp: lastOnchainUpdateTimestamp,
        premiumRate: premiumRate,
        liquidityIndexLead: liquidityIndexLead
      });
  }

  function coverInfos(
    uint256[] calldata coverIds
  ) external view returns (ILiquidityManager.CoverRead[] memory) {
    ILiquidityManager.CoverRead[]
      memory result = new ILiquidityManager.CoverRead[](
        coverIds.length
      );

    for (uint256 i; i < coverIds.length; i++) {
      result[i] = coverInfo(coverIds[i]);
    }

    return result;
  }

  function poolInfos(
    uint256[] calldata poolIds
  ) external view returns (ILiquidityManager.VPoolRead[] memory) {
    ILiquidityManager.VPoolRead[]
      memory result = new ILiquidityManager.VPoolRead[](
        poolIds.length
      );

    for (uint256 i; i < poolIds.length; i++) {
      result[i] = poolInfo(uint64(poolIds[i]));
    }

    return result;
  }
}
