// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;
import { IArbitrator } from "@kleros/dispute-resolver-interface-contract/contracts/IDisputeResolver.sol";

interface IClaimManager {
  // ======= ENUMS ======= //

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
    ProsecutionResolved
  }

  /// @dev The neutral "refuse to arbitrate" option MUST ALWAYS be 0
  enum RulingOptions {
    RefusedToArbitrate,
    PayClaimant,
    RejectClaim
  }

  // ======= STRUCTS ======= //

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
    RulingOptions ruling;
    uint256 coverId;
    uint256 disputeId;
    string metaEvidenceURI;
    uint256 amount;
    address prosecutor;
    uint256 deposit;
    uint256 collateral;
    uint64[] appeals;
    RoundRead[] appealRounds;
    int256 currentRuling;
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
    uint64[] appeals;
    RulingOptions ruling;
  }

  /** @dev Struct to return round data since mappings can't be returned directly
   */
  struct RoundRead {
    bool[3] hasPaid;
    uint8[] fundedSides;
    uint256[3] paidFees;
    uint256 feeRewards;
  }

  // Round struct stores the contributions made to particular sides.
  // - 0 side for `RulingOptions.RefusedToArbitrate`.
  // - 1 side for `RulingOptions.PayClaimant`.
  // - 2 side for `RulingOptions.RejectClaim`.
  struct Round {
    uint8[] fundedSides; // Stores the sides that are fully funded.
    bool[3] hasPaid; // True if the fees for this particular side have been fully paid in the form hasPaid[side].
    uint256[3] paidFees; // Tracks the fees paid in this round in the form paidFees[side].
    uint256 feeRewards; // Sum of reimbursable appeal fees available to the parties that made contributions to the side that ultimately wins a dispute.
    mapping(address => uint256[3]) contributions; // Maps contributors to their contributions for each side in the form contributions[address][side].
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
    uint256 indexed ruling,
    uint256 indexed claimId,
    uint256 disputeId
  );

  // Emitted when the prosecutor claims the collateral
  event ProsecutorPaid(uint256 claimId, uint256 amount);

  // View functions
  function arbitrationCost() external view returns (uint256);

  function metaEvidenceURI(
    uint256 claimId
  ) external view returns (string memory);

  function coverIdToClaimIds(
    uint256 coverId_
  ) external view returns (uint256[] memory);

  function claimInfo(
    uint256 claimId_
  ) external view returns (ClaimRead memory);

  function claimInfos(
    uint256[] memory claimIds_
  ) external view returns (ClaimRead[] memory);

  function claimsByCoverId(
    uint256 coverId_
  ) external view returns (ClaimRead[] memory);

  function claimsByAccount(
    address account_
  ) external view returns (ClaimRead[] memory);

  function getClaimEvidence(
    uint256 claimId_
  ) external view returns (string[] memory);

  function getClaimCounterEvidence(
    uint256 claimId_
  ) external view returns (string[] memory);

  function initiateClaim(
    uint256 coverId_,
    uint256 amountClaimed_
  ) external payable;

  function disputeClaim(uint256 claimId_) external payable;

  function withdrawCompensation(uint256 claimId_) external;

  // Admin functions
  function overrule(uint256 claimId_, bool punishClaimant_) external;

  function setKlerosConfiguration(
    IArbitrator klerosArbitrator_,
    uint256 subcourtId_,
    uint256 nbOfJurors_
  ) external;

  function setRequiredCollateral(uint256 amount_) external;

  function setPeriods(
    uint64 challengePeriod_,
    uint64 evidenceUploadPeriod_,
    uint64 overrulePeriod_
  ) external;

  function setEvidenceGuardian(address evidenceGuardian_) external;

  function setCourClosed(bool courtClosed_) external;

  function setBaseMetaEvidenceURI(
    string memory baseMetaEvidenceURI_
  ) external;
}
