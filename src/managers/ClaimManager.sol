// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// Contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Libraries
import { ReentrancyGuard } from "../libs/ReentrancyGuard.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

// Interfaces
import { IClaimManager } from "../interfaces/IClaimManager.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";
import { IDisputeResolver, IArbitrator } from "@kleros/dispute-resolver-interface-contract/contracts/IDisputeResolver.sol";

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
error EvidenceUploadPeriodEnded();
error ClaimDoesNotExist();
error CourtClosed();
error CannotChallengeYourOwnClaim();
error NoAppealPeriod();
error NoAppealPeriodForLosingSide();
error AppealFeeAlreadyPaid();
error DisputeNotResolved();

contract ClaimManager is
  IClaimManager,
  IDisputeResolver,
  Ownable,
  ReentrancyGuard
{
  using Strings for uint256;

  uint256 public constant NUMBER_OF_RULING_OPTIONS = 2; // Number of choices for arbitrator.
  uint256 public constant MULTIPLIER_DIVISOR = 10000; // Divisor parameter for multipliers.

  // Round struct stores the contributions made to particular sides.
  // - 0 side for `RulingOptions.RefusedToArbitrate`.
  // - 1 side for `RulingOptions.PayClaimant`.
  // - 2 side for `RulingOptions.RejectClaim`.
  struct Round {
    uint256[3] paidFees; // Tracks the fees paid in this round in the form paidFees[side].
    bool[3] hasPaid; // True if the fees for this particular side have been fully paid in the form hasPaid[side].
    mapping(address => uint256[3]) contributions; // Maps contributors to their contributions for each side in the form contributions[address][side].
    uint256 feeRewards; // Sum of reimbursable appeal fees available to the parties that made contributions to the side that ultimately wins a dispute.
    uint256[] fundedSides; // Stores the sides that are fully funded.
  }

  // ======= STORAGE ======= //

  string public baseMetaEvidenceURI;
  string private _chainId = block.chainid.toString();

  IAthenaCoverToken public coverToken;
  ILiquidityManager public liquidityManager;
  IArbitrator public arbitrator;

  address public evidenceGuardian;

  uint256 public nextClaimId;
  // Maps a claim ID to a claim's data
  mapping(uint256 _claimId => Claim) public claims;
  // Maps a coverId to its claim IDs
  mapping(uint256 _coverId => uint256[] _claimIds)
    public _coverIdToClaimIds;
  // Maps a Kleros dispute ID to its claim ID
  mapping(uint256 _disputeId => uint256 _claimId)
    public disputeIdToClaimId;

  // Maps claim IDs to round arrays.
  mapping(uint256 _claimId => Round[]) public claimIdtoRoundArray;

  // Maps a claim ID to its submited evidence
  mapping(uint256 _claimId => string[] _URIs)
    public claimIdToEvidence;
  mapping(uint256 _claimId => string[] _URIs)
    public claimIdToCounterEvidence;

  uint256 public claimCollateral;

  // Multipliers are in basis points.
  uint256 public winnerMultiplier; // Multiplier for calculating the appeal fee that must be paid for the answer that was chosen by the arbitrator in the previous round.
  uint256 public loserMultiplier; // Multiplier for calculating the appeal fee that must be paid for the answer that the arbitrator didn't rule for in the previous round.
  uint256 public loserAppealPeriodMultiplier; // Multiplier for calculating the duration of the appeal period for the loser, in basis points.

  // The params for Kleros specifying the subcourt ID and the number of jurors
  bytes public klerosExtraData;

  uint64 public challengePeriod;
  uint64 public overrulePeriod;
  uint64 public evidenceUploadPeriod;

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
    uint64[3] memory periods,
    string memory baseMetaEvidenceURI_,
    uint256[3] memory _multipliers // Winner, loser and loserAppealPeriod respectively
  ) Ownable(msg.sender) {
    coverToken = coverToken_;
    liquidityManager = liquidityManager_;
    evidenceGuardian = evidenceGuardian_;
    setMultipliers(
      _multipliers[0], // Winner multiplier
      _multipliers[1], // Loser multiplier
      _multipliers[2] // LoserAppealPeriod multiplier
    );

    baseMetaEvidenceURI = baseMetaEvidenceURI_;

    setRequiredCollateral(claimCollateral_);
    setPeriods(
      periods[0], // Challenge period
      periods[1], // Overrule period
      periods[2] // evidenceUpload period
    );
    setKlerosConfiguration(arbitrator_, subcourtId_, nbOfJurors_);
  }

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
   * @notice Maps external (arbitrator side) dispute id to local (arbitrable) dispute id.
   * @param externalDisputeID_ Dispute id as on arbitrator side.
   * @return Dispute id as in arbitrable contract aka claimID.
   */
  function externalIDtoLocalID(
    uint256 externalDisputeID_
  ) external view override returns (uint256) {
    return disputeIdToClaimId[externalDisputeID_];
  }

  /**
   * @notice Returns number of possible ruling options. Valid rulings are [0, return value].
   * @return The number of ruling options.
   */
  function numberOfRulingOptions(
    uint256 /* localDisputeID_ */
  ) external pure override returns (uint256) {
    return NUMBER_OF_RULING_OPTIONS;
  }

  /** @dev Returns stake multipliers.
   *  @return winner Winners stake multiplier.
   *  @return loser Losers stake multiplier.
   *  @return loserAppealPeriod Multiplier for calculating an appeal period duration for the losing side.
   *  @return divisor Multiplier divisor.
   */
  function getMultipliers()
    external
    view
    override
    returns (
      uint256 winner,
      uint256 loser,
      uint256 loserAppealPeriod,
      uint256 divisor
    )
  {
    return (
      winnerMultiplier,
      loserMultiplier,
      loserAppealPeriodMultiplier,
      MULTIPLIER_DIVISOR
    );
  }

  /** @dev Returns the sum of withdrawable amount.
   *  @dev This function is O(n) where n is the total number of rounds.
   *  @dev This could exceed the gas limit, therefore this function should be used only as a utility and not be relied upon by other contracts.
   *  @param claimId_ The ID of the claim.
   *  @param beneficiary_ The contributor for which to query.
   *  @param contributedTo_ Side that received contributions from contributor.
   *  @return sum The total amount available to withdraw.
   */
  function getTotalWithdrawableAmount(
    uint256 claimId_,
    address payable beneficiary_,
    uint256 contributedTo_
  ) external view override returns (uint256 sum) {
    Claim storage claim = claims[claimId_];
    if (claim.rulingTimestamp == 0) return sum;

    uint256 finalRuling = uint256(claim.ruling);
    Round[] storage rounds = claimIdtoRoundArray[claimId_];
    uint256 noOfRounds = rounds.length;
    for (
      uint256 roundNumber = 0;
      roundNumber < noOfRounds;
      roundNumber++
    ) {
      Round storage round = rounds[roundNumber];

      if (!round.hasPaid[contributedTo_]) {
        // Allow to reimburse if funding was unsuccessful for this side.
        sum += round.contributions[beneficiary_][contributedTo_];
      } else if (!round.hasPaid[finalRuling]) {
        // Reimburse unspent fees proportionally if the ultimate winner didn't pay appeal fees fully.
        // Note that if only one side is funded it will become a winner and this part of the condition won't be reached.
        sum += round.fundedSides.length > 1
          ? (round.contributions[beneficiary_][contributedTo_] *
              round.feeRewards) /
            (round.paidFees[round.fundedSides[0]] +
              round.paidFees[round.fundedSides[1]])
          : 0;
      } else if (finalRuling == contributedTo_) {
        uint256 paidFees = round.paidFees[contributedTo_];
        // Reward the winner.
        sum += paidFees > 0
          ? (round.contributions[beneficiary_][contributedTo_] *
            round.feeRewards) / paidFees
          : 0;
      }
    }
  }

  /**
   * @notice Returns the cost of arbitration for a Kleros dispute.
   * @return _ the arbitration cost
   */
  function arbitrationCost() public view returns (uint256) {
    return arbitrator.arbitrationCost(klerosExtraData);
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
      ruling: claim.ruling
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
   * @return _ The evidence URIs
   */
  function getClaimEvidence(
    uint256 claimId_
  ) external view claimsExists(claimId_) returns (string[] memory) {
    return claimIdToEvidence[claimId_];
  }

  /**
   * @notice Returns the counter-evidence submitted by prosecutor or Athena for a claim.
   * @param claimId_ The claim ID
   * @return _ The counter-evidence URIs
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
   * Adds evidence URIs for a claim.
   * @param claimId_ The claim ID
   * @param ipfsEvidenceCid_ The URI of the evidence
   */
  function submitEvidence(
    uint256 claimId_,
    string calldata ipfsEvidenceCid_
  ) external override claimsExists(claimId_) {
    Claim storage claim = claims[claimId_];

    if (
      claim.status != ClaimStatus.Initiated &&
      claim.status != ClaimStatus.Disputed
    ) revert WrongClaimStatus();

    bool isClaimant = msg.sender == claim.claimant;

    if (
      !isClaimant &&
      msg.sender != claim.prosecutor &&
      msg.sender != evidenceGuardian
    ) revert InvalidParty();

    // Check the evidence upload period has not ended
    if (
      claim.status == ClaimStatus.Disputed &&
      claim.challengedTimestamp + evidenceUploadPeriod <
      block.timestamp &&
      msg.sender != evidenceGuardian
    ) revert EvidenceUploadPeriodEnded();

    string[] storage evidence = isClaimant
      ? claimIdToEvidence[claimId_]
      : claimIdToCounterEvidence[claimId_];

    evidence.push(ipfsEvidenceCid_);

    // Emit event for Kleros to pick up the evidence
    emit Evidence({
      _arbitrator: arbitrator,
      _evidenceGroupID: claimId_,
      _party: msg.sender,
      _evidence: ipfsEvidenceCid_
    });
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
        prevClaim.status == ClaimStatus.Disputed
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
    emit ClaimCreated({
      claimant: msg.sender,
      coverId: coverId_,
      claimId: claimId
    });
    emit MetaEvidence({
      _metaEvidenceID: claimId,
      _evidence: metaEvidenceURI(claimId)
    });
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
    }(NUMBER_OF_RULING_OPTIONS, klerosExtraData);

    // Update the claim with challenged status and prosecutor address
    claim.status = ClaimStatus.Disputed;
    claim.prosecutor = msg.sender;
    claim.disputeId = disputeId;
    claim.challengedTimestamp = uint64(block.timestamp);

    // Map the new dispute ID to be able to search it after ruling
    disputeIdToClaimId[disputeId] = claimId_;

    // Pre-emptively create a new round for potential appeals.
    claimIdtoRoundArray[claimId_].push();

    // Emit Kleros event for dispute creation and meta-evidence association
    emit Dispute({
      _arbitrator: arbitrator,
      _disputeID: disputeId,
      _metaEvidenceID: claimId_,
      _evidenceGroupID: claimId_
    });
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
  ) external override onlyArbitrator nonReentrant {
    uint256 claimId = disputeIdToClaimId[disputeId_];
    Claim storage claim = claims[claimId];

    // Check the status of the claim
    if (claim.status != ClaimStatus.Disputed)
      revert ClaimNotInDispute();
    // @dev Rare edgecase where it targets claim ID 0 with a bad dispute ID
    if (claim.disputeId != disputeId_) revert ClaimDoesNotExist();
    if (NUMBER_OF_RULING_OPTIONS < ruling_) revert InvalidRuling();

    // Save timestamp to initiate overrule period if validated
    claim.rulingTimestamp = uint64(block.timestamp);
    claim.ruling = RulingOptions(ruling_);

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

      /// @dev The prosecutor is paid the collateral with withdrawProsecutionReward
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

    // Remove claims from pool to unblock withdrawals
    liquidityManager.removeClaimFromPool(claim.coverId);
    // Register the payment of the collateral
    claim.status = ClaimStatus.ProsecutorPaid;

    // Pay the collateral to the prosecutor
    _sendValue(claim.prosecutor, claim.collateral);

    emit ProsecutorPaid({
      claimId: claimId_,
      amount: claim.collateral
    });
  }

  // ======= APPEAL ======= //

  /** @dev Takes up to the total amount required to fund a side. Reimburses the rest. Creates an appeal if both sides are fully funded.
   *  @param claimId_ The claim ID.
   *  @param side_ The ruling option to fund. 0 - refuse to rule, 1 - pay claimant, 2 - reject the claim.
   *  @return Whether the side was fully funded or not.
   */
  function fundAppeal(
    uint256 claimId_,
    uint256 side_
  ) external payable override returns (bool) {
    Claim storage claim = claims[claimId_];
    if (claim.status != ClaimStatus.Disputed)
      revert WrongClaimStatus();
    if (NUMBER_OF_RULING_OPTIONS < side_) revert InvalidRuling();

    uint256 disputeId = claim.disputeId;
    (uint256 appealPeriodStart, uint256 appealPeriodEnd) = arbitrator
      .appealPeriod(disputeId);
    if (
      block.timestamp < appealPeriodStart ||
      block.timestamp >= appealPeriodEnd
    ) revert NoAppealPeriod();

    uint256 multiplier;
    {
      uint256 winner = arbitrator.currentRuling(disputeId);
      if (winner == side_) {
        multiplier = winnerMultiplier;
      } else {
        if (
          block.timestamp - appealPeriodStart >=
          ((appealPeriodEnd - appealPeriodStart) *
            loserAppealPeriodMultiplier) /
            MULTIPLIER_DIVISOR
        ) revert NoAppealPeriodForLosingSide();
        multiplier = loserMultiplier;
      }
    }
    uint256 lastRoundId = claimIdtoRoundArray[claimId_].length - 1;
    Round storage round = claimIdtoRoundArray[claimId_][lastRoundId];
    if (round.hasPaid[side_]) revert AppealFeeAlreadyPaid();
    uint256 appealCost = arbitrator.appealCost(
      disputeId,
      klerosExtraData
    );
    uint256 totalCost = appealCost +
      (appealCost * multiplier) /
      MULTIPLIER_DIVISOR;

    // Take up to the amount necessary to fund the current round at the current costs.
    uint256 contribution = totalCost - round.paidFees[side_] >
      msg.value
      ? msg.value
      : totalCost - round.paidFees[side_];

    emit Contribution({
      _localDisputeID: claimId_,
      _round: lastRoundId,
      ruling: side_,
      _contributor: msg.sender,
      _amount: contribution
    });

    round.contributions[msg.sender][side_] += contribution;
    round.paidFees[side_] += contribution;
    if (round.paidFees[side_] >= totalCost) {
      round.feeRewards += round.paidFees[side_];
      round.fundedSides.push(side_);
      round.hasPaid[side_] = true;

      emit RulingFunded({
        _localDisputeID: claimId_,
        _round: lastRoundId,
        _ruling: side_
      });
    }

    if (round.fundedSides.length > 1) {
      // At least two sides are fully funded.
      claimIdtoRoundArray[claimId_].push();

      round.feeRewards = round.feeRewards - appealCost;
      arbitrator.appeal{ value: appealCost }(
        disputeId,
        klerosExtraData
      );
    }

    if (msg.value > contribution) {
      _sendValue(msg.sender, msg.value - contribution);
    }

    return round.hasPaid[side_];
  }

  /** @dev Sends the fee stake rewards and reimbursements proportional to the contributions made to the winner of a dispute. Reimburses contributions if there is no winner.
   *  @param claimId_ The claim ID.
   *  @param beneficiary_ The address to send reward to.
   *  @param round_ The round from which to withdraw.
   *  @param side_ The ruling to query the reward from.
   *  @return reward The withdrawn amount.
   */
  function withdrawFeesAndRewards(
    uint256 claimId_,
    address payable beneficiary_,
    uint256 round_,
    uint256 side_
  ) public override returns (uint256 reward) {
    Claim storage claim = claims[claimId_];
    Round storage round = claimIdtoRoundArray[claimId_][round_];
    if (claim.rulingTimestamp == 0) revert DisputeNotResolved();

    uint256 finalRuling = uint256(claim.ruling);
    // Allow to reimburse if funding of the round was unsuccessful.
    if (!round.hasPaid[side_]) {
      reward = round.contributions[beneficiary_][side_];
    } else if (!round.hasPaid[finalRuling]) {
      // Reimburse unspent fees proportionally if the ultimate winner didn't pay appeal fees fully.
      // Note that if only one side is funded it will become a winner and this part of the condition won't be reached.
      reward = round.fundedSides.length > 1
        ? (round.contributions[beneficiary_][side_] *
            round.feeRewards) /
          (round.paidFees[round.fundedSides[0]] +
            round.paidFees[round.fundedSides[1]])
        : 0;
    } else if (finalRuling == side_) {
      uint256 paidFees = round.paidFees[side_];
      // Reward the winner.
      reward = paidFees > 0
        ? (round.contributions[beneficiary_][side_] *
          round.feeRewards) / paidFees
        : 0;
    }

    if (reward != 0) {
      round.contributions[beneficiary_][side_] = 0;
      _sendValue(beneficiary_, reward);

      emit Withdrawal({
        _localDisputeID: claimId_,
        _round: round_,
        _ruling: side_,
        _contributor: beneficiary_,
        _reward: reward
      });
    }
  }

  /** @dev Allows to withdraw any rewards or reimbursable fees for all rounds at once.
   *  @dev This function is O(n) where n is the total number of rounds. Arbitration cost of subsequent rounds is `A(n) = 2A(n-1) + 1`.
   *  Thus because of this exponential growth of costs, you can assume n is less than 10 at all times.
   *  @param claimId_ The claim ID.
   *  @param beneficiary_ The address to send reward to.
   *  @param contributedTo_ Side that received contributions from contributor.
   */
  function withdrawFeesAndRewardsForAllRounds(
    uint256 claimId_,
    address payable beneficiary_,
    uint256 contributedTo_
  ) external override {
    uint256 numberOfRounds = claimIdtoRoundArray[claimId_].length;
    for (
      uint256 roundNumber = 0;
      roundNumber < numberOfRounds;
      roundNumber++
    ) {
      withdrawFeesAndRewards(
        claimId_,
        beneficiary_,
        roundNumber,
        contributedTo_
      );
    }
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
   * @param evidenceUploadPeriod_ The new evidence upload period.
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
   * @notice Changes the appeal multipliers.
   * @param winnerMultiplier_ The new winner multiplier.
   * @param loserMultiplier_ The new loser multiplier.
   * @param loserAppealPeriodMultiplier_ The new loserAppealPeriod multiplier.
   */
  function setMultipliers(
    uint256 winnerMultiplier_,
    uint256 loserMultiplier_,
    uint256 loserAppealPeriodMultiplier_
  ) public onlyOwner {
    winnerMultiplier = winnerMultiplier_;
    loserMultiplier = loserMultiplier_;
    loserAppealPeriodMultiplier = loserAppealPeriodMultiplier_;
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
