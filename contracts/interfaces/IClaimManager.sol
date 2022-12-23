// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IClaimManager {
  enum Status {
    Initial,
    Reclaimed,
    Disputed,
    Resolved
  }

  struct Claim {
    address from;
    uint256 createdAt;
    uint256 disputeId;
    uint256 policyId;
    uint256 arbitrationCost;
    uint256 amount;
    Status status;
    address challenger;
  }

  function inititateClaim(
    address account_,
    uint256 policyId_,
    uint128 protocolId_,
    uint256 amount_,
    string calldata ipfsMetaEvidenceHash_
  ) external payable;

  function linearClaimsView(uint256 beginDisputeId, uint256 numberOfClaims)
    external
    view
    returns (Claim[] memory claimsInfo);

  function addAgreementForProtocol(
    uint256 protocolId_,
    string calldata agreementIpfsHash_
  ) external;
}
