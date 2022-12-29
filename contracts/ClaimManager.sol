// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IArbitrable.sol";
import "./interfaces/IArbitrator.sol";

import "./interfaces/IPolicyManager.sol";
import "./interfaces/IClaimManager.sol";
import "./interfaces/IAthena.sol";

import "./ClaimEvidence.sol";

// @bw add reentrency guard to all fns with ETH manipulation

contract ClaimManager is IClaimManager, ClaimEvidence, IArbitrable {
  IAthena public immutable core;
  IPolicyManager public immutable policyManagerInterface;
  uint256 public challengeDelay = 14 days;
  uint256 public claimIndex = 0;
  uint256 public collateralAmount = 0.1 ether;

  enum ClaimStatus {
    Initiated,
    Disputed,
    AcceptedWithDispute,
    RejectedWithDispute,
    CompensatedAfterAcceptation
  }

  enum RulingOptions {
    RefusedToArbitrate,
    CompensateClaimant,
    RejectClaim
  }
  uint256 public immutable numberOfRulingOptions = 2;

  struct Claim {
    ClaimStatus status;
    uint256 createdAt;
    address from;
    uint256 amount;
    uint256 policyId;
    uint256 protocolId;
    string metaEvidence;
    //
    uint256 disputeId;
    address challenger;
    uint256 arbitrationCost;
  }

  // Maps a claim ID to a claim's data
  mapping(uint256 => Claim) public claims;
  // Maps a policyId to its latest Kleros disputeId
  mapping(uint256 => uint256) public policyIdToLatestClaimId;
  // Maps a Kleros dispute ID to its claim ID
  mapping(uint256 => uint256) public disputeIdToClaimId;

  constructor(
    address core_,
    address policyManager_,
    IArbitrator arbitrator_
  ) ClaimEvidence(arbitrator_) {
    core = IAthena(core_);
    policyManagerInterface = IPolicyManager(policyManager_);
  }

  /// ========================= ///
  /// ========= EVENTS ======== ///
  /// ========================= ///

  // Emitted upon claim creation
  event ClaimCreated(
    address indexed claimant,
    uint256 indexed policyId,
    uint256 indexed protocolId
  );

  // Emit when a claim is challenged into a dispute
  event DisputeCreated(
    address indexed claimant,
    address indexed challenger,
    uint256 policyId,
    uint256 indexed protocolId,
    uint256 disputeId
  );

  // Emit when a dispute is resolved
  event DisputeResolved(
    address indexed claimant,
    address indexed challenger,
    uint256 policyId,
    uint256 indexed protocolId,
    uint256 disputeId,
    uint256 ruling
  );

  event Solved(IArbitrator arbitrator, uint256 disputeId, uint256 policyId);

  /// ============================ ///
  /// ========= MODIFIERS ======== ///
  /// ============================ ///

  modifier onlyCore() {
    require(msg.sender == address(core), "CM: only core");
    _;
  }

  modifier onlyArbitrator() {
    require(msg.sender == address(arbitrator), "CM: only arbitrator");
    _;
  }

  /**
   * @notice
   * Check caller is owner of the policy holder NFT
   * @param policyId_ policy holder NFT ID
   */
  modifier onlyPolicyTokenOwner(uint256 policyId_) {
    address ownerOfToken = policyManagerInterface.ownerOf(policyId_);
    require(msg.sender == ownerOfToken, "A: Caller is not the owner");
    _;
  }

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  /**
   * @notice
   * Returns the claimant of a claim.
   * @param claimId_ The claim ID
   * @return _ the claimant's address
   */
  function claimInitiator(uint256 claimId_) external view returns (address) {
    return claims[claimId_].from;
  }

  /**
   * @notice
   * Returns the challenger of a claim.
   * @param claimId_ The claim ID
   * @return _ the challenger's address
   */
  function claimChallenger(uint256 claimId_) external view returns (address) {
    return claims[claimId_].challenger;
  }

  /**
   * @notice
   * Returns the cost of arbitration for a Kleros dispute.
   * @return _ the arbitration cost
   */
  function arbitrationCost() public view returns (uint256) {
    return arbitrator.arbitrationCost("");
  }

  /**
   * @notice
   * Returns the remaining time to challenge a claim.
   * @param claimId_ The claim ID
   * @return _ the remaining time to challenge
   */
  function remainingTimeToChallenge(uint256 claimId_)
    external
    view
    returns (uint256)
  {
    Claim memory userClaim = claims[claimId_];

    // If the claim is not in the Initiated state it cannot be challenged
    if (userClaim.status != ClaimStatus.Initiated) return 0;
    else if (userClaim.createdAt + challengeDelay < block.timestamp) return 0;
    else return (userClaim.createdAt + challengeDelay) - block.timestamp;
  }

  /**
   * @notice
   * Get all or a range of exiting claims.
   * @dev The range is inclusive of the beginIndex and exclusive of the endIndex.
   * @param beginIndex The index of the first claim to return
   * @param endIndex The index of the claim at which to stop
   * @return claimsInfo All the claims in the specified range
   */
  function linearClaimsView(uint256 beginIndex, uint256 endIndex)
    external
    view
    returns (Claim[] memory claimsInfo)
  {
    require(endIndex < claimIndex, "CM: outside of range");

    for (uint256 i = beginIndex; i < endIndex; i++) {
      Claim memory claim = claims[i];

      uint256 index = claimsInfo.length;
      claimsInfo[index] = claim;
    }
  }

  /**
   * @notice
   * Returns all the claims of a user.
   * @param account_ The user's address
   * @return claimsInfo All the user's claims
   */
  function claimsByAccount(address account_)
    external
    view
    returns (Claim[] memory claimsInfo)
  {
    for (uint256 i = 0; i < claimIndex; i++) {
      Claim memory claim = claims[i];

      if (claim.from == account_) {
        uint256 index = claimsInfo.length;
        claimsInfo[index] = claim;
      }
    }
  }

  /// ============================ ///
  /// ========== HELPER ========== ///
  /// ============================ ///

  /**
   * @notice
   * Sends value to an address.
   * @param to_ The address to send value to
   * @param value_ The amount of ETH to send
   */
  function sendValue(address to_, uint256 value_) private {
    (bool success, ) = to_.call{ value: value_ }("");
    require(success, "CM: transfer failed");
  }

  /// ============================== ///
  /// ========== EVIDENCE ========== ///
  /// ============================== ///

  /**
   * @notice
   * Adds the document associated to the protocol's insurance terms.
   * @param protocolId_ The new protocol ID
   * @param agreementIpfsHash_ The IPFS hash of the meta evidence
   */
  function addAgreementForProtocol(
    uint256 protocolId_,
    string calldata agreementIpfsHash_
  ) external onlyCore {
    // @bw should add a fn to update this file without breaking the pool
    _addAgreementForProtocol(protocolId_, agreementIpfsHash_);
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
    Claim storage userClaim = claims[claimId_];

    address claimant = userClaim.from;
    address challenger = userClaim.challenger;
    require(party_ == claimant || party_ == challenger, "CM: invalid party");

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
   * @param ipfsMetaEvidenceHash_ The IPFS hash of the meta evidence file
   */
  function inititateClaim(
    address account_,
    uint256 policyId_,
    uint128 protocolId_,
    uint256 amount_,
    string calldata ipfsMetaEvidenceHash_
  ) external payable onlyCore {
    // Check that the user has deposited the capital necessary for arbitration and collateral
    uint256 costOfArbitration = arbitrationCost();
    require(
      costOfArbitration + collateralAmount <= msg.value,
      "CM: Not enough ETH for claim"
    );

    // Check if there already an ongoing claim related to this policy
    uint256 latestClaimIdOfPolicy = policyIdToLatestClaimId[policyId_];
    if (latestClaimIdOfPolicy != 0) {
      // Only allow for a new claim if the previous was rejected after a dispute
      Claim storage userClaim = claims[latestClaimIdOfPolicy];
      require(
        userClaim.status == ClaimStatus.RejectedWithDispute,
        "CM: previous claim still ongoing"
      );
    }

    // Save latest claim ID of policy and update claim index
    uint256 claimId = claimIndex;
    policyIdToLatestClaimId[policyId_] = claimId;
    claimIndex++;

    // Save claim data
    claims[claimId] = Claim({
      status: ClaimStatus.Initiated,
      from: account_,
      challenger: address(0),
      createdAt: block.timestamp,
      arbitrationCost: costOfArbitration,
      disputeId: 0,
      policyId: policyId_,
      protocolId: protocolId_,
      amount: amount_,
      metaEvidence: ipfsMetaEvidenceHash_
    });

    // Emit Athena claim creation event
    emit ClaimCreated(account_, policyId_, protocolId_);
  }

  /**
   * @notice
   * Allows a policy holder to execute the claim if it has remained unchallenged.
   * @param account_ The account that is claiming
   * @param claimId_ The claim ID
   */
  function withdrawCompensationWithoutDispute(
    address account_,
    uint256 claimId_
  ) external onlyCore {
    Claim storage userClaim = claims[claimId_];
    address claimant = userClaim.from;

    // Check the caller is the claim initiator
    require(claimant == account_, "CM: caller is not the claimant");

    // Check the claim is in the appropriate status
    require(
      userClaim.status == ClaimStatus.Initiated,
      "CM: wrong claim status"
    );

    // Check the claim has passed the disputable delay
    require(
      userClaim.createdAt + challengeDelay < block.timestamp,
      "CM: delay not elapsed"
    );

    // Update claim status
    userClaim.status = ClaimStatus.CompensatedAfterAcceptation;

    // Send back the collateral and arbitration cost to the claimant
    sendValue(claimant, userClaim.arbitrationCost + collateralAmount);

    // Call Athena core to pay the compensation
    core.compensateClaimant(
      userClaim.policyId,
      userClaim.amount,
      userClaim.from
    );
  }

  /// ============================= ///
  /// ========== DISPUTE ========== ///
  /// ============================= ///

  /**
   * @notice
   * Allows a user to challenge a pending claim by creating a dispute in Kleros.
   * @param claimId_ The claim ID
   * @param challengerAddress_ The address of the challenger
   */
  function disputeClaim(uint256 claimId_, address challengerAddress_)
    external
    payable
    onlyCore
  {
    Claim storage userClaim = claims[claimId_];

    // Check the claim is in the appropriate status and challenge is within delay
    require(
      userClaim.status == ClaimStatus.Initiated &&
        block.timestamp < userClaim.createdAt + challengeDelay,
      "CM: claim not challengeable"
    );

    // Check the claim is not already disputed
    require(userClaim.challenger == address(0), "CM: claim already challenged");

    // Check that the challenger has deposited enough capital for dispute creation
    uint256 costOfArbitration = userClaim.arbitrationCost;
    require(costOfArbitration <= msg.value, "CM: must match claimant deposit");

    // Create the claim and obtain the Kleros dispute ID
    uint256 disputeId = arbitrator.createDispute{ value: costOfArbitration }(
      2,
      ""
    );

    // Update the claim with challenged status and challenger address
    userClaim.status = ClaimStatus.Disputed;
    userClaim.challenger = challengerAddress_;
    userClaim.disputeId = disputeId;

    // Map the new dispute ID to be able to search it after ruling
    disputeIdToClaimId[disputeId] = claimId_;

    // Emit Kleros events for dispute creation and meta-evidence association
    _emitKlerosDisputeEvents(
      challengerAddress_,
      disputeId,
      userClaim.protocolId,
      userClaim.metaEvidence
    );
  }

  /**
   * @notice
   * Give a ruling for a dispute. Must be called by the arbitrator.
   * @param disputeId_ ID of the dispute in the Arbitrator contract.
   * @param ruling_ Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
   */
  function rule(uint256 disputeId_, uint256 ruling_) external onlyArbitrator {
    uint256 claimId = disputeIdToClaimId[disputeId_];
    Claim storage userClaim = claims[claimId];

    address challenger = userClaim.challenger;

    // Check the status of the claim
    require(
      userClaim.status == ClaimStatus.Disputed,
      "CM: claim not in dispute"
    );

    require(ruling_ <= numberOfRulingOptions, "CM: invalid ruling");

    // Manage ETH for claim creation, claim collateral and dispute creation
    if (ruling_ == uint256(RulingOptions.CompensateClaimant)) {
      userClaim.status = ClaimStatus.AcceptedWithDispute;

      // Send back the collateral and arbitration cost to the claimant
      address claimant = userClaim.challenger;
      sendValue(claimant, userClaim.arbitrationCost + collateralAmount);
    } else if (ruling_ == uint256(RulingOptions.RejectClaim)) {
      userClaim.status = ClaimStatus.RejectedWithDispute;

      // Refund arbitration cost to the challenger and pay them with collateral
      sendValue(challenger, userClaim.arbitrationCost + collateralAmount);
    } else {
      // This is the case where the arbitrator refuses to rule
      userClaim.status = ClaimStatus.RejectedWithDispute;

      uint256 halfArbitrationCost = userClaim.arbitrationCost / 2;

      // Send back the collateral and half the arbitration cost to the claimant
      address claimant = userClaim.challenger;
      sendValue(claimant, halfArbitrationCost + collateralAmount);

      // Send back half the arbitration cost to the challenger
      sendValue(challenger, halfArbitrationCost);
    }

    emit DisputeResolved({
      claimant: userClaim.from,
      challenger: challenger,
      policyId: userClaim.policyId,
      protocolId: userClaim.protocolId,
      disputeId: disputeId_,
      ruling: ruling_
    });
  }

  /**
   * @notice
   * Allows the claimant to withdraw the compensation after a dispute has been resolved in their favor.
   * @param claimId_ The claim ID
   */
  function withdrawCompensationAfterDispute(uint256 claimId_)
    external
    onlyCore
  {
    Claim storage userClaim = claims[claimId_];

    // Check the status of the claim
    require(
      userClaim.status == ClaimStatus.AcceptedWithDispute,
      "CM: wrong claim status"
    );

    // Update claim status
    userClaim.status = ClaimStatus.CompensatedAfterAcceptation;

    // Call Athena core to pay the compensation
    core.compensateClaimant(
      userClaim.policyId,
      userClaim.amount,
      userClaim.from
    );
  }

  /// =========================== ///
  /// ========== ADMIN ========== ///
  /// =========================== ///

  /**
   * @notice
   * Changes the amount of collateral required when opening a claim.
   * @dev The collateral is paid to the challenger if the claim is disputed and rejected.
   * @param amount_ The new amount of collateral.
   */
  function changeRequiredCollateral(uint256 amount_) external onlyCore {
    collateralAmount = amount_;
  }
}
