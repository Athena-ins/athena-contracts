// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IClaimManager {
  function getProtocolAgreement(
    uint128 poolId
  ) external view returns (string memory);

  function claimInitiator(uint256 disputeId_) external view returns (address);

  function claimChallenger(uint256 claimId_) external view returns (address);

  function addAgreementForProtocol(
    uint128 poolId_,
    string calldata ipfsAgreementCid_
  ) external;
}
