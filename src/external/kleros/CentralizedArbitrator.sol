// SPDX-License-Identifier: MIT
/**
 *  @authors: [@clesaege, @n1c01a5, @epiqueras, @ferittuncer]
 *  @reviewers: [@clesaege*, @unknownunknown1*]
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 *  @tools: [MythX]
 */

pragma solidity 0.8.20;

// Parents
import { Arbitrator } from "./Arbitrator.sol";
// Interfaces
import { IArbitrable } from "../../interface/IArbitrable.sol";

/** @title Centralized Arbitrator
 *  @dev This is a centralized arbitrator deciding alone on the result of disputes. No appeals are possible.
 */
contract CentralizedArbitrator is Arbitrator {
  address public owner = msg.sender;
  uint256 private _arbitrationPrice; // Not public because arbitrationCost already acts as an accessor.

  struct DisputeStruct {
    IArbitrable arbitrated;
    uint256 choices;
    uint256 fee;
    uint256 ruling;
    DisputeStatus status;
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "Can only be called by the owner.");
    _;
  }

  DisputeStruct[] public disputes;

  /** @dev Constructor. Set the initial arbitration price.
   *  @param arbitrationPrice_ Amount to be paid for arbitration.
   */
  constructor(uint256 arbitrationPrice_) {
    _arbitrationPrice = arbitrationPrice_;
  }

  /** @dev Set the arbitration price. Only callable by the owner.
   *  @param arbitrationPrice_ Amount to be paid for arbitration.
   */
  function setArbitrationPrice(
    uint256 arbitrationPrice_
  ) public onlyOwner {
    _arbitrationPrice = arbitrationPrice_;
  }

  /** @dev Cost of arbitration. Accessor to _arbitrationPrice.
   *  @param _extraData Not used by this contract.
   *  @return fee Amount to be paid.
   */
  function arbitrationCost(
    bytes memory _extraData
  ) public view override returns (uint256 fee) {
    return _arbitrationPrice;
  }

  /** @dev Create a dispute. Must be called by the arbitrable contract.
   *  Must be paid at least arbitrationCost().
   *  @param _choices Amount of choices the arbitrator can make in this dispute. When ruling ruling<=choices.
   *  @param _extraData Can be used to give additional info on the dispute to be created.
   *  @return disputeID ID of the dispute created.
   */
  function createDispute(
    uint256 _choices,
    bytes memory _extraData
  )
    public
    payable
    override
    requireArbitrationFee(_extraData)
    returns (uint256 disputeID)
  {
    disputes.push(
      DisputeStruct({
        arbitrated: IArbitrable(msg.sender),
        choices: _choices,
        fee: msg.value,
        ruling: 0,
        status: DisputeStatus.Waiting
      })
    ); // Create the dispute and return its number.
    disputeID = disputes.length - 1;
    emit DisputeCreation(disputeID, IArbitrable(msg.sender));
  }

  /** @dev Give a ruling. UNTRUSTED.
   *  @param _disputeID ID of the dispute to rule.
   *  @param _ruling Ruling given by the arbitrator. Note that 0 means "Not able/wanting to make a decision".
   */
  function _giveRuling(uint256 _disputeID, uint256 _ruling) internal {
    DisputeStruct storage dispute = disputes[_disputeID];
    require(_ruling <= dispute.choices, "Invalid ruling.");
    require(
      dispute.status != DisputeStatus.Solved,
      "The dispute must not be solved already."
    );

    dispute.ruling = _ruling;
    dispute.status = DisputeStatus.Solved;

    payable(msg.sender).transfer(dispute.fee); // Avoid blocking.
    dispute.arbitrated.rule(_disputeID, _ruling);
  }

  /** @dev Give a ruling. UNTRUSTED.
   *  @param _disputeID ID of the dispute to rule.
   *  @param _ruling Ruling given by the arbitrator. Note that 0 means "Not able/wanting to make a decision".
   */
  function giveRuling(
    uint256 _disputeID,
    uint256 _ruling
  ) public onlyOwner {
    return _giveRuling(_disputeID, _ruling);
  }

  /** @dev Return the status of a dispute.
   *  @param _disputeID ID of the dispute to rule.
   *  @return status The status of the dispute.
   */
  function disputeStatus(
    uint256 _disputeID
  ) public view override returns (DisputeStatus status) {
    return disputes[_disputeID].status;
  }

  /** @dev Return the ruling of a dispute.
   *  @param _disputeID ID of the dispute to rule.
   *  @return ruling The ruling which would or has been given.
   */
  function currentRuling(
    uint256 _disputeID
  ) public view override returns (uint256 ruling) {
    return disputes[_disputeID].ruling;
  }
}
