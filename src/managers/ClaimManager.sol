// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// Contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Libraries
import { ReentrancyGuard } from "../libs/ReentrancyGuard.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

// Interfaces
import { IArbitrator } from "../interfaces/IArbitrator.sol";
import { IArbitrable } from "../interfaces/IArbitrable.sol";
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
error AppealPeriodEnded();
error AppealPeriodOngoing();
error EvidenceUploadPeriodEnded();
error ClaimDoesNotExist();
error CourtClosed();
error CannotChallengeYourOwnClaim();

contract ClaimManager is IClaimManager, Ownable, ReentrancyGuard {
  using Strings for uint256;

  // ======= MODELS ======= //

  // @dev the 'Accepted' status is virtual as it is never written to the blockchain
  // It enables view functions to display the adequate state of the claim
  enum ClaimStatus {
    Initiated,
    Accepted, // Virtual status
    Compensated,
    // Statuses below are only used when a claim is disputed
    Disputed,
    Appealed,
    RejectedByOverrule,
    RejectedByCourtDecision,
    AcceptedByCourtDecision,
    CompensatedAfterDispute,
    ProsecutorPaid
  }

  /// @dev The neutral "refuse to arbitrate" option MUST ALWAYS be 0
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
    uint64 challengedTimestamp;
    ClaimStatus status;
    uint256 coverId;
    uint256 disputeId;
    string metaEvidenceURI;
    uint256 amount;
    address prosecutor;
    uint256 deposit;
    uint256 collateral;
    Appeal[] appeals;
  }

  struct Claim {
    uint64 createdAt;
    uint64 rulingTimestamp;
    uint64 challengedTimestamp;
    ClaimStatus status;
    uint256 coverId;
    uint256 disputeId;
    uint256 amount;
    address claimant;
    address prosecutor;
    uint256 deposit;
    uint256 collateral;
  }

  struct Appeal {
    uint64 appealTimestamp;
    address appellant;
  }

  // ======= STORAGE ======= //

  string public baseMetaEvidenceURI;
  string private _chainId = block.chainid.toString();

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
  // Maps a claim ID to its appeals
  mapping(uint256 _claimId => Appeal[] _appeals)
    public claimIdToAppeals;

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
  uint64 public evidenceUploadPeriod;

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
    uint256 claimCollateral_,
    uint64 challengePeriod_,
    uint64 overrulePeriod_,
    uint64 evidenceUploadPeriod_,
    string memory baseMetaEvidenceURI_
  ) Ownable(msg.sender) {
    coverToken = coverToken_;
    liquidityManager = liquidityManager_;
    evidenceGuardian = evidenceGuardian_;

    baseMetaEvidenceURI = baseMetaEvidenceURI_;

    setRequiredCollateral(claimCollateral_);
    setPeriods(
      challengePeriod_,
      overrulePeriod_,
      evidenceUploadPeriod_
    );
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

  // Emitted when a claim is appealed
  event RulingAppealed(
    uint256 claimId,
    uint256 disputeId,
    address appellant
  );

  // Emitted when the prosecutor claims the collateral
  event ProsecutorPaid(uint256 claimId, uint256 amount);

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
   * @notice Returns the cost of arbitration for a Kleros dispute.
   * @return _ the arbitration cost
   */
  function arbitrationCost() public view returns (uint256) {
    return arbitrator.arbitrationCost(klerosExtraData);
  }

  /**
   * @notice Returns the cost of arbitration for a Kleros dispute.
   * @return _ the arbitration cost
   */
  function appealCost(
    uint256 disputeId_
  ) public view returns (uint256) {
    return arbitrator.appealCost(disputeId_, klerosExtraData);
  }

  /**
   * @notice Returns the URI of the meta-evidence for a claim
   * @param claimId The claim ID
   * @return _ the URI of the meta-evidence
   */
  function metaEvidenceURI(
    uint256 claimId
  ) public view returns (string memory) {
    return
      string.concat(
        baseMetaEvidenceURI,
        "?claimId=",
        claimId.toString(),
        "&chainId=",
        _chainId
      );
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

    uint64 poolId = liquidityManager.coverToPool(claim.coverId);

    Appeal[] storage appeals = claimIdToAppeals[claimId_];

    claimData = ClaimRead({
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
      metaEvidenceURI: metaEvidenceURI(claimId_),
      status: claim.status,
      createdAt: claim.createdAt,
      amount: claim.amount,
      claimant: claim.claimant,
      prosecutor: claim.prosecutor,
      deposit: claim.deposit,
      collateral: claim.collateral,
      rulingTimestamp: claim.rulingTimestamp,
      challengedTimestamp: claim.challengedTimestamp,
      appeals: new Appeal[](appeals.length)
    });

    // Fill the created claim data array with the appeals
    for (uint256 i; i < appeals.length; i++) {
      claimData.appeals[i] = appeals[i];
    }

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
   * @notice Returns the counter-evidence submitted by prosecutor or Athena for a claim.
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
   * @notice Get the latest appeal for a claim.
   * @param claimId_ The claim ID
   * @return appeal The latest appeal data
   */
  function _getLatestAppeal(
    uint256 claimId_
  ) internal view claimsExists(claimId_) returns (Appeal memory) {
    return
      claimIdToAppeals[claimId_][
        claimIdToAppeals[claimId_].length - 1
      ];
  }

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
      claim.status != ClaimStatus.Disputed &&
      claim.status != ClaimStatus.Appealed
    ) revert WrongClaimStatus();

    bool isClaimant = msg.sender == claim.claimant;

    if (
      !isClaimant &&
      msg.sender != claim.prosecutor &&
      msg.sender != evidenceGuardian
    ) revert InvalidParty();

    // Check the evidence upload period has not ended
    bool delayOk = true;
    if (
      claim.status == ClaimStatus.Disputed &&
      claim.challengedTimestamp + evidenceUploadPeriod <
      block.timestamp
    ) {
      delayOk = false;
    } else if (
      claim.status == ClaimStatus.Appealed &&
      _getLatestAppeal(claimId_).appealTimestamp +
        evidenceUploadPeriod <
      block.timestamp
    ) {
      delayOk = false;
    }
    /// @dev Override the delay for the evidence guardian
    if (msg.sender == evidenceGuardian) delayOk = true;

    if (!delayOk) revert EvidenceUploadPeriodEnded();

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
   */
  function initiateClaim(
    uint256 coverId_,
    uint256 amountClaimed_
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
        prevClaim.status == ClaimStatus.Disputed ||
        prevClaim.status == ClaimStatus.Appealed
      ) revert PreviousClaimStillOngoing();
    }

    // Save latest claim ID of cover and update claim index
    uint256 claimId = nextClaimId;
    nextClaimId++;
    _coverIdToClaimIds[coverId_].push(claimId);

    // Save claim data
    Claim storage claim = claims[claimId];
    claim.claimant = msg.sender;
    claim.coverId = coverId_;
    claim.amount = amountClaimed_;
    claim.createdAt = uint64(block.timestamp);
    claim.deposit = msg.value;
    claim.collateral = claimCollateral;
    claim.status = ClaimStatus.Initiated;

    // Emit Athena claim creation event
    emit ClaimCreated(msg.sender, coverId_, claimId);
    emit MetaEvidence(claimId, metaEvidenceURI(claimId));
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
    if (claim.prosecutor != address(0))
      revert ClaimAlreadyChallenged();

    // Check that the prosecutor has deposited enough capital for dispute creation
    uint256 costOfArbitration = arbitrationCost();
    if (msg.value < costOfArbitration)
      revert MustDepositArbitrationCost();

    if (msg.sender == claim.claimant)
      revert CannotChallengeYourOwnClaim();

    // Create the claim and obtain the Kleros dispute ID
    uint256 disputeId = arbitrator.createDispute{
      value: costOfArbitration
    }(uint256(numberOfRulingOptions), klerosExtraData);

    // Update the claim with challenged status and prosecutor address
    claim.status = ClaimStatus.Disputed;
    claim.prosecutor = msg.sender;
    claim.disputeId = disputeId;
    claim.challengedTimestamp = uint64(block.timestamp);

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
    if (
      claim.status != ClaimStatus.Appealed &&
      claim.status != ClaimStatus.Disputed
    ) revert ClaimNotInDispute();
    // @dev Rare edgecase where it targets claim ID 0 with a bad dispute ID
    if (claim.disputeId != disputeId_) revert ClaimDoesNotExist();
    if (numberOfRulingOptions < ruling_) revert InvalidRuling();

    // Save timestamp to initiate overrule period if validated
    claim.rulingTimestamp = uint64(block.timestamp);

    // Manage ETH for claim creation, claim collateral and dispute creation
    if (ruling_ == uint256(RulingOptions.PayClaimant)) {
      claim.status = ClaimStatus.AcceptedByCourtDecision;

      /// @dev The refund of the claimant deposit is made in the withdrawCompensation function
    } else {
      /// @dev Both RulingOptions.RejectClaim and RulingOptions.RefusedToArbitrate considered rejected
      claim.status = ClaimStatus.RejectedByCourtDecision;

      // Refund arbitration cost to the prosecutor
      uint256 arbitrationFee = claim.deposit - claim.collateral;
      _sendValue(claim.prosecutor, arbitrationFee);

      /// @dev The prosecutor is paid the collateral with withdrawProsecutionReward if there is no appeal
    }

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

      claim.status = ClaimStatus.Compensated;
    } else if (claim.status == ClaimStatus.AcceptedByCourtDecision) {
      // Check the ruling has passed the overrule period
      if (block.timestamp < claim.rulingTimestamp + overrulePeriod)
        revert PeriodNotElapsed();

      claim.status = ClaimStatus.CompensatedAfterDispute;
    } else {
      revert WrongClaimStatus();
    }

    // Remove claims from pool to unblock withdrawals
    liquidityManager.removeClaimFromPool(claim.coverId);
    // Call Athena core to pay the compensation
    liquidityManager.payoutClaim(claim.coverId, claim.amount);

    // Send back the collateral and arbitration cost to the claimant
    _sendValue(claim.claimant, claim.deposit);
  }

  /**
   * @notice Allows the prosecutor to withdraw the collateral after a dispute has been resolved in their favor.
   * @param claimId_ The claim ID
   *
   * @dev Intentionally public to prevent prosecutor from indefinitely blocking withdrawals
   * from a pool by not executing the claims ruling.
   */
  function withdrawProsecutionReward(
    uint256 claimId_
  ) external claimsExists(claimId_) nonReentrant {
    Claim storage claim = claims[claimId_];

    if (claim.status != ClaimStatus.RejectedByCourtDecision)
      revert WrongClaimStatus();

    uint256 disputeId = claim.disputeId;
    IArbitrator.DisputeStatus disputeStatus = arbitrator
      .disputeStatus(disputeId);

    if (disputeStatus == IArbitrator.DisputeStatus.Appealable)
      revert AppealPeriodOngoing();

    address appealProsecutor = _getLatestAppeal(claimId_).appellant;

    // Ensure this is not the claimant trying to get his collateral after a loss
    if (appealProsecutor == claim.claimant) revert InvalidParty();

    // Get address depending with priority to the appeal prosecutor
    address collateralBeneficiary = appealProsecutor == address(0)
      ? claim.prosecutor
      : appealProsecutor;

    // Remove claims from pool to unblock withdrawals
    liquidityManager.removeClaimFromPool(claim.coverId);
    // Register the payment of the collateral
    claim.status = ClaimStatus.ProsecutorPaid;

    // Pay the collateral to the prosecutor
    _sendValue(collateralBeneficiary, claim.collateral);

    emit ProsecutorPaid(claimId_, claim.collateral);
  }

  // ======= APPEAL ======= //

  /**
   * @notice Allows a party to appeal a court decision after the appeal wait period
   * @param claimId_ The claim ID
   */
  function appeal(
    uint256 claimId_
  ) external payable claimsExists(claimId_) nonReentrant {
    Claim storage claim = claims[claimId_];

    // Check the claim is in an appealable status
    if (
      claim.status != ClaimStatus.RejectedByCourtDecision &&
      claim.status != ClaimStatus.AcceptedByCourtDecision
    ) revert WrongClaimStatus();

    /**
     * Only the claimant may appeal a rejected claim to avoid:
     * - prosecutors trying to retrial a lost case to get the collateral
     * - the claimant trying to appeal a lost case to get the collateral
     */
    if (
      claim.status == ClaimStatus.RejectedByCourtDecision &&
      msg.sender != claim.claimant
    ) revert InvalidParty();

    uint256 disputeId = claim.disputeId;
    IArbitrator.DisputeStatus disputeStatus = arbitrator
      .disputeStatus(disputeId);

    if (disputeStatus != IArbitrator.DisputeStatus.Appealable)
      revert AppealPeriodEnded();

    // Check deposit covers appeal cost
    uint256 appealFee = arbitrator.appealCost(
      disputeId,
      klerosExtraData
    );
    if (msg.value < appealFee) revert InsufficientDeposit();

    // Create the appeal with Kleros
    arbitrator.appeal{ value: appealFee }(disputeId, klerosExtraData);

    // Create and store appeal data
    claimIdToAppeals[claimId_].push(
      Appeal({
        appealTimestamp: uint64(block.timestamp),
        appellant: msg.sender
      })
    );

    // Update claim status & timestamp
    claim.status = ClaimStatus.Appealed;

    emit RulingAppealed(claimId_, disputeId, msg.sender);
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

    // Remove claims from pool to unblock withdrawals
    liquidityManager.removeClaimFromPool(claim.coverId);

    if (punishClaimant_) {
      // In case of blatant attacks on the claim process then punish the offender
      _sendValue(msg.sender, claim.deposit);
    } else {
      // Send back the collateral and arbitration cost to the claimant
      _sendValue(claim.claimant, claim.deposit);
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
   * @dev The collateral is paid to the prosecutor if the claim is disputed and rejected.
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
    uint64 overrulePeriod_,
    uint64 evidenceUploadPeriod_
  ) public onlyOwner {
    challengePeriod = challengePeriod_;
    overrulePeriod = overrulePeriod_;
    evidenceUploadPeriod = evidenceUploadPeriod_;
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
   * @param courtClosed_ Whether the court is closed or not.
   *
   * @dev This is used when the claim manager is being upgraded.
   */
  function setCourClosed(bool courtClosed_) external onlyOwner {
    courtClosed = courtClosed_;
  }

  /**
   * @notice Changes the base URI for the meta-evidence.
   * @param baseMetaEvidenceURI_ The new base URI for the meta-evidence.
   */
  function setBaseMetaEvidenceURI(
    string memory baseMetaEvidenceURI_
  ) external onlyOwner {
    baseMetaEvidenceURI = baseMetaEvidenceURI_;
  }
}
