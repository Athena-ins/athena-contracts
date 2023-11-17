// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Libs
import { RayMath } from "../libs/RayMath.sol";
// Interfaces
import { IProtocolPool } from "../interface/IProtocolPool.sol";
import { IProtocolFactory } from "../interface/IProtocolFactory.sol";

// @bw we want to move in the ratio calc

contract PositionPoolLiquidity {
  using RayMath for uint256;

  IProtocolFactory public poolFactoryInterface;

  struct PoolOverlap {
    uint128 poolId;
    uint256 amount;
  }

  // Maps poolId 0 -> poolId 1 -> overlapping capital
  // @dev poolId A -> poolId A points to a pool's self available liquidity
  // @dev liquidity overlap is always registered in the lower poolId
  mapping(uint128 _poolId0 => mapping(uint128 _poolId1 => uint256 _amount))
    public overlappingLiquidity;
  // Maps pool IDs to the overlapped pool IDs
  mapping(uint128 _poolId => uint128[] _poolDependants) public dependantPools;

  constructor(address poolFactory) {
    poolFactoryInterface = IProtocolFactory(poolFactory);
  }

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function _getAvailableCapital(
    uint128 poolId
  ) internal view returns (uint256) {
    return overlappingLiquidity[poolId][poolId];
  }

  function getOverlappingCapital(
    uint128 poolIdA,
    uint128 poolIdB
  ) external view returns (uint256) {
    (uint128 poolId0, uint128 poolId1) = poolIdA < poolIdB
      ? (poolIdA, poolIdB)
      : (poolIdB, poolIdA);

    return overlappingLiquidity[poolId0][poolId1];
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

  /// ========================== ///
  /// ========= HELPERS ======== ///
  /// ========================== ///

  function _getPoolAddressById(
    uint128 poolId_
  ) internal view returns (address) {
    return poolFactoryInterface.getPoolAddress(poolId_);
  }

  /// =========================== ///
  /// ========= OVERLAPS ======== ///
  /// =========================== ///

  function _addOverlappingCapital(
    uint128[] memory poolIds_,
    uint256 amount_
  ) internal {
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

        // We allow poolId0 to be equal to poolId1 to increment a pool's own capital
        overlappingLiquidity[poolId0][poolId1] += amount_;
      }
    }
  }

  function _removeOverlappingCapital(
    uint128[] memory poolIds_,
    uint256 amount_
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint128 i = 0; i < nbPoolIds; i++) {
      for (uint128 j = 0; j < nbPoolIds; j++) {
        uint128 poolId0 = poolIds_[i];
        uint128 poolId1 = poolIds_[j];

        // Avoid incrementing twice the same pool combination
        if (poolId1 < poolId0) continue;

        // We allow poolId0 to be equal to poolId1 to decrement a pool's own capital
        overlappingLiquidity[poolId0][poolId1] -= amount_;
      }
    }
  }

  /// ========================= ///
  /// ========= CLAIMS ======== ///
  /// ========================= ///

  function _claimLiquidityRemoval(
    uint128 coverPoolId_,
    uint256 amount_,
    uint256 reserveNormalizedIncome_
  ) internal {
    uint256 availableCapital = overlappingLiquidity[coverPoolId_][coverPoolId_];
    uint256 ratio = amount_.rayDiv(availableCapital);

    uint256 nbPoolIds = dependantPools[coverPoolId_].length;

    for (uint128 i = 0; i < nbPoolIds + 1; i++) {
      uint128 currentPool = i == nbPoolIds
        ? coverPoolId_
        : dependantPools[coverPoolId_][i];

      (uint128 poolId0, uint128 poolId1) = currentPool < coverPoolId_
        ? (currentPool, coverPoolId_)
        : (coverPoolId_, currentPool);

      uint256 overlapAmount = overlappingLiquidity[poolId0][poolId1];
      uint256 amountToRemove = overlapAmount.rayMul(ratio);

      overlappingLiquidity[poolId0][poolId1] -= amountToRemove;
      overlappingLiquidity[currentPool][currentPool] -= amountToRemove;

      // call process claim on protocol pool
      address poolAddress = _getPoolAddressById(currentPool);
      // IProtocolPool(poolAddress).processClaim(coverPoolId_,amountToRemove);
    }
  }
}
