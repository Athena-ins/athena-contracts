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
    uint256 coverId;
    uint256 disputeId;
    string metaEvidenceURI;
    uint256 amount;
    address prosecutor;
    uint256 deposit;
    uint256 collateral;
    RulingOptions ruling;
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
    RulingOptions ruling;
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

  function withdrawProsecutionReward(uint256 claimId_) external;

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
    uint64 overrulePeriod_,
    uint64 evidenceUploadPeriod_
  ) external;

  function setEvidenceGuardian(address evidenceGuardian_) external;

  function setCourClosed(bool courtClosed_) external;

  function setBaseMetaEvidenceURI(
    string memory baseMetaEvidenceURI_
  ) external;
}
