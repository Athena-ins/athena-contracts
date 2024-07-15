// SPDX-License-Identifier: MIT

pragma solidity 0.8.25;

// Contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Interfaces
import { IArbitrable } from "../interfaces/IArbitrable.sol";
import { IArbitrator } from "../interfaces/IArbitrator.sol";
import { IClaimManager } from "../interfaces/IClaimManager.sol";

error NotOwner();
error NotEnoughETHToCoverArbitrationCosts();
error InvalidRuling();
error DisputeAlreadyResolved();
error InvalidNumberOfChoices();
error OnlyClaimManager();

/** @title Athena Implementation of Kleros Centralized Arbitrator
 * Used as a temporary arbitrator until the Kleros Arbitrum Arbitrator is live.
 * This arbitrator decides alone on the result of disputes. No appeals are possible.
 *
 * Originial Kleros contract:
 * https://github.com/kleros/kleros-interaction/blob/master/contracts/standard/arbitration/CentralizedArbitrator.sol
 */
contract AthenaArbitrator is IArbitrator, Ownable {
  // ======= STORAGE ======= //

  IClaimManager public claimManager;

  uint256 private _arbitrationPrice;
  uint256 public immutable choices = 2;

  struct Dispute {
    uint256 fee;
    uint256 ruling;
    DisputeStatus status;
  }

  uint256 public nextDisputeID;
  mapping(uint256 disputeId_ => Dispute) public disputes;

  // ======= CONSTRUCTOR ======= //

  /** @dev Constructor. Set the initial arbitration price.
   *  @param arbitrationPrice_ Amount to be paid for arbitration.
   */
  constructor(
    IClaimManager claimManager_,
    uint256 arbitrationPrice_
  ) Ownable(msg.sender) {
    claimManager = claimManager_;
    _arbitrationPrice = arbitrationPrice_;
  }

  // ======= VIEW ======= //

  /** @dev Cost of arbitration. Accessor to arbitrationPrice_.
   *  @return fee Amount to be paid.
   */
  function arbitrationCost(
    bytes calldata /* extraData_ */
  ) public view override returns (uint256 fee) {
    return _arbitrationPrice;
  }

  /** @dev Return the status of a dispute.
   *  @param disputeID_ ID of the dispute to rule.
   *  @return status The status of the dispute.
   */
  function disputeStatus(
    uint256 disputeID_
  ) public view override returns (DisputeStatus status) {
    return disputes[disputeID_].status;
  }

  /** @dev Return the ruling of a dispute.
   *  @param disputeID_ ID of the dispute to rule.
   *  @return ruling The ruling which would or has been given.
   */
  function currentRuling(
    uint256 disputeID_
  ) public view override returns (uint256 ruling) {
    return disputes[disputeID_].ruling;
  }

  // ======= WRITE ======= //

  /** @dev Create a dispute. Must be called by the arbitrable contract.
   *  Must be paid at least arbitrationCost().
   *  @param choices_ Amount of choices the arbitrator can make in this dispute. When ruling ruling<=choices.
   *
   *  @return disputeID ID of the dispute created.
   */
  function createDispute(
    uint256 choices_,
    bytes calldata /*_extraData*/
  ) public payable returns (uint256 disputeID) {
    if (choices_ != choices) revert InvalidNumberOfChoices();
    if (msg.sender != address(claimManager))
      revert OnlyClaimManager();
    if (msg.value < _arbitrationPrice)
      revert NotEnoughETHToCoverArbitrationCosts();

    disputeID = nextDisputeID;
    nextDisputeID++;

    disputes[disputeID] = Dispute({
      fee: msg.value,
      ruling: 0,
      status: DisputeStatus.Waiting
    });

    emit DisputeCreation(disputeID, IArbitrable(msg.sender));
  }

  // ======= ADMIN ======= //

  /** @dev Give a ruling. UNTRUSTED.
   *  @param disputeID_ ID of the dispute to rule.
   *  @param ruling_ Ruling given by the arbitrator. Note that 0 means "Not able/wanting to make a decision".
   */
  function giveRuling(
    uint256 disputeID_,
    uint256 ruling_
  ) public onlyOwner {
    Dispute storage dispute = disputes[disputeID_];

    if (choices < ruling_) revert InvalidRuling();
    if (dispute.status == DisputeStatus.Solved)
      revert DisputeAlreadyResolved();

    dispute.ruling = ruling_;
    dispute.status = DisputeStatus.Solved;

    payable(msg.sender).transfer(dispute.fee); // Avoid blocking.

    claimManager.rule(disputeID_, ruling_);
  }

  /** @dev Set the arbitration price. Only callable by the owner.
   *  @param arbitrationPrice_ Amount to be paid for arbitration.
   */
  function setArbitrationPrice(
    uint256 arbitrationPrice_
  ) public onlyOwner {
    _arbitrationPrice = arbitrationPrice_;
  }
}
