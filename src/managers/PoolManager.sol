// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// Contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
// Interfaces
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IOwnable } from "../interfaces/IOwnable.sol";

/// @title Pool Manager Contract
/// @notice Manages batch operations for pools in the Liquidity Manager
/// @dev All functions are restricted to owner access
contract PoolManager is Ownable {
  /// @notice Reference to the Liquidity Manager contract
  ILiquidityManager public liquidityManager;

  /// @notice Initializes the Pool Manager with a Liquidity Manager contract
  /// @param _liquidityManager Address of the Liquidity Manager contract
  constructor(
    ILiquidityManager _liquidityManager
  ) Ownable(msg.sender) {
    liquidityManager = _liquidityManager;
  }

  /// @notice Configuration parameters for a pool
  /// @param poolId Unique identifier of the pool
  /// @param feeRate Fee rate for the pool
  /// @param uOptimal Optimal utilization rate
  /// @param r0 Base interest rate
  /// @param rSlope1 First slope parameter for interest rate calculation
  /// @param rSlope2 Second slope parameter for interest rate calculation
  struct PoolConfig {
    uint64 poolId;
    uint256 feeRate;
    uint256 uOptimal;
    uint256 r0;
    uint256 rSlope1;
    uint256 rSlope2;
  }

  /// @notice Parameters required for creating a new pool
  /// @param paymentAsset Address of the token used for payments
  /// @param strategyId Identifier of the strategy to be used
  /// @param feeRate Fee rate for the pool
  /// @param uOptimal Optimal utilization rate
  /// @param r0 Base interest rate
  /// @param rSlope1 First slope parameter for interest rate calculation
  /// @param rSlope2 Second slope parameter for interest rate calculation
  /// @param compatiblePools Array of pool IDs that are compatible with this pool
  struct PoolCreationParams {
    address paymentAsset;
    uint256 strategyId;
    uint256 feeRate;
    uint256 uOptimal;
    uint256 r0;
    uint256 rSlope1;
    uint256 rSlope2;
    uint64[] compatiblePools;
  }

  /// @notice Pauses or unpauses multiple pools in a single transaction
  /// @param poolIds Array of pool IDs to modify
  /// @param isPaused True to pause pools, false to unpause
  function batchPausePool(
    uint64[] calldata poolIds,
    bool isPaused
  ) external onlyOwner {
    for (uint256 i = 0; i < poolIds.length; i++) {
      liquidityManager.pausePool(poolIds[i], isPaused);
    }
  }

  /// @notice Creates multiple pools in a single transaction
  /// @param params Array of pool creation parameters
  function batchCreatePool(
    PoolCreationParams[] calldata params
  ) external onlyOwner {
    for (uint256 i = 0; i < params.length; i++) {
      liquidityManager.createPool(
        params[i].paymentAsset,
        params[i].strategyId,
        params[i].feeRate,
        params[i].uOptimal,
        params[i].r0,
        params[i].rSlope1,
        params[i].rSlope2,
        params[i].compatiblePools
      );
    }
  }

  /// @notice Updates configuration for multiple pools in a single transaction
  /// @param configs Array of pool configurations to update
  function batchUpdatePoolConfig(
    PoolConfig[] calldata configs
  ) external onlyOwner {
    for (uint256 i = 0; i < configs.length; i++) {
      liquidityManager.updatePoolConfig(
        configs[i].poolId,
        configs[i].feeRate,
        configs[i].uOptimal,
        configs[i].r0,
        configs[i].rSlope1,
        configs[i].rSlope2
      );
    }
  }

  /// @notice Updates compatibility between multiple pools in a single transaction
  /// @param poolIds Array of pool IDs to update
  /// @param poolIdCompatible Array of arrays containing compatible pool IDs for each pool
  /// @param poolIdCompatibleStatus Array of arrays containing compatibility status for each pool pair
  function batchUpdatePoolCompatibility(
    uint64[] calldata poolIds,
    uint64[][] calldata poolIdCompatible,
    bool[][] calldata poolIdCompatibleStatus
  ) external onlyOwner {
    liquidityManager.updatePoolCompatibility(
      poolIds,
      poolIdCompatible,
      poolIdCompatibleStatus
    );
  }

  /// @notice Transfers ownership of the Liquidity Manager contract
  /// @param newOwner Address of the new owner
  function transferLiquidityManagerOwnership(
    address newOwner
  ) external onlyOwner {
    IOwnable(address(liquidityManager)).transferOwnership(newOwner);
  }

  /// @notice Updates the Liquidity Manager contract address
  /// @param _liquidityManager Address of the new Liquidity Manager contract
  function updateLiquidityManager(
    ILiquidityManager _liquidityManager
  ) external onlyOwner {
    liquidityManager = _liquidityManager;
  }
}
