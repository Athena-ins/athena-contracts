// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

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

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function getClaimEvidence(
    uint256 claimId_
  ) external view returns (string[] memory) {
    return claimIdToEvidence[claimId_];
  }

  function getClaimCounterEvidence(
    uint256 claimId_
  ) external view returns (string[] memory) {
    return claimIdToCounterEvidence[claimId_];
  }

  /// =========================== ///
  /// ========= EVIDENCE ======== ///
  /// =========================== ///

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

  /// ======================== ///
  /// ========= ADMIN ======== ///
  /// ======================== ///

  function _addAgreementForProtocol(
    uint256 poolId_,
    string calldata ipfsAgreementCid_
  ) internal {
    protocolToAgreement[poolId_] = ipfsAgreementCid_;
  }
}
