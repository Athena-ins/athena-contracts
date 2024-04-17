// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.25;

/// @notice The pending root struct for a merkle tree distribution during the timelock.
struct PendingRoot {
  /// @dev The submitted pending root.
  bytes32 root;
  /// @dev The optional ipfs hash containing metadata about the root (e.g. the merkle tree itself).
  bytes32 ipfsHash;
  /// @dev The timestamp at which the pending root can be accepted.
  uint256 validAt;
}

/// @dev This interface is used for factorizing IMerkleDistributorStaticTyping and
/// IMerkleDistributor.
/// @dev Consider using the IMerkleDistributor interface instead of this one.
interface IMerkleDistributorBase {
  function root() external view returns (bytes32);

  function owner() external view returns (address);

  function timelock() external view returns (uint256);

  function ipfsHash() external view returns (bytes32);

  function isUpdater(address) external view returns (bool);

  function claimed(address, address) external view returns (uint256);

  function acceptRoot() external;

  function setRoot(bytes32 newRoot, bytes32 newIpfsHash) external;

  function setTimelock(uint256 newTimelock) external;

  function setRootUpdater(address updater, bool active) external;

  function revokePendingRoot() external;

  function setOwner(address newOwner) external;

  function submitRoot(bytes32 newRoot, bytes32 ipfsHash) external;

  function claim(
    address account,
    address reward,
    uint256 claimable,
    bytes32[] memory proof
  ) external returns (uint256 amount);
}

/// @dev This interface is inherited by the MerkleDistributor so that function signatures are checked by the
/// compiler.
/// @dev Consider using the IMerkleDistributor interface instead of this one.
interface IMerkleDistributorStaticTyping is IMerkleDistributorBase {
  function pendingRoot()
    external
    view
    returns (bytes32 root, bytes32 ipfsHash, uint256 validAt);
}

/// @title IMerkleDistributor
/// @author Morpho Labs
/// @custom:contact security@morpho.org
/// @dev Use this interface for MerkleDistributor to have access to all the functions with the appropriate
/// function signatures.
interface IMerkleDistributor is IMerkleDistributorBase {
  function pendingRoot() external view returns (PendingRoot memory);
}
