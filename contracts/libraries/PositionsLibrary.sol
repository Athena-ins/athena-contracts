// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

library PositionsLibrary {
  struct ProtocolPosition {
    uint128 poolId;
    uint256 amountProvided;
  }
}
