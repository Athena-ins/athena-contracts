// SPDX-License-Identifier: UNLICENCED
pragma solidity 0.8.20;

// Contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Libraries
import { VerifySignature } from "../libs/VerifySignature.sol";

// Interfaces
import { IArbitrable } from "../interfaces/IArbitrable.sol";
import { IArbitrator } from "../interfaces/IArbitrator.sol";
import { IClaimManager } from "../interfaces/IClaimManager.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";

// @bw need to set args for Kleros arbitrator (pass sub court ID in args, min amount of jurors, etc)
// https://docs.kleros.io/integrations/types-of-integrations/1.-dispute-resolution-integration-plan/smart-contract-integration
// https://etherscan.io/address/0x988b3a538b618c7a603e1c11ab82cd16dbe28069#code

// @bw need to add veto power for V0

// ======= ERRORS ======= //

error OnlyLiquidityManager();
error OnlyArbitrator();
error OnlyCoverOwner();
error OutOfRange();
error BadRange();
error WrongClaimStatus();
error InvalidParty();
error InvalidMetaEvidence();
error CannotClaimZero();
error NotEnoughEthForClaim();
error PreviousClaimStillOngoing();
error ClaimNotChallengeable();
error ClaimAlreadyChallenged();
error MustMatchClaimantDeposit();
error ClaimNotInDispute();
error InvalidRuling();
error DelayNotElapsed();
error GuardianSetToAddressZero();

