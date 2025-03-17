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
  uint256 private _appealPrice;
  uint256 public immutable choices = 2;
  uint256 public appealPeriodDuration = 3 days;

  struct Dispute {
    uint256 fee;
    uint256 ruling;
    DisputeStatus status;
    uint256 rulingTime;
  }

  uint256 public nextDisputeID;
  mapping(uint256 disputeId_ => Dispute) public disputes;

  // ======= CONSTRUCTOR ======= //

  /** @dev Constructor. Set the initial arbitration price.
   *  @param arbitrationPrice_ Amount to be paid for arbitration.
   */
  constructor(
    IClaimManager claimManager_,
    uint256 arbitrationPrice_,
    uint256 appealPrice_
  ) Ownable(msg.sender) {
    claimManager = claimManager_;
    _arbitrationPrice = arbitrationPrice_;
    _appealPrice = appealPrice_;
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
    if (
      disputes[disputeID_].status == DisputeStatus.Appealable &&
      disputes[disputeID_].rulingTime + appealPeriodDuration <
      block.timestamp
    ) {
      return DisputeStatus.Solved;
    }

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

  /** @dev Compute the cost of appeal. It is recommended not to increase it often, as it can be higly time and gas consuming for the arbitrated contracts to cope with fee augmentation.
   *  @return fee Amount to be paid.
   */
  function appealCost(
    uint256 /* _disputeID */,
    bytes memory /* _extraData */
  ) external view returns (uint256 fee) {
    return _appealPrice;
  }

  /** @dev Compute the start and end of the dispute's current or next appeal period, if possible.
   *  @param _disputeID ID of the dispute.
   *  @return start The start of the period.
   *  @return end The end of the period.
   */
  function appealPeriod(
    uint256 _disputeID
  ) external view returns (uint256 start, uint256 end) {
    Dispute storage dispute = disputes[_disputeID];
    if (dispute.status != DisputeStatus.Waiting) return (0, 0);

    return (
      dispute.rulingTime,
      dispute.rulingTime + appealPeriodDuration
    );
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
      status: DisputeStatus.Waiting,
      rulingTime: 0
    });

    emit DisputeCreation(disputeID, IArbitrable(msg.sender));
  }

  /** @dev Appeal a ruling. Note that it has to be called before the arbitrator contract calls rule.
   *  @param _disputeID ID of the dispute to be appealed.
   */
  function appeal(
    uint256 _disputeID,
    bytes memory /* _extraData */
  ) external payable {
    if (msg.sender != address(claimManager))
      revert OnlyClaimManager();
    if (msg.value < _appealPrice)
      revert NotEnoughETHToCoverArbitrationCosts();

    disputes[_disputeID] = Dispute({
      fee: msg.value,
      ruling: 0,
      status: DisputeStatus.Waiting,
      rulingTime: 0
    });
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
    if (dispute.status == DisputeStatus.Appealable)
      revert DisputeAlreadyResolved();

    dispute.ruling = ruling_;
    dispute.status = DisputeStatus.Appealable;
    dispute.rulingTime = block.timestamp;

    payable(msg.sender).transfer(dispute.fee); // Avoid blocking.

    claimManager.rule(disputeID_, ruling_);
  }

  /** @dev Set the arbitration price. Only callable by the owner.
   * @param arbitrationPrice_ Amount to be paid for arbitration.
   * @param appealPrice_ Amount to be paid for appeal.
   * @param appealPeriodDuration_ The time in seconds parties have to appeal.
   */
  function setConfiguration(
    uint256 arbitrationPrice_,
    uint256 appealPrice_,
    uint256 appealPeriodDuration_
  ) public onlyOwner {
    _arbitrationPrice = arbitrationPrice_;
    _appealPrice = appealPrice_;
    appealPeriodDuration = appealPeriodDuration_;
  }
}
