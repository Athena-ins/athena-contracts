// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

library VirtualPool {
  struct Pool {
    uint256 id;
    mapping(uint32 => uint256[]) ticks;
  }

  function poolId(Pool storage self) internal view returns (uint256) {
    return self.id;
  }

  function addTick(
    Pool storage self,
    uint32 _tick,
    uint256 _amount
  ) internal {
    self.ticks[_tick].push(_amount);
  }
}