// IClaimManager,
contract ClaimManager is Ownable, VerifySignature, IArbitrable {
  // ======= MODELS ======= //

  // @dev the 'Accepted' status is virtual as it is never written to the blockchain
  // It enables view functions to display the adequate state of the claim
  enum ClaimStatus {
    Initiated,
    Accepted,
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

  struct ClaimView {
    uint256 coverId;
    uint256 poolId;
    uint256 claimId;
    uint256 disputeId;
    ClaimStatus status;
    uint256 createdAt;
    uint256 amount;
    address challenger;
    uint256 arbitrationCost;
    string[] evidence;
    string[] counterEvidence;
    string metaEvidence;
  }

  // @dev claimId is set to 0 to minimize gas cost but filled in view functions
  struct Claim {
    uint256 coverId;
    uint256 disputeId;
    ClaimStatus status;
    uint256 createdAt;
    uint256 amount;
    address challenger;
    uint256 arbitrationCost;
  }

  // ======= STORAGE ======= //

  IAthenaCoverToken public coverToken;
  ILiquidityManager public liquidityManager;
  IArbitrator public arbitrator;

  address public metaEvidenceGuardian;
  uint256 public challengeDelay = 14 days;
  uint256 public nextClaimId;
  uint256 public collateralAmount = 0.01 ether;

  uint256 public immutable numberOfRulingOptions = 2;

  // Maps a claim ID to a claim's data
  mapping(uint256 => Claim) public claims;
  // Maps a coverId to its claim IDs
  mapping(uint256 => uint256[]) public coverIdToClaimIds;
  // Maps a Kleros dispute ID to its claim ID
  mapping(uint256 => uint256) public disputeIdToClaimId;

  // Maps a protocol ID to its generic meta-evidence IPFS file CID
  mapping(uint256 => string) public poolIdToCoverTerms;

  // Maps a claim ID to its submited evidence
  mapping(uint256 => string[]) public claimIdToEvidence;
  mapping(uint256 => string[]) public claimIdToCounterEvidence;

  // ======= CONSTRUCTOR ======= //

  constructor(
    IAthenaCoverToken coverToken_,
    ILiquidityManager liquidityManager_,
    IArbitrator arbitrator_,
    address metaEvidenceGuardian_
  ) Ownable(msg.sender) {
    coverToken = coverToken_;
    liquidityManager = liquidityManager_;
    metaEvidenceGuardian = metaEvidenceGuardian_;
    arbitrator = arbitrator_;
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

  modifier onlyLiquidityManager() {
    if (msg.sender != address(liquidityManager))
      revert OnlyLiquidityManager();
    _;
  }

  modifier onlyArbitrator() {
    if (msg.sender != address(arbitrator)) revert OnlyArbitrator();
    _;
  }

  /**
   * @notice
   * Check caller is owner of the cover holder NFT
   * @param coverId_ cover holder NFT ID
   */
  modifier onlyCoverOwner(uint256 coverId_) {
    if (msg.sender != coverToken.ownerOf(coverId_))
      revert OnlyCoverOwner();
    _;
  }

  // ======= VIEWS ======= //

  function getCoverIdToClaimIds(
    uint256 coverId
  ) external view returns (uint256[] memory) {
    return coverIdToClaimIds[coverId];
  }

  function getPoolCoverTerms(
    uint128 poolId
  ) external view returns (string memory) {
    return poolIdToCoverTerms[poolId];
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
  function remainingTimeToChallenge(
    uint256 claimId_
  ) external view returns (uint256) {
    Claim memory userClaim = claims[claimId_];

    // If the claim is not in the Initiated state it cannot be challenged
    if (userClaim.status != ClaimStatus.Initiated) return 0;
    else if (userClaim.createdAt + challengeDelay < block.timestamp)
      return 0;
    else
      return (userClaim.createdAt + challengeDelay) - block.timestamp;
  }

  // /**
  //  * @notice
  //  * Get all or a range of exiting claims.
  //  * @dev The range is inclusive of the beginIndex and exclusive of the endIndex.
  //  * @param beginIndex The index of the first claim to return
  //  * @param endIndex The index of the claim at which to stop
  //  * @return claimsInfo All the claims in the specified range
  //  */
  // function linearClaimsView(
  //   uint256 beginIndex,
  //   uint256 endIndex
  // ) external view returns (ClaimView[] memory claimsInfo) {
  //   if (nextClaimId < endIndex) revert OutOfRange();
  //   if (endIndex <= beginIndex) revert BadRange();

  //   claimsInfo = new ClaimView[](endIndex - beginIndex);

  //   uint256 positionCounter;
  //   for (uint256 i = beginIndex; i < endIndex; i++) {
  //     Claim memory claim = claims[i];

  //     claimsInfo[positionCounter] = claim;

  //     // Fill the empty claimId with the item index
  //     claimsInfo[positionCounter].claimId = i;

  //     // We should check if the claim is available for compensation
  //     if (
  //       claim.status == ClaimStatus.Initiated &&
  //       claim.createdAt + challengeDelay < block.timestamp
  //     ) {
  //       claimsInfo[positionCounter].status = ClaimStatus.Accepted;
  //     }
  //     positionCounter++;
  //   }
  // }

  function claimIdsByCoverId(
    uint256 coverId_
  ) external view returns (uint256[] memory claimIds) {
    claimIds = coverIdToClaimIds[coverId_];
  }

  function latestCoverClaimId(
    uint256 coverId_
  ) public view returns (uint256) {
    uint256 nbClaims = coverIdToClaimIds[coverId_].length;
    return coverIdToClaimIds[coverId_][nbClaims - 1];
  }

  function claimsByCoverId(
    uint256 coverId_
  ) public view returns (Claim[] memory claimsInfo) {
    uint256 nbClaims = coverIdToClaimIds[coverId_].length;

    claimsInfo = new Claim[](nbClaims);

    for (uint256 i = 0; i < nbClaims; i++) {
      uint256 claimId = coverIdToClaimIds[coverId_][i];
      claimsInfo[i] = claims[claimId];
    }
  }

  function claimsByMultiCoverIds(
    uint256[] calldata coverIds_
  ) external view returns (Claim[][] memory claimsInfoArray) {
    uint256 nbCovers = coverIds_.length;

    claimsInfoArray = new Claim[][](nbCovers);

    for (uint256 i = 0; i < nbCovers; i++) {
      claimsInfoArray[i] = claimsByCoverId(coverIds_[i]);
    }
  }

  // /**
  //  * @notice
  //  * Returns all the claims of a user.
  //  * @param account_ The user's address
  //  * @return claimsInfo All the user's claims
  //  */
  // function claimsByAccount(
  //   address account_
  // ) external view returns (Claim[] memory claimsInfo) {
  //   uint256 nbClaims = 0;
  //   for (uint256 i = 0; i < nextClaimId; i++) {
  //     if (claims[i].from == account_) nbClaims++;
  //   }

  //   claimsInfo = new Claim[](nbClaims);

  //   uint256 positionCounter;
  //   for (uint256 i = 0; i < nextClaimId; i++) {
  //     Claim memory claim = claims[i];

  //     if (claim.from == account_) {
  //       claimsInfo[positionCounter] = claim;

  //       // Fill the empty claimId with the item index
  //       claimsInfo[positionCounter].claimId = i;

  //       // We should check if the claim is available for compensation
  //       if (
  //         claim.status == ClaimStatus.Initiated &&
  //         claim.createdAt + challengeDelay < block.timestamp
  //       ) {
  //         claimsInfo[positionCounter].status = ClaimStatus.Accepted;
  //       }

  //       positionCounter++;
  //     }
  //   }
  // }

  // /**
  //  * @notice
  //  * Returns all the claims of a protocol.
  //  * @param poolId_ The protocol's address
  //  * @return claimsInfo All the protocol's claims
  //  */
  // function claimsByProtocol(
  //   uint128 poolId_
  // ) external view returns (Claim[] memory claimsInfo) {
  //   uint256 nbClaims = 0;
  //   for (uint256 i = 0; i < nextClaimId; i++) {
  //     if (claims[i].poolId == poolId_) nbClaims++;
  //   }

  //   claimsInfo = new Claim[](nbClaims);

  //   uint256 positionCounter;

  //   for (uint256 i = 0; i < nextClaimId; i++) {
  //     Claim memory claim = claims[i];

  //     if (claim.poolId == poolId_) {
  //       claimsInfo[positionCounter] = claim;

  //       // Fill the empty claimId with the item index
  //       claimsInfo[positionCounter].claimId = i;

  //       // We should check if the claim is available for compensation
  //       if (
  //         claim.status == ClaimStatus.Initiated &&
  //         claim.createdAt + challengeDelay < block.timestamp
  //       ) {
  //         claimsInfo[positionCounter].status = ClaimStatus.Accepted;
  //       }

  //       positionCounter++;
  //     }
  //   }
  // }

  function getClaimEvidence(
    uint256 claimId_
  ) external view returns (string[] memory) {
    return claimIdToEvidence[claimId_];
  }

  function getClaimCounterEvidence(
    uint256 claimId_
  ) external view returns (string[] memory) {
    return claimIdToCounterEvidence[claimId_];
  }

  // ======= HELPERS ======= //

  /**
   * @notice
   * Sends value to an address.
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
   * Add or update the document associated to the pool's insurance terms.
   * @param poolId_ The new pool ID
   * @param ipfsAgreementCid_ The IPFS CID of the meta evidence
   */
  function addCoverTermsForPool(
    uint128 poolId_,
    string calldata ipfsAgreementCid_
  ) external onlyLiquidityManager {
    poolIdToCoverTerms[poolId_] = ipfsAgreementCid_;
  }

  /**
   * @notice
   * Adds evidence IPFS CIDs for a claim.
   * @param claimId_ The claim ID
   * @param ipfsEvidenceCids_ The IPFS CIDs of the evidence
   */
  function submitEvidenceForClaim(
    uint256 claimId_,
    string[] calldata ipfsEvidenceCids_
  ) external {
    Claim storage userClaim = claims[claimId_];

    if (
      userClaim.status != ClaimStatus.Initiated &&
      userClaim.status != ClaimStatus.Disputed
    ) revert WrongClaimStatus();

    bool isClaimant = msg.sender ==
      coverToken.ownerOf(userClaim.coverId);

    if (
      !isClaimant &&
      msg.sender != userClaim.challenger &&
      msg.sender != metaEvidenceGuardian
    ) revert InvalidParty();

    string[] storage evidence = isClaimant
      ? claimIdToEvidence[claimId_]
      : claimIdToCounterEvidence[claimId_];

    for (uint256 i = 0; i < ipfsEvidenceCids_.length; i++) {
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
    string calldata ipfsMetaEvidenceCid_,
    bytes calldata signature_
  ) external payable onlyCoverOwner(coverId_) {
    // Verify authenticity of the IPFS meta-evidence CID
    if (
      recoverSigner(ipfsMetaEvidenceCid_, signature_) !=
      metaEvidenceGuardian
    ) revert InvalidMetaEvidence();
    if (amountClaimed_ == 0) revert CannotClaimZero();

    // Register the claim to prevent exit from the pool untill resolution
    liquidityManager.addClaimToPool(coverId_);

    // Check that the user has deposited the capital necessary for arbitration and collateral
    uint256 costOfArbitration = arbitrationCost();
    if (msg.value < costOfArbitration + collateralAmount)
      revert NotEnoughEthForClaim();

    // Check if there already an ongoing claim related to this cover
    if (0 < coverIdToClaimIds[coverId_].length) {
      uint256 latestClaimIdOfCover = latestCoverClaimId(coverId_);
      // Only allow for a new claim if it is not initiated or disputed
      // @dev a cover can lead to multiple claims but if the total claimed amount exceeds their coverage amount then the claim may be disputed
      Claim storage userClaim = claims[latestClaimIdOfCover];
      if (
        userClaim.status == ClaimStatus.Initiated ||
        userClaim.status == ClaimStatus.Disputed
      ) revert PreviousClaimStillOngoing();
    }

    // Save latest claim ID of cover and update claim index
    uint256 claimId = nextClaimId;
    nextClaimId++;
    coverIdToClaimIds[coverId_].push(claimId);

    // Save claim data
    Claim storage claim = claims[claimId];
    claim.coverId = coverId_;
    claim.amount = amountClaimed_;
    claim.createdAt = block.timestamp;
    claim.arbitrationCost = costOfArbitration;

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
  function disputeClaim(uint256 claimId_) external payable {
    Claim storage userClaim = claims[claimId_];

    // Check the claim is in the appropriate status and challenge is within delay
    if (
      userClaim.status != ClaimStatus.Initiated ||
      userClaim.createdAt + challengeDelay <= block.timestamp
    ) revert ClaimNotChallengeable();

    // Check the claim is not already disputed
    if (userClaim.challenger != address(0))
      revert ClaimAlreadyChallenged();

    // Check that the challenger has deposited enough capital for dispute creation
    uint256 costOfArbitration = userClaim.arbitrationCost;
    if (msg.value < costOfArbitration)
      revert MustMatchClaimantDeposit();

    // Create the claim and obtain the Kleros dispute ID
    // @bw this is bad, need subcourt id + check cost of arbitration in court
    uint256 disputeId = arbitrator.createDispute{
      value: costOfArbitration
    }(2, "");

    // Update the claim with challenged status and challenger address
    userClaim.status = ClaimStatus.Disputed;
    userClaim.challenger = msg.sender;
    userClaim.disputeId = disputeId;

    // Map the new dispute ID to be able to search it after ruling
    disputeIdToClaimId[disputeId] = claimId_;

    // Emit Kleros event for dispute creation and meta-evidence association
    emit Dispute(arbitrator, disputeId, claimId_, claimId_);
  }

  // ======= RESOLUTION ======= //

  /**
   * @notice
   * Give a ruling for a dispute. Must be called by the arbitrator.
   * @param disputeId_ ID of the dispute in the Arbitrator contract.
   * @param ruling_ Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
   */
  function rule(
    uint256 disputeId_,
    uint256 ruling_
  ) external onlyArbitrator {
    uint256 claimId = disputeIdToClaimId[disputeId_];
    Claim storage userClaim = claims[claimId];

    // Check the status of the claim
    if (userClaim.status != ClaimStatus.Disputed)
      revert ClaimNotInDispute();

    if (numberOfRulingOptions < ruling_) revert InvalidRuling();

    // Manage ETH for claim creation, claim collateral and dispute creation
    if (ruling_ == uint256(RulingOptions.CompensateClaimant)) {
      userClaim.status = ClaimStatus.AcceptedWithDispute;

      // Send back the collateral and arbitration cost to the claimant
      address claimant = userClaim.challenger;
      _sendValue(
        claimant,
        userClaim.arbitrationCost + collateralAmount
      );
    } else if (ruling_ == uint256(RulingOptions.RejectClaim)) {
      userClaim.status = ClaimStatus.RejectedWithDispute;

      address challenger = userClaim.challenger;
      // Refund arbitration cost to the challenger and pay them with collateral
      _sendValue(
        challenger,
        userClaim.arbitrationCost + collateralAmount
      );
    } else {
      // This is the case where the arbitrator refuses to rule
      userClaim.status = ClaimStatus.RejectedWithDispute;

      /// @dev we remove 1 wei from the arbitration cost to avoid a rounding errors
      uint256 halfArbitrationCost = (userClaim.arbitrationCost / 2) -
        1;

      address claimant = userClaim.challenger;
      address challenger = userClaim.challenger;

      // Send back the collateral and half the arbitration cost to the claimant
      _sendValue(claimant, halfArbitrationCost + collateralAmount);
      // Send back half the arbitration cost to the challenger
      _sendValue(challenger, halfArbitrationCost);
    }

    // Remove claims from pool to unblock withdrawals
    liquidityManager.removeClaimFromPool(userClaim.coverId);

    emit DisputeResolved({
      claimId: claimId,
      disputeId: disputeId_,
      ruling: ruling_
    });
  }

  /**
   * @notice
   * Allows a cover holder to execute the claim if it has remained unchallenged.
   * @param claimId_ The claim ID
   *
   * @dev Intentionally public to prevent claimant from indefinitely blocking withdrawals
   * from a pool by not executing the claims ruling.
   */
  function withdrawCompensationWithoutDispute(
    uint256 claimId_
  ) external {
    Claim storage userClaim = claims[claimId_];

    // Check the claim is in the appropriate status
    if (userClaim.status != ClaimStatus.Initiated)
      revert WrongClaimStatus();

    // Check the claim has passed the disputable delay
    if (block.timestamp < userClaim.createdAt + challengeDelay)
      revert DelayNotElapsed();

    // Update claim status
    userClaim.status = ClaimStatus.CompensatedAfterAcceptation;

    // Send back the collateral and arbitration cost to the claimant
    _sendValue(
      coverToken.ownerOf(userClaim.coverId),
      userClaim.arbitrationCost + collateralAmount
    );

    // Remove claims from pool to unblock withdrawals
    liquidityManager.removeClaimFromPool(userClaim.coverId);

    // Call Athena core to pay the compensation
    liquidityManager.payoutClaim(userClaim.coverId, userClaim.amount);
  }

  /**
   * @notice
   * Allows the claimant to withdraw the compensation after a dispute has been resolved in their favor.
   * @param claimId_ The claim ID
   */
  function releaseCompensationAfterDispute(
    uint256 claimId_
  ) external {
    Claim storage userClaim = claims[claimId_];

    // Check the status of the claim
    if (userClaim.status != ClaimStatus.AcceptedWithDispute)
      revert WrongClaimStatus();

    // Update claim status
    userClaim.status = ClaimStatus.CompensatedAfterAcceptation;

    // Call Athena core to pay the compensation
    liquidityManager.payoutClaim(userClaim.coverId, userClaim.amount);
  }

  // ======= ADMIN ======= //

  /**
   * @notice
   * Changes the amount of collateral required when opening a claim.
   * @dev The collateral is paid to the challenger if the claim is disputed and rejected.
   * @param amount_ The new amount of collateral.
   */
  function changeRequiredCollateral(
    uint256 amount_
  ) external onlyOwner {
    collateralAmount = amount_;
  }

  function changeChallengeDelay(
    uint256 duration_
  ) external onlyOwner {
    challengeDelay = duration_;
  }

  function changeMetaEvidenceGuardian(
    address metaEvidenceGuardian_
  ) external onlyOwner {
    if (metaEvidenceGuardian_ == address(0))
      revert GuardianSetToAddressZero();

    metaEvidenceGuardian = metaEvidenceGuardian_;
  }
}
