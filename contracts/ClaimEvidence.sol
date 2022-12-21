// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IEvidence.sol";

contract ClaimEvidence is IEvidence {
  IArbitrator public immutable arbitrator;

  // Maps a protocol ID to its generic meta-evidence IPFS file hash
  mapping(uint256 => string) public metaEvidenceForProtocol;

  // Maps a claim ID to its designated meta-evidence ID
  mapping(uint256 => uint256) public claimIdToMetaEvidenceId;

  constructor(IArbitrator arbitrator_) {
    arbitrator = arbitrator_;
  }

  function _emitDisputeEvent(uint256 claimId_) internal {
    emit Dispute(
      arbitrator, // IArbitrator indexed _arbitrator,
      claimId_, // uint256 indexed _disputeID
      111111111111, // uint256 _metaEvidenceID
      111111111111 // uint256 _evidenceGroupID
    );
  }

  function _addMetaEvidenceForProtocol(
    uint256 protocolId_,
    string calldata metaEvidenceIpfsHash_
  ) internal {
    metaEvidenceForProtocol[protocolId_] = metaEvidenceIpfsHash_;
  }

  function _submitMetaEvidenceForClaim(
    uint256 protocolId_,
    string calldata evidence_
  ) internal {
    emit MetaEvidence(
      111111111111, // uint256 indexed _metaEvidenceID
      evidence_ // string _evidence
    );
  }

  function _submitEvidenceForClaim(uint256 claimId_) internal {
    emit Evidence(
      arbitrator, // IArbitrator indexed _arbitrator
      111111111111, // uint256 indexed _evidenceGroupID
      address(0), // address indexed _party
      "" // string _evidence
    );
  }
}
