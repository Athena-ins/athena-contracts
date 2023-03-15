// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ProtocolPool } from "./ProtocolPool.sol";
import { IProtocolFactory } from "./interfaces/IProtocolFactory.sol";

contract ProtocolFactory is IProtocolFactory, Ownable {
  address public core;
  address public claimManager;

  uint128 public nextPoolId;

  mapping(uint128 => mapping(uint128 => bool)) public incompatibilityProtocols;
  mapping(uint128 => Protocol) public protocolsMapping;

  constructor(address core_) {
    core = core_;
  }

  /// ========================= ///
  /// ========= EVENTS ======== ///
  /// ========================= ///

  error OnlyCore();
  error OnlyClaimManager();
  error OutOfRange();
  error ProtocolIsInactive();
  error SamePoolIds();
  error IncompatibleProtocol(uint256, uint256);
  error PoolIsPaused();

  /// ========================= ///
  /// ========= EVENTS ======== ///
  /// ========================= ///

  event NewProtocol(uint128);

  /// ============================ ///
  /// ========= MODIFIERS ======== ///
  /// ============================ ///

  modifier onlyCore() {
    if (msg.sender != core) revert OnlyCore();
    _;
  }

  modifier onlyClaimManager() {
    if (msg.sender != claimManager) revert OnlyClaimManager();
    _;
  }

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function getNextPoolId() external view returns (uint128) {
    return nextPoolId;
  }

  function getPoolAddress(uint128 poolId_) external view returns (address) {
    if (nextPoolId <= poolId_) revert OutOfRange();
    return protocolsMapping[poolId_].deployed;
  }

  function getPoolUnderlyingToken(
    uint128 poolId_
  ) external view returns (address) {
    if (nextPoolId <= poolId_) revert OutOfRange();
    return protocolsMapping[poolId_].token;
  }

  function getPool(uint128 poolId_) external view returns (Protocol memory) {
    if (nextPoolId <= poolId_) revert OutOfRange();
    return protocolsMapping[poolId_];
  }

  function arePoolsPaused(
    uint128[] calldata poolIds
  ) external view returns (bool) {
    for (uint256 i = 0; i < poolIds.length; i++) {
      uint128 poolId_ = poolIds[i];
      if (protocolsMapping[poolId_].paused != false) return false;
    }
    return true;
  }

  function canWithdrawFromPools(
    uint128[] calldata poolIds
  ) external view returns (bool) {
    for (uint256 i = 0; i < poolIds.length; i++) {
      uint128 poolId_ = poolIds[i];
      if (protocolsMapping[poolId_].paused != false) return false;
      if (protocolsMapping[poolId_].claimsOngoing != 0) return false;
    }
    return true;
  }

  function getIncompatiblePools(
    uint128 poolId_
  ) external view returns (uint128[] memory incompatiblePools) {
    uint128 nbPools = 0;
    uint128 index;

    // We need to compute the number of positions to create the array
    for (uint128 i = 0; i < nextPoolId; i++) {
      if (incompatibilityProtocols[poolId_][i] == true) nbPools++;
    }

    incompatiblePools = new uint128[](nbPools);

    for (uint128 i = 0; i < nextPoolId; i++) {
      if (incompatibilityProtocols[poolId_][i] == true) {
        incompatiblePools[index] = i;
        index++;
      }
    }
  }

  /// ================================= ///
  /// ========== DEPLOY POOL ========== ///
  /// ================================= ///

  // @bw a whitelist of compatible pools would be lighter & more secure
  // @bw this should also control wether pool underlying tokens are compatible
  function validePoolIds(uint128[] calldata poolIds) external view {
    for (uint256 i = 0; i < poolIds.length; i++) {
      uint128 poolId = poolIds[i];

      if (protocolsMapping[poolId].paused != false) revert PoolIsPaused();
      Protocol memory firstProtocol = protocolsMapping[poolId];

      if (firstProtocol.paused == true) revert ProtocolIsInactive();

      for (uint256 j = i + 1; j < poolIds.length; j++) {
        if (poolId == poolIds[j]) revert SamePoolIds();

        bool isIncompatible = incompatibilityProtocols[poolId][poolIds[j]];
        bool isIncompatibleReverse = incompatibilityProtocols[poolIds[j]][
          poolId
        ];

        if (isIncompatible == true || isIncompatibleReverse == true)
          revert IncompatibleProtocol(i, j);
      }
    }
  }

  function deployProtocol(
    address stablecoin_, // @bw variable here but hardcoded in core & other contracts
    string calldata name_,
    uint128[] calldata incompatiblePools_,
    uint128 commitDelay_,
    uint256 uOptimal_,
    uint256 r0_,
    uint256 rSlope1_,
    uint256 rSlope2_
  ) external onlyCore returns (uint128 poolId) {
    poolId = nextPoolId;
    nextPoolId++;

    address deployedAt = address(
      new ProtocolPool(
        poolId,
        core,
        stablecoin_,
        commitDelay_,
        uOptimal_,
        r0_,
        rSlope1_,
        rSlope2_
      )
    );

    for (uint256 i = 0; i < incompatiblePools_.length; i++) {
      incompatibilityProtocols[poolId][incompatiblePools_[i]] = true;
    }

    protocolsMapping[poolId] = Protocol({
      id: poolId,
      name: name_,
      deployed: deployedAt,
      paused: false,
      claimsOngoing: 0,
      stablecoin: stablecoin_,
      commitDelay: commitDelay_
    });

    emit NewProtocol(poolId);
  }

  /// ============================ ///
  /// ========== CLAIMS ========== ///
  /// ============================ ///

  /*
   * @notice
   * Registeres the claim in the protocol to prevent withdrawals until resolution
   * @param poolId_ The pool id of the protocol
   */
  function addClaimToPool(uint128 poolId_) external onlyClaimManager {
    protocolsMapping[poolId_].claimsOngoing++;
  }

  /*
   * @notice
   * Removes a resolved claim to allow withdrawals
   * @param poolId_ The pool id of the protocol
   */
  function removeClaimFromPool(uint128 poolId_) external onlyClaimManager {
    protocolsMapping[poolId_].claimsOngoing--;
  }

  /// =========================== ///
  /// ========== ADMIN ========== ///
  /// =========================== ///

  function setClaimManager(address claimManager_) external onlyOwner {
    claimManager = claimManager_;
  }

  function pauseProtocol(uint128 poolId, bool status) external onlyOwner {
    protocolsMapping[poolId].paused = status;
  }
}
