// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8;

/// @title Position
/// @notice Positions represent an owner address' liquidity between a lower and upper tick boundary
/// @dev Positions store additional state for tracking fees owed to the position
library Position {
  // info stored for each user's position
  struct Info {
    address owner;
    uint24 lastTick;
    uint256 amount;
    uint256 capitalInsured;
  }

  /// @notice Returns the Info struct of a position, given an owner and position boundaries
  /// @param self The mapping containing all user positions
  /// @param owner The address of the position owner
  /// @param lastTick The upper tick boundary of the position
  /// @return position The position info struct of the given owners' position
  function get(
    mapping(bytes32 => Info) storage self,
    address owner,
    uint24 lastTick
  ) internal view returns (Position.Info storage position) {
    position = self[keccak256(abi.encodePacked(owner, lastTick))];
  }
}
