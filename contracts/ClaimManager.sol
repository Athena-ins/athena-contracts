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

  // Maps a policyId to a Kleros disputeId
  mapping(uint256 => uint256) public policyIdToDisputeId;
  // Maps a Kleros disputeId to a claim's data
  mapping(uint256 => Claim) public claims;
  // Lists all the Kleros disputeIds of an account
  mapping(address => uint256[]) public claimsByAccount;

  constructor(address core_, IArbitrator arbitrator_)
    ClaimEvidence(arbitrator_)
  {
    core = payable(core_);
  }

  /// ========================= ///
  /// ========= EVENTS ======== ///
  /// ========================= ///

  event ClaimCreated(
    address claimant_,
    uint256 disputeId_,
    uint256 policyId_,
    uint256 amount_
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
    require(claims[disputeId_].status == Status.Initial, "Status not initial");
    return
      (block.timestamp - claims[disputeId_].createdAt) > delay
        ? 0
        : (claims[disputeId_].createdAt + delay - block.timestamp);
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
    //   claimsInfo[i] = claims[beginDisputeId + i];
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

  function inititateClaim(
    address account_,
    uint256 policyId_,
    uint128 protocolId_,
    uint256 amount_
  ) external payable onlyCore {
    require(policyIdToDisputeId[policyId_] == 0, "CM: claim already ongoing");

    uint256 costOfArbitration = arbitrationCost();
    require(msg.value >= costOfArbitration, "CM: Not enough ETH for claim");

    uint256 disputeId = arbitrator.createDispute{ value: costOfArbitration }(
      2,
      ""
    );

    policyIdToDisputeId[policyId_] = disputeId;

    for (uint256 index = 0; index < claimsByAccount[account_].length; index++) {
      if (claims[claimsByAccount[account_][index]].policyId == policyId_) {
        require(
          block.timestamp >
            claims[claimsByAccount[account_][index]].createdAt + delay,
          "Already claiming"
        );
      }
    }
    //@dev TODO : should lock the capital in protocol pool

    claimsByAccount[account_].push(disputeId);
    claims[disputeId] = Claim({
      from: payable(account_),
      createdAt: block.timestamp,
      disputeId: disputeId,
      arbitrationCost: costOfArbitration,
      policyId: policyId_,
      amount: amount_,
      status: Status.Initial,
      challenger: payable(0x00)
    });

    //
    _emitKlerosDisputeEvents(disputeId, protocolId_);

    emit ClaimCreated(account_, disputeId, policyId_, amount_);
  }

  function challenge(uint256 disputeId_) external payable {
    require(claims[disputeId_].status == Status.Initial, "Dispute ongoing");
    require(
      block.timestamp < claims[disputeId_].createdAt + delay,
      "Challenge delay passed"
    );
    uint256 arbitrationCost_ = arbitrationCost();
    require(msg.value >= arbitrationCost_, "Not enough ETH for challenge");
    claims[disputeId_].status = Status.Disputed;
    claims[disputeId_].challenger = payable(msg.sender);
    emit AthenaDispute(arbitrator, disputeId_, disputeId_, disputeId_);
  }

  /// ================================ ///
  /// ========== RESOLUTION ========== ///
  /// ================================ ///

  // function resolve(uint256 disputeId_) external {
  //   require(claims[disputeId_].status == Status.Initial, "Dispute ongoing");
  //   require(
  //     block.timestamp > claims[disputeId_].createdAt + delay,
  //     "Delay is not over"
  //   );
  //   _resolve(disputeId_, 1);
  // }

  //Thao@WARN: everyone can call this function !!!
  function releaseFunds(uint256 disputeId_) public {
    require(
      claims[disputeId_].status == Status.Initial,
      "Dispute is not in initial state"
    );
    require(
      block.timestamp - claims[disputeId_].createdAt > delay,
      "Delay is not over"
    );
    claims[disputeId_].status = Status.Resolved;
    claims[disputeId_].from.transfer(claims[disputeId_].amount);
    // call Athena core for release funds to claimant
    IAthena(core).resolveClaim(
      claims[disputeId_].policyId,
      claims[disputeId_].amount,
      claims[disputeId_].from
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
    // Claim storage dispute_ = claims[klerosToDisputeId[disputeId_]];
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
