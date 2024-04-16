// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.20;

// contracts
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

// libraries
import { PendingRoot } from "../interfaces/IMerkleDistributor.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// interfaces
import { IMerkleDistributorStaticTyping } from "../interfaces/IMerkleDistributor.sol";

//======== ERRORS ========//

// Caller has not the updater role
error NotUpdaterRole();
// Caller is not the owner
error NotOwner();
// Unauthorized to change the root
error UnauthorizedRootChange();
// No pending root
error NoPendingRoot();
// Timelock is not expired
error TimelockNotExpired();
// Root is not set
error RootNotSet();
// Invalid proof or expired
error InvalidProofOrExpired();
// Claimable too low
error ClaimableTooLow();
// Already set
error AlreadySet();
// Already pending
error AlreadyPending();

/// @title MerkleDistributor
/// @author Athena
/// @notice This contract enables the distribution of various reward tokens to multiple accounts using different
/// permissionless Merkle trees. It is largely inspired by Morpho's Universal Rewards Distributor:
/// https://github.com/morpho-org/universal-rewards-distributor/blob/main/src/UniversalRewardsDistributor.sol
contract MerkleDistributor is IMerkleDistributorStaticTyping {
  using SafeERC20 for ERC20;

  /* STORAGE */

  /// @notice The merkle root of this distribution.
  bytes32 public root;

  /// @notice The optional ipfs hash containing metadata about the root (e.g. the merkle tree itself).
  bytes32 public ipfsHash;

  /// @notice The `amount` of `reward` token already claimed by `account`.
  mapping(address account => mapping(address reward => uint256 amount))
    public claimed;

  /// @notice The address that can update the distribution parameters, and freeze a root.
  address public owner;

  /// @notice The addresses that can update the merkle root.
  mapping(address => bool) public isUpdater;

  /// @notice The timelock related to root updates.
  uint256 public timelock;

  /// @notice The pending root of the distribution.
  /// @dev If the pending root is set, the root can be updated after the timelock has expired.
  /// @dev The pending root is skipped if the timelock is set to 0.
  PendingRoot public pendingRoot;

  /* MODIFIERS */

  /// @notice Reverts if the caller is not the owner.
  modifier onlyOwner() {
    if (msg.sender != owner) revert NotOwner();
    _;
  }

  /// @notice Reverts if the caller has not the updater role.
  modifier onlyUpdaterRole() {
    if (!isUpdater[msg.sender] && msg.sender != owner)
      revert NotUpdaterRole();
    _;
  }

  /* EVENTS */

  /// @notice Emitted when the merkle root is set.
  /// @param newRoot The new merkle root.
  /// @param newIpfsHash The optional ipfs hash containing metadata about the root (e.g. the merkle tree itself).
  event RootSet(bytes32 indexed newRoot, bytes32 indexed newIpfsHash);

  /// @notice Emitted when a new merkle root is proposed.
  /// @param caller The address of the caller.
  /// @param newRoot The new merkle root.
  /// @param newIpfsHash The optional ipfs hash containing metadata about the root (e.g. the merkle tree itself).
  event PendingRootSet(
    address indexed caller,
    bytes32 indexed newRoot,
    bytes32 indexed newIpfsHash
  );

  /// @notice Emitted when the pending root is revoked by the owner or an updater.
  event PendingRootRevoked(address indexed caller);

  /// @notice Emitted when a merkle tree distribution timelock is set.
  /// @param newTimelock The new merkle timelock.
  event TimelockSet(uint256 newTimelock);

  /// @notice Emitted when a merkle tree updater is added or removed.
  /// @param rootUpdater The merkle tree updater.
  /// @param active The merkle tree updater's active state.
  event RootUpdaterSet(address indexed rootUpdater, bool active);

  /// @notice Emitted when rewards are claimed.
  /// @param account The address for which rewards are claimed.
  /// @param reward The address of the reward token.
  /// @param amount The amount of reward token claimed.
  event Claimed(
    address indexed account,
    address indexed reward,
    uint256 amount
  );

  /// @notice Emitted when the ownership of a merkle tree distribution is transferred.
  /// @param newOwner The new owner of the contract.
  event OwnerSet(address indexed newOwner);

  /* CONSTRUCTOR */

  /// @notice Initializes the contract.
  /// @param initialOwner The initial owner of the contract.
  /// @param initialTimelock The initial timelock of the contract.
  /// @param initialRoot The initial merkle root.
  /// @param initialIpfsHash The optional ipfs hash containing metadata about the root (e.g. the merkle tree itself).
  /// @dev Warning: The `initialIpfsHash` might not correspond to the `initialRoot`.
  constructor(
    address initialOwner,
    uint256 initialTimelock,
    bytes32 initialRoot,
    bytes32 initialIpfsHash
  ) {
    _setOwner(initialOwner);
    _setTimelock(initialTimelock);
    _setRoot(initialRoot, initialIpfsHash);
  }

  /* EXTERNAL */

  /// @notice Submits a new merkle root.
  /// @param newRoot The new merkle root.
  /// @param newIpfsHash The optional ipfs hash containing metadata about the root (e.g. the merkle tree itself).
  /// @dev Warning: The `newIpfsHash` might not correspond to the `newRoot`.
  function submitRoot(
    bytes32 newRoot,
    bytes32 newIpfsHash
  ) external onlyUpdaterRole {
    if (
      newRoot == pendingRoot.root &&
      newIpfsHash == pendingRoot.ipfsHash
    ) {
      revert AlreadyPending();
    }

    pendingRoot = PendingRoot({
      root: newRoot,
      ipfsHash: newIpfsHash,
      validAt: block.timestamp + timelock
    });

    emit PendingRootSet(msg.sender, newRoot, newIpfsHash);
  }

  /// @notice Accepts and sets the current pending merkle root.
  /// @dev This function can only be called after the timelock has expired.
  /// @dev Anyone can call this function.
  function acceptRoot() external {
    if (pendingRoot.validAt == 0) revert NoPendingRoot();
    if (block.timestamp < pendingRoot.validAt)
      revert TimelockNotExpired();

    _setRoot(pendingRoot.root, pendingRoot.ipfsHash);
  }

  /// @notice Revokes the pending root.
  /// @dev Can be frontrunned with `acceptRoot` in case the timelock has passed.
  function revokePendingRoot() external onlyUpdaterRole {
    if (pendingRoot.validAt == 0) revert NoPendingRoot();

    delete pendingRoot;

    emit PendingRootRevoked(msg.sender);
  }

  /// @notice Claims rewards.
  /// @param account The address to claim rewards for.
  /// @param reward The address of the reward token.
  /// @param claimable The overall claimable amount of token rewards.
  /// @param proof The merkle proof that validates this claim.
  /// @return amount The amount of reward token claimed.
  /// @dev Anyone can claim rewards on behalf of an account.
  function claim(
    address account,
    address reward,
    uint256 claimable,
    bytes32[] calldata proof
  ) external returns (uint256 amount) {
    if (root == bytes32(0)) revert RootNotSet();
    if (
      !MerkleProof.verifyCalldata(
        proof,
        root,
        keccak256(
          bytes.concat(
            keccak256(abi.encode(account, reward, claimable))
          )
        )
      )
    ) revert InvalidProofOrExpired();

    if (claimable <= claimed[account][reward])
      revert ClaimableTooLow();

    amount = claimable - claimed[account][reward];

    claimed[account][reward] = claimable;

    ERC20(reward).safeTransfer(account, amount);

    emit Claimed(account, reward, amount);
  }

  /// @notice Forces update the root of a given distribution (bypassing the timelock).
  /// @param newRoot The new merkle root.
  /// @param newIpfsHash The optional ipfs hash containing metadata about the root (e.g. the merkle tree itself).
  /// @dev This function can only be called by the owner of the distribution or by updaters if there is no timelock.
  /// @dev Set to bytes32(0) to remove the root.
  function setRoot(
    bytes32 newRoot,
    bytes32 newIpfsHash
  ) external onlyUpdaterRole {
    if (newRoot == root && newIpfsHash == ipfsHash)
      revert AlreadySet();
    if (timelock != 0 && msg.sender != owner)
      revert UnauthorizedRootChange();

    _setRoot(newRoot, newIpfsHash);
  }

  /// @notice Sets the timelock of a given distribution.
  /// @param newTimelock The new timelock.
  /// @dev This function can only be called by the owner of the distribution.
  /// @dev The timelock modification are not applicable to the pending values.
  function setTimelock(uint256 newTimelock) external onlyOwner {
    if (newTimelock == timelock) revert AlreadySet();

    _setTimelock(newTimelock);
  }

  /// @notice Sets the root updater of a given distribution.
  /// @param updater The address of the root updater.
  /// @param active Whether the root updater should be active or not.
  function setRootUpdater(
    address updater,
    bool active
  ) external onlyOwner {
    if (isUpdater[updater] == active) revert AlreadySet();

    isUpdater[updater] = active;

    emit RootUpdaterSet(updater, active);
  }

  /// @notice Sets the `owner` of the distribution to `newOwner`.
  function setOwner(address newOwner) external onlyOwner {
    if (newOwner == owner) revert AlreadySet();

    _setOwner(newOwner);
  }

  /* INTERNAL */

  /// @dev Sets the `root` and `ipfsHash` to `newRoot` and `newIpfsHash`.
  /// @dev Deletes the pending root.
  /// @dev Warning: The `newIpfsHash` might not correspond to the `newRoot`.
  function _setRoot(bytes32 newRoot, bytes32 newIpfsHash) internal {
    root = newRoot;
    ipfsHash = newIpfsHash;

    delete pendingRoot;

    emit RootSet(newRoot, newIpfsHash);
  }

  /// @dev Sets the `owner` of the distribution to `newOwner`.
  function _setOwner(address newOwner) internal {
    owner = newOwner;

    emit OwnerSet(newOwner);
  }

  /// @dev Sets the `timelock` to `newTimelock`.
  function _setTimelock(uint256 newTimelock) internal {
    timelock = newTimelock;

    emit TimelockSet(newTimelock);
  }
}
