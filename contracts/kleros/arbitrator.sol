// SPDX-License-Identifier: MIT
/**
 *  @authors: [@clesaege]
 *  @reviewers: [@remedcu]
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity 0.8.20;

import "../interfaces/IArbitrable.sol";

/** @title Arbitrator
 *  @author Clément Lesaege - <clement@lesaege.com>
 *  Arbitrator abstract contract.
 *  When developing arbitrator contracts we need to:
 *  -Define the functions for dispute creation (createDispute) and appeal (appeal). Don't forget to store the arbitrated contract and the disputeID (which should be unique, use nbDisputes).
 *  -Define the functions for cost display (arbitrationCost and appealCost).
 *  -Allow giving rulings. For this a function must call arbitrable.rule(disputeID, ruling).
 */
abstract contract Arbitrator {
  enum DisputeStatus {
    Waiting,
    Appealable,
    Solved
  }

  modifier requireArbitrationFee(bytes memory _extraData) {
    require(
      msg.value >= arbitrationCost(_extraData),
      "Not enough ETH to cover arbitration costs."
    );
    _;
  }

  /** @dev To be raised when a dispute is created.
   *  @param _disputeID ID of the dispute.
   *  @param _arbitrable The contract which created the dispute.
   */
  event DisputeCreation(
    uint256 indexed _disputeID,
    IArbitrable indexed _arbitrable
  );

  /** @dev To be raised when a dispute can be appealed.
   *  @param _disputeID ID of the dispute.
   *  @param _arbitrable The contract which created the dispute.
   */
  event AppealPossible(
    uint256 indexed _disputeID,
    IArbitrable indexed _arbitrable
  );

  /** @dev To be raised when the current ruling is appealed.
   *  @param _disputeID ID of the dispute.
   *  @param _arbitrable The contract which created the dispute.
   */
  event AppealDecision(
    uint256 indexed _disputeID,
    IArbitrable indexed _arbitrable
  );

  /** @dev Create a dispute. Must be called by the arbitrable contract.
   *  Must be paid at least arbitrationCost(_extraData).
   *  @param _choices Amount of choices the arbitrator can make in this dispute.
   *  @param _extraData Can be used to give additional info on the dispute to be created.
   *  @return disputeID ID of the dispute created.
   */
  function createDispute(
    uint256 _choices,
    bytes memory _extraData
  ) public payable virtual returns (uint256 disputeID);

  /** @dev Compute the cost of arbitration. It is recommended not to increase it often, as it can be highly time and gas consuming for the arbitrated contracts to cope with fee augmentation.
   *  @param _extraData Can be used to give additional info on the dispute to be created.
   *  @return fee Amount to be paid.
   */
  function arbitrationCost(
    bytes memory _extraData
  ) public view virtual returns (uint256 fee);

  /** @dev Return the status of a dispute.
   *  @param _disputeID ID of the dispute to rule.
   *  @return status The status of the dispute.
   */
  function disputeStatus(
    uint256 _disputeID
  ) public view virtual returns (DisputeStatus status);

  /** @dev Return the current ruling of a dispute. This is useful for parties to know if they should appeal.
   *  @param _disputeID ID of the dispute.
   *  @return ruling The ruling which has been given or the one which will be given if there is no appeal.
   */
  function currentRuling(
    uint256 _disputeID
  ) public view virtual returns (uint256 ruling);
}
