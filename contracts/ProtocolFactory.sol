// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/utils/Strings.sol";

import "./ProtocolPool.sol";

import "./interfaces/IProtocolFactory.sol";

contract ProtocolFactory is IProtocolFactory {
  address public immutable core;

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

  function getPool(uint128 poolId_) external view returns (Protocol memory) {
    if (nextPoolId <= poolId_) revert OutOfRange();
    return protocolsMapping[poolId_];
  }

  /// ================================= ///
  /// ========== DEPLOY POOL ========== ///
  /// ================================= ///

  function validePoolIds(uint128[] calldata poolIds) external view {
    for (uint256 firstIndex = 0; firstIndex < poolIds.length; firstIndex++) {
      Protocol memory firstProtocol = protocolsMapping[poolIds[firstIndex]];

      if (firstProtocol.paused == true) revert ProtocolIsInactive();

      for (
        uint256 secondIndex = firstIndex + 1;
        secondIndex < poolIds.length;
        secondIndex++
      ) {
        if (poolIds[firstIndex] == poolIds[secondIndex]) revert SamePoolIds();

        bool isIncompatible = incompatibilityProtocols[poolIds[firstIndex]][
          poolIds[secondIndex]
        ];
        bool isIncompatibleReverse = incompatibilityProtocols[
          poolIds[secondIndex]
        ][poolIds[firstIndex]];

        if (isIncompatible == true || isIncompatibleReverse == true)
          revert IncompatibleProtocol(firstIndex, secondIndex);
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
