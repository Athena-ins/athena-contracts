/**
 *  @authors: [@epiqueras]
 *  @reviewers: [@remedcu]
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.25;

// Interfaces
import { IArbitrator } from "./IArbitrator.sol";

/** @title IArbitrable
 *  @author Enrique Piqueras - <enrique@kleros.io>
 *  Arbitrable interface.
 *  When developing arbitrable contracts, we need to:
 *  -Define the action taken when a ruling is received by the contract. We should do so in executeRuling.
 *  -Allow dispute creation. For this a function must:
 *      -Call arbitrator.createDispute.value(_fee)(_choices,_extraData);
 *      -Create the event Dispute(_arbitrator,_disputeID,_rulingOptions);
 */
interface IArbitrable {
  /** @dev To be emmited when meta-evidence is submitted.
   *  @param _metaEvidenceID Unique identifier of meta-evidence.
   *  @param _evidence A link to the meta-evidence JSON, example: '/ipfs/Qmarwkf7C9RuzDEJNnarT3WZ7kem5bk8DZAzx78acJjMFH/metaevidence.json'
   */
  event MetaEvidence(
    uint256 indexed _metaEvidenceID,
    string _evidence
  );

  /**
   * @dev To be emitted when a dispute is created to link the correct meta-evidence to the disputeID.
   * @param arbitrator_ The arbitrator of the contract.
   * @param disputeID_ ID of the dispute in the Arbitrator contract.
   * @param metaEvidenceID_ Unique identifier of meta-evidence.
   * @param evidenceGroupID_ Unique identifier of the evidence group that is linked to this dispute.
   */
  event Dispute(
    IArbitrator indexed arbitrator_,
    uint256 indexed disputeID_,
    uint256 metaEvidenceID_,
    uint256 evidenceGroupID_
  );

  /**
   * @dev To be raised when evidence is submitted. Should point to the resource (evidences are not to be stored on chain due to gas considerations).
   * @param arbitrator_ The arbitrator of the contract.
   * @param evidenceGroupID_ Unique identifier of the evidence group the evidence belongs to.
   * @param party_ The address of the party submiting the evidence. Note that 0x0 refers to evidence not submitted by any party.
   * @param evidence_ IPFS path to evidence, example: '/ipfs/Qmarwkf7C9RuzDEJNnarT3WZ7kem5bk8DZAzx78acJjMFH/evidence.json'
   */
  event Evidence(
    IArbitrator indexed arbitrator_,
    uint256 indexed evidenceGroupID_,
    address indexed party_,
    string evidence_
  );

  /** @dev To be raised when a ruling is given.
   *  @param _arbitrator The arbitrator giving the ruling.
   *  @param _disputeID ID of the dispute in the Arbitrator contract.
   *  @param _ruling The ruling which was given.
   */
  event Ruling(
    IArbitrator indexed _arbitrator,
    uint256 indexed _disputeID,
    uint256 _ruling
  );

  /** @dev Give a ruling for a dispute. Must be called by the arbitrator.
   *  The purpose of this function is to ensure that the address calling it has the right to rule on the contract.
   *  @param _disputeID ID of the dispute in the Arbitrator contract.
   *  @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
   */
  function rule(uint256 _disputeID, uint256 _ruling) external;
}
