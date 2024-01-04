// SPDX-License-Identifier: UNLICENCED
pragma solidity 0.8.20;

// Contracts
import { ClaimEvidence } from "./modules/ClaimEvidence.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Libraries
import { VerifySignature } from "../libs/VerifySignature.sol";

// Interfaces
import { IArbitrable } from "../interfaces/IArbitrable.sol";
import { IArbitrator } from "../interfaces/IArbitrator.sol";
import { IClaimManager } from "../interfaces/IClaimManager.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";

// ======= ERRORS ======= //

contract ClaimManager is
  IClaimManager,
  VerifySignature,
  Ownable,
  ClaimEvidence,
  IArbitrable
{
  IAthenaCoverToken public coverToken;
  ILiquidityManager public liquidityManager;

  address public metaEvidenceGuardian;
  uint256 public challengeDelay = 14 days;
  uint256 public nextClaimId;
  uint256 public collateralAmount = 0.01 ether;

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
  uint256 public immutable numberOfRulingOptions = 2;

  // @dev claimId is set to 0 to minimize gas cost but filled in view functions
  struct Claim {
    uint256 claimId;
    ClaimStatus status;
    uint256 createdAt;
    address from;
    uint256 amount;
    uint256 coverId;
    uint128 poolId;
    string metaEvidence;
    //
    uint256 disputeId;
    address challenger;
    uint256 arbitrationCost;
  }

  // Maps a claim ID to a claim's data
  mapping(uint256 => Claim) public claims;
  // Maps a coverId to its claim IDs
  mapping(uint256 => uint256[]) public coverIdToClaimIds;
  // Maps a Kleros dispute ID to its claim ID
  mapping(uint256 => uint256) public disputeIdToClaimId;

  constructor(
    IAthenaCoverToken coverToken_,
    ILiquidityManager liquidityManager_,
    IArbitrator arbitrator_,
    address metaEvidenceGuardian_
  ) ClaimEvidence(arbitrator_) Ownable(msg.sender) {
    coverToken = coverToken_;
    liquidityManager = liquidityManager_;
    metaEvidenceGuardian = metaEvidenceGuardian_;
  }

  // @bw need to set args for Kleros arbitrator (pass sub court ID in args, min amount of jurors, etc)
  // https://docs.kleros.io/integrations/types-of-integrations/1.-dispute-resolution-integration-plan/smart-contract-integration
  // https://etherscan.io/address/0x988b3a538b618c7a603e1c11ab82cd16dbe28069#code

  // @bw need to add veto power for V0

  /// ========================= ///
  /// ========= EVENTS ======== ///
  /// ========================= ///

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

  /// ============================ ///
  /// ========= MODIFIERS ======== ///
  /// ============================ ///

  modifier onlyLiquidityManager() {
    require(msg.sender == address(liquidityManager), "CM: only core");
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
    address ownerOfToken = coverToken.ownerOf(policyId_);
    require(msg.sender == ownerOfToken, "CM: not policy owner");
    _;
  }

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

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
   * Returns the claimant of a claim.
   * @param claimId_ The claim ID
   * @return _ the claimant's address
   */
  function claimInitiator(
    uint256 claimId_
  ) external view returns (address) {
    return claims[claimId_].from;
  }

  /**
   * @notice
   * Returns the challenger of a claim.
   * @param claimId_ The claim ID
   * @return _ the challenger's address
   */
  function claimChallenger(
    uint256 claimId_
  ) external view returns (address) {
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

  /**
   * @notice
   * Get all or a range of exiting claims.
   * @dev The range is inclusive of the beginIndex and exclusive of the endIndex.
   * @param beginIndex The index of the first claim to return
   * @param endIndex The index of the claim at which to stop
   * @return claimsInfo All the claims in the specified range
   */
  function linearClaimsView(
    uint256 beginIndex,
    uint256 endIndex
  ) external view returns (Claim[] memory claimsInfo) {
    require(endIndex <= nextClaimId, "CM: outside of range");
    require(beginIndex < endIndex, "CM: bad range");

    claimsInfo = new Claim[](endIndex - beginIndex);

    uint256 positionCounter;
    for (uint256 i = beginIndex; i < endIndex; i++) {
      Claim memory claim = claims[i];

      claimsInfo[positionCounter] = claim;

      // Fill the empty claimId with the item index
      claimsInfo[positionCounter].claimId = i;

      // We should check if the claim is available for compensation
      if (
        claim.status == ClaimStatus.Initiated &&
        claim.createdAt + challengeDelay < block.timestamp
      ) {
        claimsInfo[positionCounter].status = ClaimStatus.Accepted;
      }
      positionCounter++;
    }
  }

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

  /**
   * @notice
   * Returns all the claims of a user.
   * @param account_ The user's address
   * @return claimsInfo All the user's claims
   */
  function claimsByAccount(
    address account_
  ) external view returns (Claim[] memory claimsInfo) {
    uint256 nbClaims = 0;
    for (uint256 i = 0; i < nextClaimId; i++) {
      if (claims[i].from == account_) nbClaims++;
    }

    claimsInfo = new Claim[](nbClaims);

    uint256 positionCounter;
    for (uint256 i = 0; i < nextClaimId; i++) {
      Claim memory claim = claims[i];

      if (claim.from == account_) {
        claimsInfo[positionCounter] = claim;

        // Fill the empty claimId with the item index
        claimsInfo[positionCounter].claimId = i;

        // We should check if the claim is available for compensation
        if (
          claim.status == ClaimStatus.Initiated &&
          claim.createdAt + challengeDelay < block.timestamp
        ) {
          claimsInfo[positionCounter].status = ClaimStatus.Accepted;
        }

        positionCounter++;
      }
    }
  }

  /**
   * @notice
   * Returns all the claims of a protocol.
   * @param poolId_ The protocol's address
   * @return claimsInfo All the protocol's claims
   */
  function claimsByProtocol(
    uint128 poolId_
  ) external view returns (Claim[] memory claimsInfo) {
    uint256 nbClaims = 0;
    for (uint256 i = 0; i < nextClaimId; i++) {
      if (claims[i].poolId == poolId_) nbClaims++;
    }

    claimsInfo = new Claim[](nbClaims);

    uint256 positionCounter;

    for (uint256 i = 0; i < nextClaimId; i++) {
      Claim memory claim = claims[i];

      if (claim.poolId == poolId_) {
        claimsInfo[positionCounter] = claim;

        // Fill the empty claimId with the item index
        claimsInfo[positionCounter].claimId = i;

        // We should check if the claim is available for compensation
        if (
          claim.status == ClaimStatus.Initiated &&
          claim.createdAt + challengeDelay < block.timestamp
        ) {
          claimsInfo[positionCounter].status = ClaimStatus.Accepted;
        }

        positionCounter++;
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
  function _sendValue(
    address to_,
    uint256 value_
  ) private returns (bool /* success */, bytes memory /* data */) {
    // We purposefully ignore return value to avoid malicious contracts to block the execution
    // The 4600 gas limit should be enough to avoid future OPCODE gas cost changes
    return payable(to_).call{ value: value_, gas: 4600 }("");
  }

  /// ============================== ///
  /// ========== EVIDENCE ========== ///
  /// ============================== ///

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
    _addCoverTermsForPool(poolId_, ipfsAgreementCid_);
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

    require(
      userClaim.status == ClaimStatus.Disputed ||
        userClaim.status == ClaimStatus.Initiated,
      "CM: wrong claim status"
    );

    bool isClaimant = msg.sender == userClaim.from;
    address challenger = userClaim.challenger;
    require(
      isClaimant ||
        msg.sender == challenger ||
        msg.sender == metaEvidenceGuardian,
      "CM: invalid party"
    );

    _submitKlerosEvidence(
      claimId_,
      msg.sender,
      isClaimant,
      ipfsEvidenceCids_
    );
  }

  /// ============================ ///
  /// ========== CLAIMS ========== ///
  /// ============================ ///

  // @bw @dev TODO : should lock the capital in protocol pool
  /**
   * @notice
   * Initiates a payment claim to Kleros by a policy holder.
   * @param policyId_ The policy ID
   * @param amountClaimed_ The amount claimed by the policy holder
   * @param ipfsMetaEvidenceCid_ The IPFS CID of the meta evidence file
   */
  function initiateClaim(
    uint256 policyId_,
    uint256 amountClaimed_,
    string calldata ipfsMetaEvidenceCid_,
    bytes calldata signature_
  ) external payable onlyPolicyTokenOwner(policyId_) {
    // Get the policy
    ILiquidityManager.Cover memory cover = liquidityManager.covers(
      policyId_
    );

    // Verify authenticity of the IPFS meta-evidence CID
    /// @dev Wrap in context to avoid stack too deep error
    {
      address metaEvidenceSigner = recoverSigner(
        ipfsMetaEvidenceCid_,
        signature_
      );
      require(
        metaEvidenceSigner == metaEvidenceGuardian,
        "CM: invalid meta-evidence"
      );
    }

    uint128 poolId = cover.poolId;

    // Register the claim to prevent exit from the pool untill resolution
    // @bw commented until fix
    // poolFactoryInterface.addClaimToPool(poolId);

    // Update the protocol's policies
    // @bw is this really required as expired policies can open claims ?
    liquidityManager.syncPool(poolId);

    // Check that the user is not trying to claim more than the amount covered
    require(
      0 < amountClaimed_ && amountClaimed_ <= cover.coverAmount,
      "CM: bad amount range"
    );

    // Check that the user has deposited the capital necessary for arbitration and collateral
    uint256 costOfArbitration = arbitrationCost();
    require(
      costOfArbitration + collateralAmount <= msg.value,
      "CM: not enough ETH for claim"
    );

    // Check if there already an ongoing claim related to this policy
    if (0 < coverIdToClaimIds[policyId_].length) {
      uint256 latestClaimIdOfPolicy = latestCoverClaimId(policyId_);
      // Only allow for a new claim if it is not initiated or disputed
      // @dev a policy can lead to multiple claims but if the total claimed amount exceeds their coverage amount then the claim may be disputed
      Claim storage userClaim = claims[latestClaimIdOfPolicy];
      require(
        userClaim.status != ClaimStatus.Initiated &&
          userClaim.status != ClaimStatus.Disputed,
        "CM: previous claim still ongoing"
      );
    }

    // Save latest claim ID of policy and update claim index
    uint256 claimId = nextClaimId;
    coverIdToClaimIds[policyId_].push(claimId);
    nextClaimId++;

    // Save claim data
    claims[claimId] = Claim({
      claimId: 0,
      status: ClaimStatus.Initiated,
      from: msg.sender,
      challenger: address(0),
      createdAt: block.timestamp,
      arbitrationCost: costOfArbitration,
      disputeId: 0,
      coverId: policyId_,
      poolId: poolId,
      amount: amountClaimed_,
      metaEvidence: ipfsMetaEvidenceCid_
    });

    // Emit Athena claim creation event
    emit ClaimCreated(msg.sender, policyId_, claimId);
    emit MetaEvidence(claimId, ipfsMetaEvidenceCid_);
  }

  /// ============================= ///
  /// ========== DISPUTE ========== ///
  /// ============================= ///

  /**
   * @notice
   * Allows a user to challenge a pending claim by creating a dispute in Kleros.
   * @param claimId_ The claim ID
   */
  function disputeClaim(uint256 claimId_) external payable {
    Claim storage userClaim = claims[claimId_];

    // Check the claim is in the appropriate status and challenge is within delay
    require(
      userClaim.status == ClaimStatus.Initiated &&
        block.timestamp < userClaim.createdAt + challengeDelay,
      "CM: claim not challengeable"
    );

    // Check the claim is not already disputed
    require(
      userClaim.challenger == address(0),
      "CM: claim already challenged"
    );

    // Check that the challenger has deposited enough capital for dispute creation
    uint256 costOfArbitration = userClaim.arbitrationCost;
    require(
      costOfArbitration <= msg.value,
      "CM: must match claimant deposit"
    );

    // Create the claim and obtain the Kleros dispute ID
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

  /// ================================ ///
  /// ========== RESOLUTION ========== ///
  /// ================================ ///

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

      // Remove claims from pool to unblock withdrawals
      // @bw commented until fix
      // poolFactoryInterface.removeClaimFromPool(userClaim.poolId);
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

      // Remove claims from pool to unblock withdrawals
      // @bw commented until fix
      // poolFactoryInterface.removeClaimFromPool(userClaim.poolId);
    }

    emit DisputeResolved({
      claimId: claimId,
      disputeId: disputeId_,
      ruling: ruling_
    });
  }

  /**
   * @notice
   * Allows a policy holder to execute the claim if it has remained unchallenged.
   * @param claimId_ The claim ID
   */
  function withdrawCompensationWithoutDispute(
    uint256 claimId_
  ) external {
    Claim storage userClaim = claims[claimId_];

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
    _sendValue(
      userClaim.from,
      userClaim.arbitrationCost + collateralAmount
    );

    // Remove claims from pool to unblock withdrawals
    // @bw commented until fix
    // poolFactoryInterface.removeClaimFromPool(userClaim.poolId);

    // Call Athena core to pay the compensation
    // @bw this should reduce the user's policy to avoid stress on the pool
    liquidityManager.payoutClaim(
      userClaim.poolId,
      userClaim.amount,
      userClaim.from
    );
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
    require(
      userClaim.status == ClaimStatus.AcceptedWithDispute,
      "CM: wrong claim status"
    );

    // Update claim status
    userClaim.status = ClaimStatus.CompensatedAfterAcceptation;

    // Remove claims from pool to unblock withdrawals
    // @bw commented until fix
    // poolFactoryInterface.removeClaimFromPool(userClaim.poolId);

    // Call Athena core to pay the compensation
    // @bw this should reduce the user's policy to avoid stress on the pool
    liquidityManager.payoutClaim(
      userClaim.poolId,
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
    require(
      metaEvidenceGuardian_ != address(0),
      "CM: guardian set to address(0)"
    );
    metaEvidenceGuardian = metaEvidenceGuardian_;
  }
}
