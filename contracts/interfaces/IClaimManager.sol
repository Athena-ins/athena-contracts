// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IClaimManager {
  function claimInitiator(uint256 disputeId_) external view returns (address);

  function inititateClaim(
    address account_,
    uint256 policyId_,
    uint128 protocolId_,
    uint256 amount_,
    string calldata ipfsMetaEvidenceHash_
  ) external payable;

  function addAgreementForProtocol(
    uint256 protocolId_,
    string calldata agreementIpfsHash_
  ) external;

  function submitEvidenceForClaim(
    uint256 claimId_,
    address party_,
    string[] calldata ipfsEvidenceHashes_
  ) external;

  function submitCounterEvidenceForClaim(
    uint256 claimId_,
    string[] calldata ipfsEvidenceHashes_
  ) external;

  function overruleIrregularClaim(uint256 disputeId_) external;
}
