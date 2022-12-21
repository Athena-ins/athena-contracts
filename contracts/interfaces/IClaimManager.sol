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
    address payable from;
    uint256 createdAt;
    uint256 disputeId;
    uint256 klerosId;
    uint256 policyId;
    uint256 arbitrationCost;
    uint256 amount;
    Status status;
    address payable challenger;
  }

  function claim(
    address _account,
    uint256 _policyId,
    uint256 _amount
  ) external payable;

  function linearClaimsView(uint256 beginDisputeId, uint256 numberOfClaims)
    external
    view
    returns (Claim[] memory claimsInfo);

  function addMetaEvidenceForProtocol(
    uint256 protocolId_,
    string calldata metaEvidenceIpfsHash_
  ) external;
}
