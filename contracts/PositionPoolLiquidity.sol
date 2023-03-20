// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

// Libraries
import { RayMath } from "./libraries/RayMath.sol";

// @bw we want to move in the ratio calc

contract PositionPoolLiquidity {

  // Maps poolId 0 -> poolId 1 -> overlapping capital
  // @dev poolId A -> poolId A points to a pool's self available liquidity
  // @dev liquidity overlap is always registered in the lower poolId
  mapping(uint128 _poolId0 => mapping(uint128 _poolId1 => uint256 _amount))
    public overlappingLiquidity;
  // Maps pool IDs to the overlapped pool IDs
  mapping(uint128 _poolId => uint128[] _poolDependants) public dependantPools;

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function getOverlappingCapital(
    uint128 poolIdA,
    uint128 poolIdB
  ) external view returns (uint256) {
    (uint128 poolId0, uint128 poolId1) = poolIdA < poolIdB
      ? (poolIdA, poolIdB)
      : (poolIdB, poolIdA);

    return overlappingLiquidity[poolId0][poolId1];
  }

  function getAvailableCapital(uint128 poolId) external view returns (uint256) {
    return overlappingLiquidity[poolId][poolId];
  }

  function getAllOverlappingCapital(
    uint128 poolId
  ) external view returns (PoolOverlap[] memory) {
    uint256 nbPoolIds = dependantPools[poolId].length;

    PoolOverlap[] memory overlaps = new PoolOverlap[](nbPoolIds);

    for (uint256 i = 0; i < nbPoolIds; i++) {
      uint128 currentPool = dependantPools[poolId][i];

      (uint128 poolId0, uint128 poolId1) = currentPool < poolId
        ? (currentPool, poolId)
        : (poolId, currentPool);

      overlaps[i] = PoolOverlap({
        poolId: currentPool,
        amount: overlappingLiquidity[poolId0][poolId1]
      });
    }

    return overlaps;
  }

  /// =========================== ///
  /// ========= OVERLAPS ======== ///
  /// =========================== ///

  function addOverlappingCapital(
    uint128[] memory poolIds_,
    uint256 amount_
  ) public {
    uint256 nbPoolIds = poolIds_.length;

    for (uint128 i = 0; i < nbPoolIds; i++) {
      for (uint128 j = 0; j < nbPoolIds; j++) {
        uint128 poolId0 = poolIds_[i];
        uint128 poolId1 = poolIds_[j];

        // Avoid incrementing twice the same pool combination
        if (poolId1 < poolId0) continue;

        if (poolId0 != poolId1 && overlappingLiquidity[poolId0][poolId1] == 0) {
          dependantPools[poolId0].push(poolId1);
          dependantPools[poolId1].push(poolId0);
        }

        // We allow poolId0 to be equal to poolId1 for single pool deposits
        overlappingLiquidity[poolId0][poolId1] += amount_;
      }
    }
  }

  function removeOverlappingCapital(
    uint128[] memory poolIds_,
    uint256 amount_
  ) public {
    uint256 nbPoolIds = poolIds_.length;

    for (uint128 i = 0; i < nbPoolIds; i++) {
      for (uint128 j = 0; j < nbPoolIds; j++) {
        uint128 poolId0 = poolIds_[i];
        uint128 poolId1 = poolIds_[j];

        // Avoid incrementing twice the same pool combination
        if (poolId1 < poolId0) continue;

        // We allow poolId0 to be equal to poolId1 for single pool withdrawals
        overlappingLiquidity[poolId0][poolId1] -= amount_;
      }
    }
  }
}
