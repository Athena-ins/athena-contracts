// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IGnosisSafeWallet {
  enum Operation {
    Call,
    DelegateCall
  }

  // Events
  event AddedOwner(address indexed owner);
  event RemovedOwner(address indexed owner);
  event ApproveHash(
    bytes32 indexed approvedHash,
    address indexed owner
  );
  event ChangedFallbackHandler(address indexed handler);
  event ChangedGuard(address indexed guard);
  event ChangedThreshold(uint256 threshold);
  event DisabledModule(address indexed module);
  event EnabledModule(address indexed module);
  event ExecutionFailure(bytes32 indexed txHash, uint256 payment);
  event ExecutionFromModuleFailure(address indexed module);
  event ExecutionFromModuleSuccess(address indexed module);
  event ExecutionSuccess(bytes32 indexed txHash, uint256 payment);
  event SafeReceived(address indexed sender, uint256 value);
  event SafeSetup(
    address indexed initiator,
    address[] owners,
    uint256 threshold,
    address initializer,
    address fallbackHandler
  );
  event SignMsg(bytes32 indexed msgHash);

  // View Functions
  function VERSION() external view returns (string memory);

  function getOwners() external view returns (address[] memory);

  function getThreshold() external view returns (uint256);

  function isOwner(address owner) external view returns (bool);

  function nonce() external view returns (uint256);

  function getChainId() external view returns (uint256);

  function domainSeparator() external view returns (bytes32);

  function approvedHashes(
    address,
    bytes32
  ) external view returns (uint256);

  function signedMessages(bytes32) external view returns (uint256);

  function isModuleEnabled(
    address module
  ) external view returns (bool);

  function getModulesPaginated(
    address start,
    uint256 pageSize
  ) external view returns (address[] memory array, address next);

  function getStorageAt(
    uint256 offset,
    uint256 length
  ) external view returns (bytes memory);

  function getTransactionHash(
    address to,
    uint256 value,
    bytes calldata data,
    Operation operation,
    uint256 safeTxGas,
    uint256 baseGas,
    uint256 gasPrice,
    address gasToken,
    address refundReceiver,
    uint256 _nonce
  ) external view returns (bytes32);

  function encodeTransactionData(
    address to,
    uint256 value,
    bytes calldata data,
    Operation operation,
    uint256 safeTxGas,
    uint256 baseGas,
    uint256 gasPrice,
    address gasToken,
    address refundReceiver,
    uint256 _nonce
  ) external view returns (bytes memory);

  // State-Changing Functions
  function setup(
    address[] calldata _owners,
    uint256 _threshold,
    address to,
    bytes calldata data,
    address fallbackHandler,
    address paymentToken,
    uint256 payment,
    address payable paymentReceiver
  ) external;

  function execTransaction(
    address to,
    uint256 value,
    bytes calldata data,
    Operation operation,
    uint256 safeTxGas,
    uint256 baseGas,
    uint256 gasPrice,
    address gasToken,
    address payable refundReceiver,
    bytes calldata signatures
  ) external payable returns (bool success);

  function execTransactionFromModule(
    address to,
    uint256 value,
    bytes calldata data,
    Operation operation
  ) external returns (bool success);

  function execTransactionFromModuleReturnData(
    address to,
    uint256 value,
    bytes calldata data,
    Operation operation
  ) external returns (bool success, bytes memory returnData);

  function addOwnerWithThreshold(
    address owner,
    uint256 _threshold
  ) external;

  function removeOwner(
    address prevOwner,
    address owner,
    uint256 _threshold
  ) external;

  function swapOwner(
    address prevOwner,
    address oldOwner,
    address newOwner
  ) external;

  function changeThreshold(uint256 _threshold) external;

  function enableModule(address module) external;

  function disableModule(address prevModule, address module) external;

  function setFallbackHandler(address handler) external;

  function setGuard(address guard) external;

  function approveHash(bytes32 hashToApprove) external;

  function checkSignatures(
    bytes32 dataHash,
    bytes calldata data,
    bytes calldata signatures
  ) external view;

  function checkNSignatures(
    bytes32 dataHash,
    bytes calldata data,
    bytes calldata signatures,
    uint256 requiredSignatures
  ) external view;

  function simulateAndRevert(
    address targetContract,
    bytes calldata calldataPayload
  ) external;
}
