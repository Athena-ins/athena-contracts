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

  uint256 public nextDisputeId;
  mapping(uint256 => uint256) private _klerosToDisputeId;

  constructor(address _core, IArbitrator _arbitrator)
    ClaimEvidence(_arbitrator)
  {
    core = payable(_core);
  }

  /// ========================= ///
  /// ========= EVENTS ======== ///
  /// ========================= ///

  event ClaimCreated(
    address _claimant,
    uint256 _disputeId,
    uint256 _policyId,
    uint256 _amount
  );

  event AthenaDispute(
    IArbitrator _arbitrator,
    uint256 _disputeId,
    uint256 _policyId,
    uint256 _amount
  );

  event Solved(IArbitrator _arbitrator, uint256 _disputeId, uint256 _policyId);

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

  function remainingTimeToReclaim(uint256 _disputeId)
    public
    view
    returns (uint256)
  {
    require(claims[_disputeId].status == Status.Initial, "Status not initial");
    return
      (block.timestamp - claims[_disputeId].createdAt) > delay
        ? 0
        : (claims[_disputeId].createdAt + delay - block.timestamp);
  }

  function linearClaimsView(uint256 beginDisputeId, uint256 numberOfClaims)
    external
    view
    returns (Claim[] memory claimsInfo)
  {
    require(beginDisputeId < nextDisputeId, "begin dispute Id is not exist");

    uint256 __numberOfClaims = nextDisputeId > beginDisputeId + numberOfClaims
      ? numberOfClaims
      : nextDisputeId - beginDisputeId;

    claimsInfo = new Claim[](__numberOfClaims);

    for (uint256 i = 0; i < __numberOfClaims; i++)
      claimsInfo[i] = claims[beginDisputeId + i];
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

  function claim(
    address _account,
    uint256 _policyId,
    uint128 protocolId_,
    uint256 _amount
  ) external payable onlyCore {
    for (uint256 index = 0; index < ownerClaims[_account].length; index++) {
      if (claims[ownerClaims[_account][index]].policyId == _policyId) {
        require(
          block.timestamp >
            claims[ownerClaims[_account][index]].createdAt + delay,
          "Already claiming"
        );
      }
    }

    uint256 __arbitrationCost = arbitrationCost();
    require(msg.value >= __arbitrationCost, "Not enough ETH for claim");
    //@dev TODO : should lock the capital in protocol pool

    // Update dispute ID before any usage
    uint256 disputeId_ = nextDisputeId;
    nextDisputeId++;

    ownerClaims[_account].push(disputeId_);
    claims[disputeId_] = Claim({
      from: payable(_account),
      createdAt: block.timestamp,
      disputeId: disputeId_,
      klerosId: 0,
      arbitrationCost: __arbitrationCost,
      policyId: _policyId,
      amount: _amount,
      status: Status.Initial,
      challenger: payable(0x00)
    });

    //
    _emitKlerosDisputeEvents(disputeId_, protocolId_);

    emit ClaimCreated(_account, disputeId_, _policyId, _amount);
  }

  function challenge(uint256 _disputeId) external payable {
    require(claims[_disputeId].status == Status.Initial, "Dispute ongoing");
    require(
      block.timestamp < claims[_disputeId].createdAt + delay,
      "Challenge delay passed"
    );
    uint256 __arbitrationCost = arbitrationCost();
    require(msg.value >= __arbitrationCost, "Not enough ETH for challenge");
    uint256 __klerosId = arbitrator.createDispute{ value: msg.value }(2, "");
    claims[_disputeId].status = Status.Disputed;
    claims[_disputeId].klerosId = __klerosId;
    _klerosToDisputeId[__klerosId] = _disputeId;
    claims[_disputeId].challenger = payable(msg.sender);
    emit AthenaDispute(arbitrator, __klerosId, _disputeId, _disputeId);
  }

  /// ================================ ///
  /// ========== RESOLUTION ========== ///
  /// ================================ ///

  // function resolve(uint256 _disputeId) external {
  //   require(claims[_disputeId].status == Status.Initial, "Dispute ongoing");
  //   require(
  //     block.timestamp > claims[_disputeId].createdAt + delay,
  //     "Delay is not over"
  //   );
  //   _resolve(_disputeId, 1);
  // }

  //Thao@WARN: everyone can call this function !!!
  function releaseFunds(uint256 _disputeId) public {
    require(
      claims[_disputeId].status == Status.Initial,
      "Dispute is not in initial state"
    );
    require(
      block.timestamp - claims[_disputeId].createdAt > delay,
      "Delay is not over"
    );
    claims[_disputeId].status = Status.Resolved;
    claims[_disputeId].from.transfer(claims[_disputeId].amount);
    // call Athena core for release funds to claimant
    IAthena(core).resolveClaim(
      claims[_disputeId].policyId,
      claims[_disputeId].amount,
      claims[_disputeId].from
    );
  }

  /**
   * @dev Give a ruling for a dispute. Must be called by the arbitrator.
   * The purpose of this function is to ensure that the address calling it has the right to rule on the contract.
   * @param _disputeId ID of the dispute in the Arbitrator contract.
   * @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
   */
  function rule(uint256 _disputeId, uint256 _ruling) external {
    // Make action based on ruling
    Claim storage __dispute = claims[_klerosToDisputeId[_disputeId]];
    __dispute.status = Status.Resolved;
    // if accepted, send funds from Protocol to claimant
    uint256 __amount = 0;
    if (_ruling == 1) {
      __dispute.from.transfer(__dispute.amount);
      __amount = __dispute.amount;
    } else {
      __dispute.challenger.transfer(__dispute.amount);
    }
    // call Athena core for unlocking the funds
    IAthena(core).resolveClaim(__dispute.policyId, __amount, __dispute.from);
    emit Solved(arbitrator, __dispute.disputeId, _ruling);
    emit Ruling(arbitrator, __dispute.disputeId, _ruling);
  }
}
