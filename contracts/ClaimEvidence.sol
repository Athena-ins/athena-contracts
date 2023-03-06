// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IEvidence.sol";

contract ClaimEvidence is IEvidence {
  IArbitrator public immutable arbitrator;

  // Maps a protocol ID to its generic meta-evidence IPFS file CID
  mapping(uint256 => string) public protocolToAgreement;

  // Maps a claim ID to its submited evidence
  mapping(uint256 => string[]) public claimIdToEvidence;
  mapping(uint256 => string[]) public claimIdToCounterEvidence;

  constructor(IArbitrator arbitrator_) {
    arbitrator = arbitrator_;
  }

  function getClaimEvidence(uint256 claimId_)
    external
    view
    returns (string[] memory)
  {
    return claimIdToEvidence[claimId_];
  }

  function getClaimCounterEvidence(uint256 claimId_)
    external
    view
    returns (string[] memory)
  {
    return claimIdToCounterEvidence[claimId_];
  }

  function _genMetaEvidenceId(uint256 poolId_, uint256 disputeId_)
    internal
    pure
    returns (uint256)
  {
    return poolId_ * 1e10 + disputeId_;
  }

  function _emitKlerosDisputeEvents(
    address challenger_,
    uint256 disputeId_,
    uint256 poolId_,
    string storage ipfsMetaEvidenceCid_
  ) internal {
    // Generate a meta-evidence ID based on inputs
    uint256 metaEvidenceId = _genMetaEvidenceId(poolId_, disputeId_);

    // Annonces creation of dispute and linked meta-evidence items
    // @bw should find deterministic metaevidenceid
    emit Dispute(arbitrator, disputeId_, metaEvidenceId, disputeId_);

    // Emit the meta-evidence event
    // @bw should be emmitted at claim creationg
    emit MetaEvidence(metaEvidenceId, ipfsMetaEvidenceCid_);

    // Send agreement information as evidence
    // @bw already included in meta
    emit Evidence(
      arbitrator,
      disputeId_,
      challenger_,
      protocolToAgreement[poolId_]
    );
  }

  function _submitKlerosEvidence(
    uint256 claimId_,
    address party_,
    bool isClaimant,
    string[] calldata ipfsEvidenceCids_
  ) internal {
    string[] storage evidence = isClaimant
      ? claimIdToEvidence[claimId_]
      : claimIdToCounterEvidence[claimId_];

    for (uint256 i = 0; i < ipfsEvidenceCids_.length; i++) {
      // Save evidence files
      evidence.push(ipfsEvidenceCids_[i]);

      // Emit event for Kleros to pick up the evidence
      emit Evidence(
        arbitrator, // IArbitrator indexed _arbitrator
        claimId_, // uint256 indexed _evidenceGroupID
        party_, // address indexed _party
        ipfsEvidenceCids_[i] // string _evidence
      );
    }
  }

  function _addAgreementForProtocol(
    uint256 poolId_,
    string calldata ipfsAgreementCid_
  ) internal {
    protocolToAgreement[poolId_] = ipfsAgreementCid_;
  }
}
