// SPDX-License-Identifier: MIT
/**
 *  @authors: [@clesaege, @n1c01a5, @epiqueras, @ferittuncer]
 *  @reviewers: [@clesaege*, @unknownunknown1*]
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 *  @tools: [MythX]
 */

pragma solidity 0.8.25;

// Interfaces
import { IArbitrable } from "../interfaces/IArbitrable.sol";
import { IArbitrator } from "../interfaces/IArbitrator.sol";

/** @title Mock Arbitrator (aka Centralized Arbitrator)
 *  @dev This is a centralized arbitrator deciding alone on the result of disputes. No appeals are possible.
 */
contract MockArbitrator is IArbitrator {
  address public owner = msg.sender;
  uint256 private _arbitrationPrice; // Not public because arbitrationCost already acts as an accessor.
  uint256 private _appealPrice;
  uint256 public appealPeriodDuration = 3 days;

  struct DisputeStruct {
    IArbitrable arbitrated;
    uint256 choices;
    uint256 fee;
    uint256 ruling;
    DisputeStatus status;
    uint256 rulingTime;
  }

  modifier requireArbitrationFee(bytes calldata _extraData) {
    require(
      msg.value >= arbitrationCost(_extraData),
      "Not enough ETH to cover arbitration costs."
    );
    _;
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "Can only be called by the owner.");
    _;
  }

  DisputeStruct[] public disputes;

  /** @dev Constructor. Set the initial arbitration price.
   *  @param arbitrationPrice_ Amount to be paid for arbitration.
   */
  constructor(uint256 arbitrationPrice_, uint256 appealPrice_) {
    _arbitrationPrice = arbitrationPrice_;
    _appealPrice = appealPrice_;
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
   *  @return fee Amount to be paid.
   */
  function arbitrationCost(
    bytes calldata /* _extraData */
  ) public view override returns (uint256 fee) {
    return _arbitrationPrice;
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
    DisputeStruct storage dispute = disputes[_disputeID];
    if (dispute.status != DisputeStatus.Waiting) return (0, 0);

    return (
      dispute.rulingTime,
      dispute.rulingTime + appealPeriodDuration
    );
  }

  /** @dev Create a dispute. Must be called by the arbitrable contract.
   *  Must be paid at least arbitrationCost().
   *  @param _choices Amount of choices the arbitrator can make in this dispute. When ruling ruling<=choices.
   *  @param _extraData Can be used to give additional info on the dispute to be created.
   *  @return disputeID ID of the dispute created.
   */
  function createDispute(
    uint256 _choices,
    bytes calldata _extraData
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
        status: DisputeStatus.Waiting,
        rulingTime: 0
      })
    ); // Create the dispute and return its number.
    disputeID = disputes.length - 1;
    emit DisputeCreation(disputeID, IArbitrable(msg.sender));
  }

  /** @dev Appeal a ruling. Note that it has to be called before the arbitrator contract calls rule.
   *  @param _disputeID ID of the dispute to be appealed.
   */
  function appeal(
    uint256 _disputeID,
    bytes memory /* _extraData */
  ) external payable {
    disputes[_disputeID] = DisputeStruct({
      arbitrated: IArbitrable(msg.sender),
      choices: disputes[_disputeID].choices,
      fee: msg.value,
      ruling: 0,
      status: DisputeStatus.Waiting,
      rulingTime: 0
    });
  }

  /** @dev Give a ruling. UNTRUSTED.
   *  @param _disputeID ID of the dispute to rule.
   *  @param _ruling Ruling given by the arbitrator. Note that 0 means "Not able/wanting to make a decision".
   */
  function _giveRuling(uint256 _disputeID, uint256 _ruling) internal {
    DisputeStruct storage dispute = disputes[_disputeID];
    require(_ruling <= dispute.choices, "Invalid ruling.");
    require(
      dispute.status != DisputeStatus.Appealable,
      "The dispute must not be solved already."
    );

    dispute.ruling = _ruling;
    dispute.status = DisputeStatus.Appealable;
    dispute.rulingTime = block.timestamp;

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
    if (
      disputes[_disputeID].status == DisputeStatus.Appealable &&
      disputes[_disputeID].rulingTime + appealPeriodDuration <
      block.timestamp
    ) {
      return DisputeStatus.Solved;
    }

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
