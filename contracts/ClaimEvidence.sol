// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IEvidence.sol";

contract ClaimEvidence is IEvidence {
  IArbitrator public immutable arbitrator;

  // Maps a protocol ID to its generic meta-evidence IPFS file hash
  mapping(uint256 => string) public protocolToMetaEvidence;

  // Maps a dispute ID to its submited evidence
  mapping(uint256 => string[]) public disputeToEvidence;

  constructor(IArbitrator arbitrator_) {
    arbitrator = arbitrator_;
  }

  function _genMetaEvidenceId(uint256 disputeId_, uint256 protocolId_)
    internal
    pure
    returns (uint256)
  {
    return protocolId_ * 1e10 + disputeId_;
  }

  function _emitKlerosDisputeEvents(uint256 disputeId_, uint256 protocolId_)
    internal
  {
    // @bw should add initial kleros creation event from arbitrator

    uint256 metaEvidenceId = _genMetaEvidenceId(disputeId_, protocolId_);

    emit Dispute(
      arbitrator, // IArbitrator indexed _arbitrator
      disputeId_, // uint256 indexed _disputeID
      metaEvidenceId, // uint256 _metaEvidenceID
      disputeId_ // uint256 _evidenceGroupID
    );

    // Get the address of the meta-evidence dedicated to the protocol
    string memory protocolMetaEvidence = protocolToMetaEvidence[protocolId_];

    // Emit the meta-evidence event
    emit MetaEvidence(
      metaEvidenceId, // uint256 indexed _metaEvidenceID
      protocolMetaEvidence // string _evidence
    );
  }

  function _submitKlerosEvidence(
    uint256 disputeId_,
    address party_,
    string[] calldata ipfsEvidenceHashes_
  ) internal {
    for (uint256 i = 0; i < ipfsEvidenceHashes_.length; i++) {
      // Save evidence files
      disputeToEvidence[disputeId_].push(ipfsEvidenceHashes_[i]);

      // Emit event for Kleros to pick up the evidence
      emit Evidence(
        arbitrator, // IArbitrator indexed _arbitrator
        disputeId_, // uint256 indexed _evidenceGroupID
        party_, // address indexed _party
        ipfsEvidenceHashes_[i] // string _evidence
      );
    }
  }

  function _addMetaEvidenceForProtocol(
    uint256 protocolId_,
    string calldata metaEvidenceIpfsHash_
  ) internal {
    protocolToMetaEvidence[protocolId_] = metaEvidenceIpfsHash_;
  }
}
