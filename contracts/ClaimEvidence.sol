// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IEvidence.sol";

contract ClaimEvidence is IEvidence {
  IArbitrator public immutable arbitrator;

  // Maps a protocol ID to its generic meta-evidence IPFS file hash
  mapping(uint256 => string) public protocolToAgreement;

  // Maps a dispute ID to its submited evidence
  mapping(uint256 => string[]) public disputeIdToEvidence;

  constructor(IArbitrator arbitrator_) {
    arbitrator = arbitrator_;
  }

  function _genMetaEvidenceId(uint256 protocolId_, uint256 disputeId_)
    internal
    pure
    returns (uint256)
  {
    return protocolId_ * 1e10 + disputeId_;
  }

  function _emitKlerosDisputeEvents(
    address challenger_,
    uint256 protocolId_,
    uint256 disputeId_,
    string calldata ipfsMetaEvidenceHash_
  ) internal {
    // Generate a meta-evidence ID based on inputs
    uint256 metaEvidenceId = _genMetaEvidenceId(protocolId_, disputeId_);

    // Annonces creation of dispute and linked meta-evidence items
    emit Dispute(arbitrator, disputeId_, metaEvidenceId, disputeId_);

    // Emit the meta-evidence event
    emit MetaEvidence(metaEvidenceId, ipfsMetaEvidenceHash_);

    // Send agreement information as evidence
    emit Evidence(
      arbitrator,
      disputeId_,
      challenger_,
      protocolToAgreement[protocolId_]
    );
  }

  function _submitKlerosEvidence(
    uint256 disputeId_,
    address party_,
    string[] calldata ipfsEvidenceHashes_
  ) internal {
    for (uint256 i = 0; i < ipfsEvidenceHashes_.length; i++) {
      // Save evidence files
      disputeIdToEvidence[disputeId_].push(ipfsEvidenceHashes_[i]);

      // Emit event for Kleros to pick up the evidence
      emit Evidence(
        arbitrator, // IArbitrator indexed _arbitrator
        disputeId_, // uint256 indexed _evidenceGroupID
        party_, // address indexed _party
        ipfsEvidenceHashes_[i] // string _evidence
      );
    }
  }

  function _addAgreementForProtocol(
    uint256 protocolId_,
    string calldata agreementIpfsHash_
  ) internal {
    protocolToAgreement[protocolId_] = agreementIpfsHash_;
  }
}
