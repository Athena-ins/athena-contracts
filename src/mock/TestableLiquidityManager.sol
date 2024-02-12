// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Contracts
import { LiquidityManager } from "../managers/LiquidityManager.sol";
import { TestableVirtualPool } from "./TestableVirtualPool.sol";

// Libraries
import { VirtualPool } from "../libs/VirtualPool.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";
import { IStaking } from "../interfaces/IStaking.sol";
import { IFarmingRange } from "../interfaces/IFarmingRange.sol";
import { IAthenaPositionToken } from "../interfaces/IAthenaPositionToken.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TestableLiquidityManager is
  LiquidityManager,
  TestableVirtualPool
{
  /**
   * @notice Returns the virtual pool's storage pointer
   * @param poolId_ The ID of the pool
   * @return The virtual pool's storage pointer
   */
  function _getPool(
    uint64 poolId_
  ) internal view returns (VirtualPool.VPool storage) {
    return LiquidityManager._pools[poolId_];
  }

  constructor(
    IAthenaPositionToken positionToken_,
    IAthenaCoverToken coverToken_,
    IStaking staking_,
    IFarmingRange farming_,
    IEcclesiaDao ecclesiaDao_,
    IStrategyManager strategyManager_,
    address claimManager_,
    uint256 withdrawDelay_,
    uint256 maxLeverage_,
    uint256 leverageFeePerPool_
  )
    LiquidityManager(
      positionToken_,
      coverToken_,
      staking_,
      farming_,
      ecclesiaDao_,
      strategyManager_,
      claimManager_,
      withdrawDelay_,
      maxLeverage_,
      leverageFeePerPool_
    )
    TestableVirtualPool(_getPool)
  {}
}
