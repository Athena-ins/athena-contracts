// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

// Libraries
import { BitMath } from "./BitMath.sol";

/// @title Packed tick initialized state library
/// @notice Stores a packed mapping of tick index to its initialized state
/// @dev The mapping uses int24 for keys since ticks are represented as int32 and there are 256 (2^8) values per word.
library TickBitmap {
  /// @notice Computes the position in the mapping where the initialized bit for a tick lives
  /// @param tick The tick for which to compute the position
  /// @return wordPos The key in the mapping containing the word in which the bit is stored
  /// @return bitPos The bit position in the word where the flag is stored
  function position(
    uint32 tick
  ) private pure returns (uint24 wordPos, uint8 bitPos) {
    wordPos = uint24(tick >> 8);
    bitPos = uint8(uint32(tick % 256));
  }

  /// @notice Flips the initialized state for a given tick from false to true, or vice versa
  /// @param self The mapping in which to flip the tick
  /// @param tick The tick to flip
  function flipTick(
    mapping(uint24 => uint256) storage self,
    uint32 tick
  ) internal {
    (uint24 wordPos, uint8 bitPos) = position(tick);
    uint256 mask = 1 << bitPos;
    self[wordPos] ^= mask;
  }

  function isInitializedTick(
    mapping(uint24 => uint256) storage self,
    uint32 tick
  ) internal view returns (bool) {
    (uint24 wordPos, uint8 bitPos) = position(tick);
    uint256 mask = 1 << bitPos;
    return (self[wordPos] & mask) != 0;
  }

  /// @notice Returns the next initialized tick contained in the same word (or adjacent word)
  /// as the tick that is to the right (greater than) of the given tick
  /// @param self The mapping in which to compute the next initialized tick
  /// @param tick The starting tick
  function nextTick(
    mapping(uint24 => uint256) storage self,
    uint32 tick
  ) internal view returns (uint32 next, bool initialized) {
    // start from the word of the next tick, since the current tick state doesn't matter
    (uint24 wordPos, uint8 bitPos) = position(tick + 1);
    // all the 1s at or to the left of the bitPos
    uint256 mask = ~((1 << bitPos) - 1);
    uint256 masked = self[wordPos] & mask;

    // if there are no initialized ticks to the left of the current tick, return leftmost in the word
    initialized = masked != 0;
    // overflow/underflow is possible, but prevented externally by limiting tick
    next = initialized
      ? (tick +
        1 +
        uint32(BitMath.leastSignificantBit(masked) - bitPos))
      : (tick + 1 + uint32(type(uint8).max - bitPos));
  }
}
