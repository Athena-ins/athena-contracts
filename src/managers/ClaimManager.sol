// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// Contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Libraries
import { ReentrancyGuard } from "../libs/ReentrancyGuard.sol";

// Interfaces
import { IArbitrator } from "../interfaces/IArbitrator.sol";
import { IClaimManager } from "../interfaces/IClaimManager.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";

// ======= ERRORS ======= //

error OnlyArbitrator();
error OnlyCoverOwner();
error WrongClaimStatus();
error InvalidParty();
error CannotClaimZero();
error InsufficientDeposit();
error PreviousClaimStillOngoing();
error ClaimNotChallengeable();
error ClaimAlreadyChallenged();
error MustDepositArbitrationCost();
error ClaimNotInDispute();
error InvalidRuling();
error PeriodNotElapsed();
error GuardianSetToAddressZero();
error OverrulePeriodEnded();
error ClaimDoesNotExist();
error CourtClosed();

contract ClaimManager is IClaimManager, Ownable, ReentrancyGuard {
  // ======= MODELS ======= //

  // @dev the 'Accepted' status is virtual as it is never written to the blockchain
  // It enables view functions to display the adequate state of the claim
  enum ClaimStatus {
    Initiated,
    Accepted, // Virtual status
    Compensated,
    // Statuses below are only used when a claim is disputed
    Disputed,
    RejectedByOverrule,
    RejectedByRefusalToArbitrate,
    RejectedByCourtDecision,
    AcceptedByCourtDecision,
    CompensatedAfterDispute
  }

  enum RulingOptions {
    RefusedToArbitrate,
    PayClaimant,
    RejectClaim
  }

  struct ClaimRead {
    uint256 claimId;
    address claimant;
    string[] evidence;
    string[] counterEvidence;
    uint256[] relatedClaimIds;
    uint64 poolId;
    uint256 coverAmount;
    bool isCoverActive;
    //
    uint64 createdAt;
    uint64 rulingTimestamp;
    ClaimStatus status;
    uint256 coverId;
    uint256 disputeId;
    string metaEvidence;
    uint256 amount;
    address challenger;
    uint256 deposit;
  }

  struct Claim {
    uint64 createdAt;
    uint64 rulingTimestamp;
    ClaimStatus status;
    uint256 coverId;
    uint256 disputeId;
    string metaEvidence;
    uint256 amount;
    address challenger;
    uint256 deposit;
  }

  // ======= STORAGE ======= //

  IAthenaCoverToken public coverToken;
  ILiquidityManager public liquidityManager;
  IArbitrator public arbitrator;

  address public evidenceGuardian;
  address public overruleGuardian;

  uint256 public nextClaimId;
  // Maps a claim ID to a claim's data
  mapping(uint256 _claimId => Claim) public claims;
  // Maps a coverId to its claim IDs
  mapping(uint256 _coverId => uint256[] _claimIds)
    public _coverIdToClaimIds;
  // Maps a Kleros dispute ID to its claim ID
  mapping(uint256 _disputeId => uint256 _claimId)
    public disputeIdToClaimId;

  // Maps a claim ID to its submited evidence
  mapping(uint256 _claimId => string[] _cids)
    public claimIdToEvidence;
  mapping(uint256 _claimId => string[] _cids)
    public claimIdToCounterEvidence;

  uint256 public claimCollateral;
  // The params for Kleros specifying the subcourt ID and the number of jurors
  bytes public klerosExtraData;
  uint64 public challengePeriod;
  uint64 public overrulePeriod;

  uint64 public immutable numberOfRulingOptions = 2;

  bool public courtClosed;

  // ======= CONSTRUCTOR ======= //

  constructor(
    IAthenaCoverToken coverToken_,
    ILiquidityManager liquidityManager_,
    IArbitrator arbitrator_,
    address evidenceGuardian_,
    uint256 subcourtId_,
    uint256 nbOfJurors_,
    uint64 challengePeriod_,
    uint64 overrulePeriod_,
    uint256 claimCollateral_
  ) Ownable(msg.sender) {
    coverToken = coverToken_;
    liquidityManager = liquidityManager_;
    evidenceGuardian = evidenceGuardian_;

    setRequiredCollateral(claimCollateral_);
    setPeriods(challengePeriod_, overrulePeriod_);
    setKlerosConfiguration(arbitrator_, subcourtId_, nbOfJurors_);
  }

  // ======= EVENTS ======= //

  // Emitted upon claim creation
  event ClaimCreated(
    address indexed claimant,
    uint256 indexed coverId,
    uint256 claimId
  );

  // Emit when a dispute is resolved
  event DisputeResolved(
    uint256 claimId,
    uint256 disputeId,
    uint256 ruling
  );

  /**
   * @dev To be emitted when meta-evidence is submitted.
   * @param _metaEvidenceID Unique identifier of meta-evidence.
   * @param _evidence IPFS path to metaevidence, example: '/ipfs/Qmarwkf7C9RuzDEJNnarT3WZ7kem5bk8DZAzx78acJjMFH/metaevidence.json'
   */
  event MetaEvidence(
    uint256 indexed _metaEvidenceID,
    string _evidence
  );

  /**
   * @dev To be raised when evidence is submitted. Should point to the resource (evidences are not to be stored on chain due to gas considerations).
   * @param _arbitrator The arbitrator of the contract.
   * @param _evidenceGroupID Unique identifier of the evidence group the evidence belongs to.
   * @param _party The address of the party submiting the evidence. Note that 0x0 refers to evidence not submitted by any party.
   * @param _evidence IPFS path to evidence, example: '/ipfs/Qmarwkf7C9RuzDEJNnarT3WZ7kem5bk8DZAzx78acJjMFH/evidence.json'
   */
  event Evidence(
    IArbitrator indexed _arbitrator,
    uint256 indexed _evidenceGroupID,
    address indexed _party,
    string _evidence
  );

  /**
   * @dev To be emitted when a dispute is created to link the correct meta-evidence to the disputeID.
   * @param _arbitrator The arbitrator of the contract.
   * @param _disputeID ID of the dispute in the Arbitrator contract.
   * @param _metaEvidenceID Unique identifier of meta-evidence.
   * @param _evidenceGroupID Unique identifier of the evidence group that is linked to this dispute.
   */
  event Dispute(
    IArbitrator indexed _arbitrator,
    uint256 indexed _disputeID,
    uint256 _metaEvidenceID,
    uint256 _evidenceGroupID
  );

  // ======= MODIFIERS ======= //

  /**
   * @notice Check that the caller is the arbitrator contract
   */
  modifier onlyArbitrator() {
    if (msg.sender != address(arbitrator)) revert OnlyArbitrator();
    _;
  }

  /**
   * @notice Check that the cover exists
   * @param coverId_ The cover ID
   */
  modifier coverExists(uint256 coverId_) {
    // This will revert the cover does not exist
    coverToken.ownerOf(coverId_);
    _;
  }

  /**
   * @notice Check that the claim exists
   * @param claimId_ The claim ID
   */
  modifier claimsExists(uint256 claimId_) {
    if (claims[claimId_].createdAt == 0) revert ClaimDoesNotExist();
    _;
  }

  // ======= VIEWS ======= //

  /**
   * @notice
   * Returns the cost of arbitration for a Kleros dispute.
   * @return _ the arbitration cost
   */
  function arbitrationCost() public view returns (uint256) {
    return arbitrator.arbitrationCost(klerosExtraData);
  }

  /**
   * @notice Returns all claim IDs associated with a cover.
   * @param coverId_ The cover ID
   * @return claimIds All the claim IDs associated with the cover
   */
  function coverIdToClaimIds(
    uint256 coverId_
  )
    external
    view
    coverExists(coverId_)
    returns (uint256[] memory /*claimIds*/)
  {
    return _coverIdToClaimIds[coverId_];
  }

  /**
   * @notice Internal function to complete the claim data for a view function.
   * @param claimId_ The claim ID
   * @return claimData The extended claim data
   */
  function _claimViewData(
    uint256 claimId_
  )
    internal
    view
    claimsExists(claimId_)
    returns (ClaimRead memory claimData)
  {
    Claim storage claim = claims[claimId_];

    address claimant = coverToken.ownerOf(claim.coverId);
    uint64 poolId = liquidityManager.coverToPool(claim.coverId);

    claimData = ClaimRead({
      claimant: claimant,
      claimId: claimId_,
      poolId: poolId,
      relatedClaimIds: _coverIdToClaimIds[claim.coverId],
      evidence: claimIdToEvidence[claimId_],
      counterEvidence: claimIdToCounterEvidence[claimId_],
      coverAmount: liquidityManager
        .coverInfo(claim.coverId)
        .coverAmount,
      isCoverActive: liquidityManager.isCoverActive(claim.coverId),
      //
      coverId: claim.coverId,
      disputeId: claim.disputeId,
      metaEvidence: claim.metaEvidence,
      status: claim.status,
      createdAt: claim.createdAt,
      amount: claim.amount,
      challenger: claim.challenger,
      deposit: claim.deposit,
      rulingTimestamp: claim.rulingTimestamp
    });

    // We should check if the claim is available for compensation
    if (
      claim.status == ClaimStatus.Initiated &&
      claim.createdAt + challengePeriod < block.timestamp
    ) {
      claimData.status = ClaimStatus.Accepted;
    }
  }

  /**
   * @notice Get a claim by its ID.
   * @param claimId_ The claim ID
   * @return result The claim's data
   */
  function claimInfo(
    uint256 claimId_
  ) external view returns (ClaimRead memory /*result*/) {
    return _claimViewData(claimId_);
  }

  /**
   * @notice Returns multiple claims by their IDs.
   * @param claimIds_ The claim IDs
   *
   * @return result All the claims' data
   */
  function claimInfos(
    uint256[] memory claimIds_
  ) public view returns (ClaimRead[] memory result) {
    uint256 nbClaims = claimIds_.length;

    result = new ClaimRead[](nbClaims);

    for (uint256 i; i < nbClaims; i++) {
      result[i] = _claimViewData(claimIds_[i]);
    }
  }

  /**
   * @notice Returns all the claims associated with a cover.
   * @param coverId_ The cover ID
   *
   * @return claimsInfo All the cover's claims
   */
  function claimsByCoverId(
    uint256 coverId_
  ) public view returns (ClaimRead[] memory /*result*/) {
    uint256[] memory claimIds = _coverIdToClaimIds[coverId_];

    return claimInfos(claimIds);
  }

  /**
   * @notice Returns all the claims of a user.
   * @param account_ The user's address
   *
   * @return result All the user's claims
   */
  function claimsByAccount(
    address account_
  ) external view returns (ClaimRead[] memory result) {
    uint256[] memory coverIds = coverToken.tokensOf(account_);

    uint256 nbCovers = coverIds.length;
    uint256 nbOfClaims;
    for (uint256 i; i < nbCovers; i++) {
      nbOfClaims += _coverIdToClaimIds[coverIds[i]].length;
    }

    result = new ClaimRead[](nbOfClaims);

    uint256 index;
    for (uint256 i; i < nbCovers; i++) {
      uint256[] memory claimsForCover = _coverIdToClaimIds[
        coverIds[i]
      ];
      uint256 nbClaims = claimsForCover.length;

      for (uint256 j; j < nbClaims; j++) {
        result[index] = _claimViewData(claimsForCover[j]);
        index++;
      }
    }
  }

  /**
   * @notice Returns the evidence submitted by claimant for a claim.
   * @param claimId_ The claim ID
   * @return _ The evidence CIDs
   */
  function getClaimEvidence(
    uint256 claimId_
  ) external view claimsExists(claimId_) returns (string[] memory) {
    return claimIdToEvidence[claimId_];
  }

  /**
   * @notice Returns the counter-evidence submitted by challenger or Athena for a claim.
   * @param claimId_ The claim ID
   * @return _ The counter-evidence CIDs
   */
  function getClaimCounterEvidence(
    uint256 claimId_
  ) external view claimsExists(claimId_) returns (string[] memory) {
    return claimIdToCounterEvidence[claimId_];
  }

  // ======= HELPERS ======= //

  /**
   * @notice Sends value to an address.
   * @param to_ The address to send value to
   * @param value_ The amount of ETH to send
   */
  function _sendValue(
    address to_,
    uint256 value_
  ) private returns (bool /* success */, bytes memory /* data */) {
    // We purposefully ignore return value to avoid malicious contracts to block the execution
    // The 4600 gas limit should be enough to avoid future OPCODE gas cost changes
    return payable(to_).call{ value: value_, gas: 4600 }("");
  }

  // ======= EVIDENCE ======= //

  /**
   * @notice
   * Adds evidence IPFS CIDs for a claim.
   * @param claimId_ The claim ID
   * @param ipfsEvidenceCids_ The IPFS CIDs of the evidence
   */
  function submitEvidenceForClaim(
    uint256 claimId_,
    string[] calldata ipfsEvidenceCids_
  ) external claimsExists(claimId_) {
    Claim storage claim = claims[claimId_];

    if (
      claim.status != ClaimStatus.Initiated &&
      claim.status != ClaimStatus.Disputed
    ) revert WrongClaimStatus();

    bool isClaimant = msg.sender == coverToken.ownerOf(claim.coverId);

    if (
      !isClaimant &&
      msg.sender != claim.challenger &&
      msg.sender != evidenceGuardian
    ) revert InvalidParty();

    string[] storage evidence = isClaimant
      ? claimIdToEvidence[claimId_]
      : claimIdToCounterEvidence[claimId_];

    for (uint256 i; i < ipfsEvidenceCids_.length; i++) {
      // Save evidence files
      evidence.push(ipfsEvidenceCids_[i]);

      // Emit event for Kleros to pick up the evidence
      emit Evidence(
        arbitrator, // IArbitrator indexed _arbitrator
        claimId_, // uint256 indexed _evidenceGroupID
        msg.sender, // address indexed _party
        ipfsEvidenceCids_[i] // string _evidence
      );
    }
  }

  // ======= CLAIMS ======= //

  /**
   * @notice
   * Initiates a payment claim to Kleros by a cover holder.
   * @param coverId_ The cover ID
   * @param amountClaimed_ The amount claimed by the cover holder
   * @param ipfsMetaEvidenceCid_ The IPFS CID of the meta evidence file
   */
  function initiateClaim(
    uint256 coverId_,
    uint256 amountClaimed_,
    string calldata ipfsMetaEvidenceCid_
  ) external payable nonReentrant {
    if (courtClosed) revert CourtClosed();
    if (msg.sender != coverToken.ownerOf(coverId_))
      revert OnlyCoverOwner();

    if (amountClaimed_ == 0) revert CannotClaimZero();

    // Register the claim to prevent exit from the pool untill resolution
    liquidityManager.addClaimToPool(coverId_);

    // Check that the user has deposited the collateral & arbitration cost
    uint256 costOfArbitration = arbitrationCost();
    if (msg.value < costOfArbitration + claimCollateral)
      revert InsufficientDeposit();

    // Check if there already an ongoing claim related to this cover
    uint256 nbAssociatedClaims = _coverIdToClaimIds[coverId_].length;
    if (0 < nbAssociatedClaims) {
      uint256 latestClaimId = _coverIdToClaimIds[coverId_][
        nbAssociatedClaims - 1
      ];

      Claim storage prevClaim = claims[latestClaimId];

      // Only allow for a new claim if it is not initiated or disputed
      if (
        prevClaim.status == ClaimStatus.Initiated ||
        prevClaim.status == ClaimStatus.Disputed
      ) revert PreviousClaimStillOngoing();
    }

    // Save latest claim ID of cover and update claim index
    uint256 claimId = nextClaimId;
    nextClaimId++;
    _coverIdToClaimIds[coverId_].push(claimId);

    // Save claim data
    Claim storage claim = claims[claimId];
    claim.coverId = coverId_;
    claim.amount = amountClaimed_;
    claim.metaEvidence = ipfsMetaEvidenceCid_;
    claim.createdAt = uint64(block.timestamp);
    claim.deposit = msg.value;
    claim.status = ClaimStatus.Initiated;

    // Emit Athena claim creation event
    emit ClaimCreated(msg.sender, coverId_, claimId);
    emit MetaEvidence(claimId, ipfsMetaEvidenceCid_);
  }

  // ======= DISPUTE ======= //

  /**
   * @notice
   * Allows a user to challenge a pending claim by creating a dispute in Kleros.
   * @param claimId_ The claim ID
   */
  function disputeClaim(
    uint256 claimId_
  ) external payable claimsExists(claimId_) nonReentrant {
    Claim storage claim = claims[claimId_];

    // Check the claim is in the appropriate status and challenge is within period
    if (
      claim.status != ClaimStatus.Initiated ||
      claim.createdAt + challengePeriod <= block.timestamp
    ) revert ClaimNotChallengeable();

    // Check the claim is not already disputed
    if (claim.challenger != address(0))
      revert ClaimAlreadyChallenged();

    // Check that the challenger has deposited enough capital for dispute creation
    uint256 costOfArbitration = arbitrationCost();
    if (msg.value < costOfArbitration)
      revert MustDepositArbitrationCost();

    // Create the claim and obtain the Kleros dispute ID
    uint256 disputeId = arbitrator.createDispute{
      value: costOfArbitration
    }(uint256(numberOfRulingOptions), klerosExtraData);

    // Update the claim with challenged status and challenger address
    claim.status = ClaimStatus.Disputed;
    claim.challenger = msg.sender;
    claim.disputeId = disputeId;

    // Map the new dispute ID to be able to search it after ruling
    disputeIdToClaimId[disputeId] = claimId_;

    // Emit Kleros event for dispute creation and meta-evidence association
    emit Dispute(arbitrator, disputeId, claimId_, claimId_);
  }

  // ======= RESOLUTION ======= //

  /**
   * @notice Give a ruling for a dispute. Must be called by the arbitrator.
   * @param disputeId_ ID of the dispute in the Arbitrator contract.
   * @param ruling_ Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
   */
  function rule(
    uint256 disputeId_,
    uint256 ruling_
  ) external onlyArbitrator nonReentrant {
    uint256 claimId = disputeIdToClaimId[disputeId_];
    Claim storage claim = claims[claimId];

    // Check the status of the claim
    if (claim.status != ClaimStatus.Disputed)
      revert ClaimNotInDispute();
    if (numberOfRulingOptions < ruling_) revert InvalidRuling();

    // Manage ETH for claim creation, claim collateral and dispute creation
    if (ruling_ == uint256(RulingOptions.PayClaimant)) {
      claim.status = ClaimStatus.AcceptedByCourtDecision;

      // Save timestamp to initiate overrule period
      claim.rulingTimestamp = uint64(block.timestamp);
    } else if (ruling_ == uint256(RulingOptions.RejectClaim)) {
      claim.status = ClaimStatus.RejectedByCourtDecision;

      address challenger = claim.challenger;
      // Refund arbitration cost to the challenger and pay them with collateral
      _sendValue(challenger, claim.deposit);
    } else {
      // This is the case where the arbitrator refuses to rule
      claim.status = ClaimStatus.RejectedByRefusalToArbitrate;

      uint256 halfArbitrationCost = (arbitrationCost() / 2);

      // Send back the collateral and half the arbitration cost to the claimant
      _sendValue(
        coverToken.ownerOf(claim.coverId),
        claim.deposit - halfArbitrationCost
      );
      // Send back half the arbitration cost to the challenger
      _sendValue(claim.challenger, halfArbitrationCost);
    }

    // Remove claims from pool to unblock withdrawals
    liquidityManager.removeClaimFromPool(claim.coverId);

    emit DisputeResolved({
      claimId: claimId,
      disputeId: disputeId_,
      ruling: ruling_
    });
  }

  /**
   * @notice Allows the claimant to withdraw the compensation after a dispute has been resolved in
   * their favor or the challenge period has elapsed.
   * @param claimId_ The claim ID
   *
   * @dev Intentionally public to prevent claimant from indefinitely blocking withdrawals
   * from a pool by not executing the claims ruling.
   */
  function withdrawCompensation(
    uint256 claimId_
  ) external claimsExists(claimId_) nonReentrant {
    Claim storage claim = claims[claimId_];

    // Check the claim is in the appropriate status
    if (claim.status == ClaimStatus.Initiated) {
      // Check the claim has passed the disputable period
      if (block.timestamp < claim.createdAt + challengePeriod)
        revert PeriodNotElapsed();

      // Remove claims from pool to unblock withdrawals
      liquidityManager.removeClaimFromPool(claim.coverId);

      claim.status = ClaimStatus.Compensated;
    } else if (claim.status == ClaimStatus.AcceptedByCourtDecision) {
      // Check the ruling has passed the overrule period
      if (block.timestamp < claim.rulingTimestamp + overrulePeriod)
        revert PeriodNotElapsed();

      claim.status = ClaimStatus.CompensatedAfterDispute;
    } else {
      revert WrongClaimStatus();
    }

    // Send back the collateral and arbitration cost to the claimant
    _sendValue(coverToken.ownerOf(claim.coverId), claim.deposit);

    // Call Athena core to pay the compensation
    liquidityManager.payoutClaim(claim.coverId, claim.amount);
  }

  // ======= ADMIN ======= //

  /**
   * @notice Allows the owner to overrule a claim that has been accepted by the court decision.
   * @param claimId_ The claim ID
   * @param punishClaimant_ Whether to punish the claimant by taking their deposit
   */
  function overrule(
    uint256 claimId_,
    bool punishClaimant_
  ) external claimsExists(claimId_) onlyOwner {
    Claim storage claim = claims[claimId_];

    // Check the claim is in the appropriate status
    if (claim.status != ClaimStatus.AcceptedByCourtDecision)
      revert WrongClaimStatus();
    // Check the ruling has passed the overrule period
    if (claim.rulingTimestamp + overrulePeriod < block.timestamp)
      revert OverrulePeriodEnded();

    claim.status = ClaimStatus.RejectedByOverrule;

    if (punishClaimant_) {
      // In case of blatant attacks on the claim process then punish the offender
      _sendValue(msg.sender, claim.deposit);
    } else {
      // Send back the collateral and arbitration cost to the claimant
      _sendValue(coverToken.ownerOf(claim.coverId), claim.deposit);
    }
  }

  /**
   * @notice Changes the Kleros arbitration configuration.
   * @param klerosArbitrator_ The new Kleros arbitrator.
   * @param subcourtId_ The new subcourt ID.
   * @param nbOfJurors_ The new number of jurors.
   */
  function setKlerosConfiguration(
    IArbitrator klerosArbitrator_,
    uint256 subcourtId_,
    uint256 nbOfJurors_
  ) public onlyOwner {
    arbitrator = klerosArbitrator_;
    klerosExtraData = abi.encode(subcourtId_, nbOfJurors_);
  }

  /**
   * @notice
   * Changes the amount of collateral required when opening a claim.
   * @dev The collateral is paid to the challenger if the claim is disputed and rejected.
   * @param amount_ The new amount of collateral.
   */
  function setRequiredCollateral(uint256 amount_) public onlyOwner {
    claimCollateral = amount_;
  }

  /**
   * @notice Changes the periods for challenging and overruling a claim.
   * @param challengePeriod_ The new challenge period.
   * @param overrulePeriod_ The new overrule period.
   */
  function setPeriods(
    uint64 challengePeriod_,
    uint64 overrulePeriod_
  ) public onlyOwner {
    challengePeriod = challengePeriod_;
    overrulePeriod = overrulePeriod_;
  }

  /**
   * @notice Changes the address of the meta-evidence guardian.
   * @param evidenceGuardian_ The new address of the meta-evidence guardian.
   */
  function setEvidenceGuardian(
    address evidenceGuardian_
  ) external onlyOwner {
    if (evidenceGuardian_ == address(0))
      revert GuardianSetToAddressZero();

    evidenceGuardian = evidenceGuardian_;
  }

  /**
   * @notice Prevents new claims from being created with this claim manager.
   * @param _courtClosed Whether the court is closed or not.
   *
   * @dev This is used when the claim manager is being upgraded.
   */
  function setCourClosed(bool _courtClosed) external onlyOwner {
    courtClosed = _courtClosed;
  }
}
