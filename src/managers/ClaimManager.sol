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
error WrongClaimStatus(IClaimManager.ClaimStatus _claimStatus);
error InvalidParty();
error CannotClaimZero();
error IncorrectDeposit();
error PreviousClaimStillOngoing();
error ClaimNotChallengeable();
error ClaimAlreadyChallenged();
error ClaimNotInDispute();
error InvalidRuling();
error GuardianSetToAddressZero();
error OverrulePeriodEnded();
error WithdrawConditionsNotMet();
error EvidenceUploadPeriodEnded();
error ClaimDoesNotExist();
error CourtClosed();
error CannotChallengeYourOwnClaim();
error OutOfAppealPeriodBounds();
error AppealFeeAlreadyPaid();
error DisputeAlreadyResolved();
error DisputeNotResolved();
error InvalidRoundId();

contract ClaimManager is
  IClaimManager,
  IDisputeResolver,
  Ownable,
  ReentrancyGuard
{
  using Strings for uint256;

  uint256 public constant NUMBER_OF_RULING_OPTIONS = 2; // Number of choices for arbitrator.
  uint256 public constant MULTIPLIER_DIVISOR = 10_000; // Divisor parameter for multipliers.

  // ======= STORAGE ======= //

  string public baseMetaEvidenceURI;
  string private _chainId = block.chainid.toString();

  IAthenaCoverToken public coverToken;
  ILiquidityManager public liquidityManager;
  IArbitrator public arbitrator;

  address public evidenceGuardian;

  uint256 public nextClaimId;
  // Maps a coverId to its claim IDs
  mapping(uint256 _coverId => uint256[] _claimIds)
    public _coverIdToClaimIds;
  // Maps a claim ID to a claim's data
  mapping(uint256 _claimId => Claim) public claims;
  // Maps claim IDs to round arrays.
  mapping(uint256 _claimId => Round[]) public claimIdtoRoundArray;
  // Maps a Kleros dispute ID to its claim ID
  mapping(uint256 _disputeId => uint256 _claimId)
    public disputeIdToClaimId;

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
  uint64 public evidenceUploadPeriod;
  uint64 public overrulePeriod;

  bool public courtClosed;

  // ======= CONSTRUCTOR ======= //

  /** @dev Constructor for the ClaimManager contract.
   *  @param coverToken_ The Athena cover token contract address
   *  @param liquidityManager_ The liquidity manager contract address
   *  @param arbitrator_ The Kleros arbitrator contract address
   *  @param evidenceGuardian_ The address allowed to submit evidence without time restrictions
   *  @param subcourtId_ The ID of the Kleros subcourt to use
   *  @param nbOfJurors_ The number of jurors to use for disputes
   *  @param claimCollateral_ The amount of collateral required to submit a claim
   *  @param baseMetaEvidenceURI_ The base URI for meta-evidence
   *  @param periods_ Array containing [challengePeriod, evidenceUploadPeriod, overrulePeriod] in seconds
   *  @param multipliers_ Array containing [winnerMultiplier, loserMultiplier, loserAppealPeriodMultiplier] in basis points
   */
  constructor(
    IAthenaCoverToken coverToken_,
    ILiquidityManager liquidityManager_,
    IArbitrator arbitrator_,
    address evidenceGuardian_,
    uint256 subcourtId_,
    uint256 nbOfJurors_,
    uint256 claimCollateral_,
    string memory baseMetaEvidenceURI_,
    uint64[3] memory periods_, // [challengePeriod, evidenceUploadPeriod, overrulePeriod]
    uint16[3] memory multipliers_ // [winnerMultiplier, loserMultiplier, loserAppealPeriodMultiplier]
  ) Ownable(msg.sender) {
    coverToken = coverToken_;
    liquidityManager = liquidityManager_;
    evidenceGuardian = evidenceGuardian_;

    baseMetaEvidenceURI = baseMetaEvidenceURI_;

    setRequiredCollateral(claimCollateral_);
    setKlerosConfiguration(arbitrator_, subcourtId_, nbOfJurors_);

    setPeriods(periods_[0], periods_[1], periods_[2]);
    setMultipliers(multipliers_[0], multipliers_[1], multipliers_[2]);
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
   * @notice Returns the appeal cost for a given dispute ID.
   * @param disputeId The dispute ID
   * @return The appeal cost
   */
  function getAppealCost(
    uint256 disputeId
  ) external view returns (uint256) {
    return arbitrator.appealCost(disputeId, klerosExtraData);
  }

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

  /** @dev Checks if a claim has auto-resolved due to the challenge period expiring without any dispute.
   *  @param claimId_ The claim ID to check
   *  @return isResolved True if the claim has auto-resolved due to no dispute within challenge period
   */
  function hasAutoResolved(
    uint256 claimId_
  ) public view returns (bool /*isResolved*/) {
    Claim storage claim = claims[claimId_];

    // Case where the claim is not disputed
    if (
      claim.status == ClaimStatus.Initiated &&
      claim.createdAt + challengePeriod <= block.timestamp
    ) return true;

    return false;
  }

  /** @dev Checks if a claim that was accepted by court decision is now finalized (overrule period has passed).
   *  @param claimId_ The claim ID to check
   *  @return isAcceptationFinalized True if the claim was accepted by court decision and overrule period has passed
   */
  function hasAcceptationFinalized(
    uint256 claimId_
  ) public view returns (bool /*isAcceptationFinalized*/) {
    Claim storage claim = claims[claimId_];

    if (
      claim.status == ClaimStatus.AcceptedByCourtDecision &&
      claim.rulingTimestamp + overrulePeriod <= block.timestamp
    ) return true;

    return false;
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

  /** @dev Returns the withdrawable amount for a given round and side.
   *  @param claimId_ The ID of the claim.
   *  @param beneficiary_ The contributor for which to query.
   *  @param round_ The round from which to withdraw.
   *  @param side_ The ruling to query the reward from.
   *  @return sum The total amount available to withdraw.
   */
  function getWithdrawableAmount(
    uint256 claimId_,
    address payable beneficiary_,
    uint256 round_,
    uint256 side_
  ) public view returns (uint256) {
    // Early return if the claim is not resolved
    if (claims[claimId_].rulingTimestamp == 0) return 0;

    uint256 finalRuling = uint256(claims[claimId_].ruling);

    return
      _withdrawableAmount(
        claimId_,
        beneficiary_,
        round_,
        side_,
        finalRuling
      );
  }

  /** @dev Returns the sum of withdrawable amount.
   *  @dev This function is O(n) where n is the total number of rounds.
   *  @dev This could exceed the gas limit, therefore this function should be used only as a utility and not be relied upon by other contracts.
   *  @param claimId_ The ID of the claim.
   *  @param beneficiary_ The contributor for which to query.
   *  @param side_ Side that received contributions from contributor.
   *  @return sum The total amount available to withdraw.
   */
  function getTotalWithdrawableAmount(
    uint256 claimId_,
    address payable beneficiary_,
    uint256 side_
  ) public view override returns (uint256 sum) {
    // Early return if the claim is not resolved
    if (claims[claimId_].rulingTimestamp == 0) return 0;

    uint256 finalRuling = uint256(claims[claimId_].ruling);

    uint256 nbOfRounds = claimIdtoRoundArray[claimId_].length;
    for (uint256 round; round < nbOfRounds; round++) {
      sum += _withdrawableAmount(
        claimId_,
        beneficiary_,
        round,
        side_,
        finalRuling
      );
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

    RoundRead[] memory appealRounds = roundsDataByClaimId(claimId_);

    // Only fetch the current ruling for disputed claims
    int256 currentRuling = claim.disputeId != 0
      ? int256(arbitrator.currentRuling(claim.disputeId))
      : -1;

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
      coverId: claim.coverId,
      disputeId: claim.disputeId,
      metaEvidenceURI: metaEvidenceURI(claimId_),
      status: claim.status,
      ruling: claim.ruling,
      createdAt: claim.createdAt,
      amount: claim.amount,
      claimant: claim.claimant,
      prosecutor: claim.prosecutor,
      deposit: claim.deposit,
      collateral: claim.collateral,
      rulingTimestamp: claim.rulingTimestamp,
      challengedTimestamp: claim.challengedTimestamp,
      appeals: claim.appeals,
      appealRounds: appealRounds,
      currentRuling: currentRuling
    });

    // We check if a claim has auto resolved by passing the challenge period
    if (hasAutoResolved(claimId_)) {
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

  /** @dev Returns all rounds data for a claim
   *  @param claimId_ The ID of the claim to get rounds for
   *  @return rounds Array of round data
   *  @notice The contributions mapping cannot be returned and must be queried separately
   */
  function roundsDataByClaimId(
    uint256 claimId_
  )
    public
    view
    claimsExists(claimId_)
    returns (RoundRead[] memory rounds)
  {
    Round[] storage claimRounds = claimIdtoRoundArray[claimId_];
    rounds = new RoundRead[](claimRounds.length);

    for (uint256 i; i < claimRounds.length; i++) {
      Round storage round = claimRounds[i];
      rounds[i] = RoundRead({
        paidFees: round.paidFees,
        hasPaid: round.hasPaid,
        feeRewards: round.feeRewards,
        fundedSides: round.fundedSides
      });
    }
  }

  /** @dev Returns the contributions made by a contributor across all rounds
   *  @param claimId_ The ID of the claim
   *  @param contributor_ The address of the contributor
   *  @return roundContributions Array of contributions for each round, where each element is an array of contributions for each side: [RefusedToArbitrate, PayClaimant, RejectClaim]
   */
  function getContributionsByRound(
    uint256 claimId_,
    address contributor_
  )
    external
    view
    claimsExists(claimId_)
    returns (uint256[3][] memory roundContributions)
  {
    Round[] storage claimRounds = claimIdtoRoundArray[claimId_];
    roundContributions = new uint256[3][](claimRounds.length);

    for (uint256 i; i < claimRounds.length; i++) {
      Round storage round = claimRounds[i];
      roundContributions[i] = round.contributions[contributor_];
    }
  }

  // ======= HELPERS ======= //

  /** @dev Calculates the withdrawable amount for a given round and side.
   *  @param claimId_ The ID of the claim
   *  @param beneficiary_ The contributor to calculate withdrawal for
   *  @param round_ The round to calculate withdrawal from
   *  @param side_ The ruling option to calculate withdrawal for
   *  @param finalRuling The final ruling of the dispute
   *  @return sum The total amount available to withdraw
   */
  function _withdrawableAmount(
    uint256 claimId_,
    address payable beneficiary_,
    uint256 round_,
    uint256 side_,
    uint256 finalRuling
  ) internal view returns (uint256 sum) {
    Round storage round = claimIdtoRoundArray[claimId_][round_];
    uint256 paidFees = round.paidFees[side_];

    if (!round.hasPaid[side_]) {
      // Allow to reimburse if funding was unsuccessful for this side.
      sum += round.contributions[beneficiary_][side_];
    } else if (
      !round.hasPaid[finalRuling] && 1 < round.fundedSides.length
    ) {
      // Reimburse unspent fees proportionally if the ultimate winner didn't pay appeal fees fully.
      // Note that if only one side is funded it will become a winner and this part of the condition won't be reached.
      sum +=
        (round.contributions[beneficiary_][side_] *
          round.feeRewards) /
        (round.paidFees[round.fundedSides[0]] +
          round.paidFees[round.fundedSides[1]]);
    } else if (finalRuling == side_ && 0 < paidFees) {
      // Reward the winner.
      sum +=
        (round.contributions[beneficiary_][side_] *
          round.feeRewards) /
        paidFees;
    }
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

  /** @dev Validates if the caller can upload evidence for a claim.
   *  @param claimId_ The claim ID to check
   *  @dev Reverts if:
   *  - The claim status is not Initiated, Disputed or Appealed
   *  - The evidence upload period has ended
   *  - The caller is not the claimant, prosecutor, or a contributor to the case
   */
  function _checkCanUploadEvidence(uint256 claimId_) internal view {
    Claim storage claim = claims[claimId_];

    if (
      claim.status != ClaimStatus.Initiated &&
      claim.status != ClaimStatus.Disputed &&
      claim.status != ClaimStatus.Appealed
    ) revert WrongClaimStatus(claim.status);

    /// @dev Override the delay for the evidence guardian
    if (msg.sender == evidenceGuardian) return;

    uint256 contribution;
    // Check the evidence upload period has not ended
    if (
      claim.status == ClaimStatus.Disputed &&
      claim.challengedTimestamp + evidenceUploadPeriod <
      block.timestamp
    ) {
      revert EvidenceUploadPeriodEnded();
    } else if (claim.status == ClaimStatus.Appealed) {
      if (
        claim.appeals[claim.appeals.length - 1] +
          evidenceUploadPeriod <
        block.timestamp
      ) revert EvidenceUploadPeriodEnded();

      /// @dev Allow contributors to the prosecution sides to submit evidence
      uint256 roundId = claimIdtoRoundArray[claimId_].length - 1;
      Round storage round = claimIdtoRoundArray[claimId_][roundId];
      contribution =
        round.contributions[msg.sender][0] +
        round.contributions[msg.sender][2];
    }

    if (
      msg.sender != claim.claimant &&
      msg.sender != claim.prosecutor &&
      contribution == 0
    ) revert InvalidParty();
  }

  // ======= EVIDENCE ======= //

  /**
   * @notice
   * Adds evidence URIs for a claim.
   * @param claimId_ The claim ID
   * @param evidenceURI_ The URI of the evidence
   */
  function submitEvidence(
    uint256 claimId_,
    string calldata evidenceURI_
  ) external override claimsExists(claimId_) {
    /// @dev This will revert if evidence cannot be submitted by the caller
    _checkCanUploadEvidence(claimId_);

    Claim storage claim = claims[claimId_];
    string[] storage evidence = msg.sender == claim.claimant
      ? claimIdToEvidence[claimId_]
      : claimIdToCounterEvidence[claimId_];

    evidence.push(evidenceURI_);

    // Emit event for Kleros to pick up the evidence
    emit Evidence({
      _arbitrator: arbitrator,
      _evidenceGroupID: claimId_,
      _party: msg.sender,
      _evidence: evidenceURI_
    });
  }

  /**
   * @notice
   * Adds evidence URIs for a claim.
   * @param claimId_ The claim ID
   * @param evidenceURIs_ The URIs of the evidence
   */
  function submitEvidenceForClaim(
    uint256 claimId_,
    string[] calldata evidenceURIs_
  ) external claimsExists(claimId_) {
    /// @dev This will revert if evidence cannot be submitted by the caller
    _checkCanUploadEvidence(claimId_);

    Claim storage claim = claims[claimId_];
    string[] storage evidence = msg.sender == claim.claimant
      ? claimIdToEvidence[claimId_]
      : claimIdToCounterEvidence[claimId_];

    for (uint256 i; i < evidenceURIs_.length; i++) {
      // Save evidence files
      evidence.push(evidenceURIs_[i]);

      // Emit event for Kleros to pick up the evidence
      emit Evidence({
        _arbitrator: arbitrator,
        _evidenceGroupID: claimId_,
        _party: msg.sender,
        _evidence: evidenceURIs_[i]
      });
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
    if (msg.value != costOfArbitration + claimCollateral)
      revert IncorrectDeposit();

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
    bool isAutoResolved = hasAutoResolved(claimId_);
    if (isAutoResolved) revert ClaimNotChallengeable();

    // Check the claim is not already disputed
    if (claim.prosecutor != address(0))
      revert ClaimAlreadyChallenged();

    // Check that the prosecutor has deposited enough capital for dispute creation
    uint256 costOfArbitration = arbitrationCost();
    if (msg.value != costOfArbitration) revert IncorrectDeposit();

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

    // Initialize appeal round since it is complex for fundAppeal() to distinct creation from update
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
    if (
      claim.status != ClaimStatus.Disputed &&
      claim.status != ClaimStatus.Appealed
    ) revert ClaimNotInDispute();
    // @dev Rare edgecase where it targets claim ID 0 with a bad dispute ID
    if (claim.disputeId != disputeId_) revert ClaimDoesNotExist();
    if (NUMBER_OF_RULING_OPTIONS < ruling_) revert InvalidRuling();

    // Save timestamp to initiate overrule period if validated
    claim.rulingTimestamp = uint64(block.timestamp);
    claim.ruling = RulingOptions(ruling_);

    // Manage ETH for claim creation, claim collateral and dispute creation
    if (ruling_ == uint256(RulingOptions.PayClaimant)) {
      claim.status = ClaimStatus.AcceptedByCourtDecision;
    } else {
      /// @dev Both RulingOptions.RejectClaim and RulingOptions.RefusedToArbitrate considered rejected
      claim.status = ClaimStatus.RejectedByCourtDecision;
    }

    emit DisputeResolved({
      claimId: claimId,
      disputeId: disputeId_,
      ruling: ruling_
    });
  }

  /**
   * @notice Allows the claimant to withdraw the compensation after the challenge period has elapsed or after the overrule period for a dispute that has been resolved in their favor.
   * @param claimId_ The claim ID
   *
   * @dev Intentionally public to prevent claimant from indefinitely blocking withdrawals
   * from a pool by not executing the claims ruling.
   */
  function withdrawCompensation(
    uint256 claimId_
  ) external claimsExists(claimId_) nonReentrant {
    Claim storage claim = claims[claimId_];

    // Check the claim is in the appropriate status & challenge/overrule period has elapsed
    if (hasAutoResolved(claimId_)) {
      claim.status = ClaimStatus.Compensated;
    } else if (hasAcceptationFinalized(claimId_)) {
      claim.status = ClaimStatus.CompensatedAfterDispute;
    } else {
      revert WithdrawConditionsNotMet();
    }

    // Remove claims from pool to unblock withdrawals
    liquidityManager.removeClaimFromPool(claim.coverId);
    // Call Athena core to pay the compensation
    liquidityManager.payoutClaim(claim.coverId, claim.amount);

    // Send back the collateral and arbitration cost to the claimant
    _sendValue(claim.claimant, claim.deposit);
  }

  /** @dev Allows prosecutor to finalize the dispute process and withdraw his reward after winning a dispute.
   *  @param claimId_ The ID of the claim to resolve
   *  @dev This function is intentionally public to prevent prosecutor from blocking pool withdrawals
   */
  function resolveProsecution(
    uint256 claimId_
  ) external claimsExists(claimId_) nonReentrant {
    Claim storage claim = claims[claimId_];

    // Check the claim has been ruled for by Kleros
    if (claim.status != ClaimStatus.RejectedByCourtDecision)
      revert WrongClaimStatus(claim.status);

    claim.status = ClaimStatus.ProsecutionResolved;
    // Remove claims from pool to unblock withdrawals
    liquidityManager.removeClaimFromPool(claim.coverId);

    /// @dev The prosecutor is refunded the arbitration fee & paid the collateral
    _sendValue(claim.prosecutor, claim.deposit);
    emit ProsecutorPaid({ claimId: claimId_, amount: claim.deposit });
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
  ) external payable override nonReentrant returns (bool) {
    Claim storage claim = claims[claimId_];

    if (
      claim.status != ClaimStatus.Disputed &&
      claim.status != ClaimStatus.Appealed
    ) revert WrongClaimStatus(claim.status);
    if (NUMBER_OF_RULING_OPTIONS < side_) revert InvalidRuling();

    uint256 disputeId = claim.disputeId;
    uint256 lastRoundWinner = arbitrator.currentRuling(disputeId);

    // Check for appeal periods
    {
      (
        uint256 appealPeriodStart,
        uint256 appealPeriodEnd
      ) = arbitrator.appealPeriod(disputeId);

      if (
        block.timestamp < appealPeriodStart ||
        appealPeriodEnd <= block.timestamp
      ) revert OutOfAppealPeriodBounds();

      if (
        lastRoundWinner != side_ &&
        ((appealPeriodEnd - appealPeriodStart) *
          loserAppealPeriodMultiplier) /
          MULTIPLIER_DIVISOR <=
        block.timestamp - appealPeriodStart
      ) revert OutOfAppealPeriodBounds();
    }

    // Compute appeal costs including incentive
    uint256 appealCost = arbitrator.appealCost(
      disputeId,
      klerosExtraData
    );
    uint256 totalCost;
    {
      uint256 multiplier = lastRoundWinner == side_
        ? winnerMultiplier
        : loserMultiplier;

      totalCost =
        appealCost +
        ((appealCost * multiplier) / MULTIPLIER_DIVISOR);
    }

    uint256 roundId = claimIdtoRoundArray[claimId_].length - 1;
    Round storage round = claimIdtoRoundArray[claimId_][roundId];

    if (round.hasPaid[side_]) revert AppealFeeAlreadyPaid();

    // Take up to the amount necessary to fund the current round at the current costs.
    uint256 contribution = msg.value <
      totalCost - round.paidFees[side_]
      ? msg.value
      : totalCost - round.paidFees[side_];

    emit Contribution({
      _localDisputeID: claimId_,
      _round: roundId,
      ruling: side_,
      _contributor: msg.sender,
      _amount: contribution
    });

    round.contributions[msg.sender][side_] += contribution;
    round.paidFees[side_] += contribution;

    if (totalCost <= round.paidFees[side_]) {
      round.feeRewards += round.paidFees[side_];
      round.fundedSides.push(uint8(side_));
      round.hasPaid[side_] = true;

      if (1 < round.fundedSides.length) {
        claim.appeals.push(uint64(block.timestamp));
        claim.status = ClaimStatus.Appealed;

        // Push new entity to track next round ID
        claimIdtoRoundArray[claimId_].push();

        round.feeRewards = round.feeRewards - appealCost;
        arbitrator.appeal{ value: appealCost }(
          disputeId,
          klerosExtraData
        );
      }

      emit RulingFunded({
        _localDisputeID: claimId_,
        _round: roundId,
        _ruling: side_
      });
    }

    // Refund any excess contribution
    if (contribution < msg.value) {
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
  ) public override nonReentrant returns (uint256 reward) {
    reward = getWithdrawableAmount(
      claimId_,
      beneficiary_,
      round_,
      side_
    );

    if (reward != 0) {
      Round storage round = claimIdtoRoundArray[claimId_][round_];
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
   *  @param side_ Side that received contributions from contributor.
   */
  function withdrawFeesAndRewardsForAllRounds(
    uint256 claimId_,
    address payable beneficiary_,
    uint256 side_
  ) external override nonReentrant {
    uint256 nbOfRounds = claimIdtoRoundArray[claimId_].length;

    for (uint256 round; round < nbOfRounds; round++) {
      withdrawFeesAndRewards(claimId_, beneficiary_, round, side_);
    }
  }

  // ======= ADMIN ======= //

  /**
   * @notice Allows the owner to overrule a claim during the challenge period or during the overrule period after it has been accepted by the court decision.
   * @param claimId_ The claim ID
   * @param punishClaimant_ Whether to punish the claimant by taking their deposit
   */
  function overrule(
    uint256 claimId_,
    bool punishClaimant_
  ) external claimsExists(claimId_) onlyOwner {
    Claim storage claim = claims[claimId_];

    // Check the claim is in the appropriate status
    if (
      claim.status != ClaimStatus.Initiated &&
      claim.status != ClaimStatus.AcceptedByCourtDecision
    ) revert WrongClaimStatus(claim.status);

    // Check the claim has not yet passed the challenge/overrule period
    if (
      hasAutoResolved(claimId_) || hasAcceptationFinalized(claimId_)
    ) revert OverrulePeriodEnded();

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
   * @param amount_ The new amount of collateral in ETH.
   */
  function setRequiredCollateral(uint256 amount_) public onlyOwner {
    claimCollateral = amount_;
  }

  /**
   * @notice Changes the periods for challenging, evidence upload, and overruling a claim.
   * @param challengePeriod_ The new challenge period.
   * @param evidenceUploadPeriod_ The new evidence upload period.
   * @param overrulePeriod_ The new overrule period.
   */
  function setPeriods(
    uint64 challengePeriod_,
    uint64 evidenceUploadPeriod_,
    uint64 overrulePeriod_
  ) public onlyOwner {
    challengePeriod = challengePeriod_;
    evidenceUploadPeriod = evidenceUploadPeriod_;
    overrulePeriod = overrulePeriod_;
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
