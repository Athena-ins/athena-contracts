// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Libraries
import { VirtualPool } from "./VirtualPool.sol";

contract LiquidityManagerV2 {
  using VirtualPool for VirtualPool.Pool;
  mapping(uint256 => VirtualPool.Pool) public pools;

  constructor() {
    //
  }

  function getPoolId(
    uint256 _poolId
  ) external view returns (uint256) {
    VirtualPool.Pool storage pool = pools[_poolId];
    return pool.poolId();
  }

  function addTick(
    uint256 _poolId,
    uint32 _tick,
    uint256 _amount
  ) external {
    VirtualPool.Pool storage pool = pools[_poolId];
    pool.addTick(_tick, _amount);
  }
}
