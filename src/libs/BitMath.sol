// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.25;

/// @title BitMath
/// @dev This library provides functionality for computing bit properties of an unsigned integer
library BitMath {
  /// @notice Returns the index of the least significant bit of the number,
  ///     where the least significant bit is at index 0 and the most significant bit is at index 255
  /// @dev The function satisfies the property:
  ///     (x & 2**leastSignificantBit(x)) != 0 and (x & (2**(leastSignificantBit(x)) - 1)) == 0)
  /// @param x the value for which to compute the least significant bit, must be greater than 0
  /// @return r the index of the least significant bit
  function leastSignificantBit(
    uint256 x
  ) internal pure returns (uint8 r) {
    require(x > 0);

    r = 255;
    if (x & type(uint128).max > 0) {
      r -= 128;
    } else {
      x >>= 128;
    }
    if (x & type(uint64).max > 0) {
      r -= 64;
    } else {
      x >>= 64;
    }
    if (x & type(uint32).max > 0) {
      r -= 32;
    } else {
      x >>= 32;
    }
    if (x & type(uint16).max > 0) {
      r -= 16;
    } else {
      x >>= 16;
    }
    if (x & type(uint8).max > 0) {
      r -= 8;
    } else {
      x >>= 8;
    }
    if (x & 0xf > 0) {
      r -= 4;
    } else {
      x >>= 4;
    }
    if (x & 0x3 > 0) {
      r -= 2;
    } else {
      x >>= 2;
    }
    if (x & 0x1 > 0) r -= 1;
  }
}
