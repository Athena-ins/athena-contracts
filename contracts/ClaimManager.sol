// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IArbitrator.sol";
import "./interfaces/IClaimManager.sol";
import "./interfaces/IAthena.sol";

import "./ClaimEvidence.sol";

contract ClaimManager is IClaimManager, ClaimEvidence, IArbitrable {
  address payable private immutable core;
  uint256 public delay = 14 days;

  enum RulingOptions {
    RefusedToArbitrate,
    PayerWins,
    PayeeWins
  }

  // Lists all the Kleros disputeIds
  uint256[] public disputeIds;
  // Maps a policyId to its latest Kleros disputeId
  mapping(uint256 => uint256) public policyIdToLatestDisputeId;
  // Maps a Kleros disputeId to a claim's data
  mapping(uint256 => Claim) public disputeIdToClaim;

  // @bw can probably be avoided since only required for view fn
  // // Lists all the Kleros disputeIds of an account
  // mapping(address => uint256[]) public claimsByAccount;

  constructor(address core_, IArbitrator arbitrator_)
    ClaimEvidence(arbitrator_)
  {
    core = payable(core_);
  }

  /// ========================= ///
  /// ========= EVENTS ======== ///
  /// ========================= ///

  // Emitted upon claim creation
  event AthenaClaimCreated(
    address indexed claimant,
    uint256 indexed policyId,
    uint256 indexed protocolId,
    uint256 disputeId
  );

  event AthenaDispute(
    IArbitrator arbitrator_,
    uint256 disputeId_,
    uint256 policyId_,
    uint256 amount_
  );

  event Solved(IArbitrator arbitrator_, uint256 disputeId_, uint256 policyId_);

  /// ============================ ///
  /// ========= MODIFIERS ======== ///
  /// ============================ ///

  modifier onlyCore() {
    require(msg.sender == core, "CM: only core");
    _;
  }

  modifier onlyArbitrator() {
    require(msg.sender == address(arbitrator), "CM: only arbitrator");
    _;
  }

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function arbitrationCost() public view returns (uint256) {
    return arbitrator.arbitrationCost("");
  }

  function remainingTimeToReclaim(uint256 disputeId_)
    public
    view
    returns (uint256)
  {
    require(
      disputeIdToClaim[disputeId_].status == Status.Initial,
      "Status not initial"
    );
    return
      (block.timestamp - disputeIdToClaim[disputeId_].createdAt) > delay
        ? 0
        : (disputeIdToClaim[disputeId_].createdAt + delay - block.timestamp);
  }

  function linearClaimsView(uint256 beginDisputeId, uint256 numberOfClaims)
    external
    view
    returns (Claim[] memory claimsInfo)
  {
    // require(beginDisputeId < nextDisputeId, "begin dispute Id is not exist");
    // uint256 numberOfClaims_ = nextDisputeId > beginDisputeId + numberOfClaims
    //   ? numberOfClaims
    //   : nextDisputeId - beginDisputeId;
    // claimsInfo = new Claim[](numberOfClaims_);
    // for (uint256 i = 0; i < numberOfClaims_; i++)
    //   claimsInfo[i] = disputeIdToClaim[beginDisputeId + i];
  }

  /// ============================== ///
  /// ========== EVIDENCE ========== ///
  /// ============================== ///

  /**
   * @notice
   * Adds the document associated to the protocol's insurance terms.
   * @param protocolId_ The new protocol ID
   * @param metaEvidenceIpfsHash_ The IPFS hash of the meta evidence
   */
  function addMetaEvidenceForProtocol(
    uint256 protocolId_,
    string calldata metaEvidenceIpfsHash_
  ) external onlyCore {
    // @bw should add a fn to update this file without breaking the pool
    _addMetaEvidenceForProtocol(protocolId_, metaEvidenceIpfsHash_);
  }

  /**
   * @notice
   * Adds evidence IPFS hashes for a claim.
   * @param claimId_ The claim ID
   * @param party_ The party that submits the evidence
   * @param ipfsEvidenceHashes_ The IPFS hashes of the evidence
   */
  function submitEvidenceForClaim(
    uint256 claimId_,
    address party_,
    string[] calldata ipfsEvidenceHashes_
  ) external onlyCore {
    _submitKlerosEvidence(claimId_, party_, ipfsEvidenceHashes_);
  }

  /// ============================ ///
  /// ========== CLAIMS ========== ///
  /// ============================ ///

  /**
   * @notice
   * Initiates a payment claim to Kleros by a policy holder.
   * @param account_ The account that is claiming
   * @param policyId_ The policy ID
   * @param protocolId_ The protocol ID of the policy
   * @param amount_ The amount claimed by the policy holder
   */
  function inititateClaim(
    address account_,
    uint256 policyId_,
    uint128 protocolId_,
    uint256 amount_
  ) external payable onlyCore {
    // Check that the user has deposited the capital necessary for arbitration
    uint256 costOfArbitration = arbitrationCost();
    require(msg.value >= costOfArbitration, "CM: Not enough ETH for claim");

    // Check if there already an ongoing claim related to this policy
    uint256 latestDisputeIdOfPolicy = policyIdToLatestDisputeId[policyId_];
    if (latestDisputeIdOfPolicy != 0) {
      // If there is a claim associated to the policy then check it is resolved
      IArbitrator.DisputeStatus previousClaimStatus = arbitrator.disputeStatus(
        latestDisputeIdOfPolicy
      );
    require(
        previousClaimStatus == IArbitrator.DisputeStatus.Solved,
        "CM: previous claim still ongoing"
    );
    }

    // Create the claim and obtain the Kleros dispute ID
    uint256 disputeId = arbitrator.createDispute{ value: costOfArbitration }(
      2,
      ""
    );

    // Save the new dispute ID
    disputeIds.push(disputeId);
    policyIdToLatestDisputeId[policyId_] = disputeId;

    // @bw @dev TODO : should lock the capital in protocol pool

    disputeIdToClaim[disputeId] = Claim({
      status: Status.Initial,
      from: account_,
      challenger: address(this), // @bw should decide what to do with funds sent here
      createdAt: block.timestamp,
      arbitrationCost: costOfArbitration,
      disputeId: disputeId,
      policyId: policyId_,
      amount: amount_
    });

    // Emit all Kleros related events for creation and meta-evidence association
    _emitKlerosDisputeEvents(disputeId, protocolId_);

    // Emit Athena claim creation event
    emit AthenaClaimCreated(account_, policyId_, protocolId_, disputeId);
  }

  /**
   * @notice
   * Used by a user who wishes to challenge an initiated claim.
   * @param disputeId_ The dispute ID
   */
  function challengeClaim(uint256 disputeId_) external payable {
    require(
      disputeIdToClaim[disputeId_].status == Status.Initial,
      "Dispute ongoing"
    );
    require(
      block.timestamp < disputeIdToClaim[disputeId_].createdAt + delay,
      "Challenge delay passed"
    );
    uint256 arbitrationCost_ = arbitrationCost();
    require(msg.value >= arbitrationCost_, "Not enough ETH for challenge");
    disputeIdToClaim[disputeId_].status = Status.Disputed;
    disputeIdToClaim[disputeId_].challenger = payable(msg.sender);
    emit AthenaDispute(arbitrator, disputeId_, disputeId_, disputeId_);
  }

  /// ================================ ///
  /// ========== RESOLUTION ========== ///
  /// ================================ ///

  // function resolve(uint256 disputeId_) external {
  //   require(disputeIdToClaim[disputeId_].status == Status.Initial, "Dispute ongoing");
  //   require(
  //     block.timestamp > disputeIdToClaim[disputeId_].createdAt + delay,
  //     "Delay is not over"
  //   );
  //   _resolve(disputeId_, 1);
  // }

  //Thao@WARN: everyone can call this function !!!
  function releaseFunds(uint256 disputeId_) public {
    require(
      disputeIdToClaim[disputeId_].status == Status.Initial,
      "Dispute is not in initial state"
    );
    require(
      block.timestamp - disputeIdToClaim[disputeId_].createdAt > delay,
      "Delay is not over"
    );
    disputeIdToClaim[disputeId_].status = Status.Resolved;
    disputeIdToClaim[disputeId_].from.transfer(
      disputeIdToClaim[disputeId_].amount
    );
    // call Athena core for release funds to claimant
    IAthena(core).resolveClaim(
      disputeIdToClaim[disputeId_].policyId,
      disputeIdToClaim[disputeId_].amount,
      disputeIdToClaim[disputeId_].from
    );
  }

  /**
   * @dev Give a ruling for a dispute. Must be called by the arbitrator.
   * The purpose of this function is to ensure that the address calling it has the right to rule on the contract.
   * @param disputeId_ ID of the dispute in the Arbitrator contract.
   * @param ruling_ Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
   */
  function rule(uint256 disputeId_, uint256 ruling_) external {
    // // Make action based on ruling
    // Claim storage dispute_ = disputeIdToClaim[klerosToDisputeId[disputeId_]];
    // dispute_.status = Status.Resolved;
    // // if accepted, send funds from Protocol to claimant
    // uint256 amount_ = 0;
    // if (ruling_ == 1) {
    //   dispute_.from.transfer(dispute_.amount);
    //   amount_ = dispute_.amount;
    // } else {
    //   dispute_.challenger.transfer(dispute_.amount);
    // }
    // // call Athena core for unlocking the funds
    // IAthena(core).resolveClaim(dispute_.policyId, amount_, dispute_.from);
    // emit Solved(arbitrator, dispute_.disputeId, ruling_);
    // emit Ruling(arbitrator, dispute_.disputeId, ruling_);
  }
}
