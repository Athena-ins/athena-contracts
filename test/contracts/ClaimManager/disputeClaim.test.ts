import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_disputeClaim() {
  context("disputeClaim", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the claim does not exist", async function () {
      // Attempt to dispute a non-existent claim
      await expect(
        this.contract.disputeClaim(this.args.nonExistentClaimId, {
          value: this.args.disputeStake,
        }),
      ).to.be.revertedWith("ClaimDoesNotExist"); // Use the actual error message
    });

    it("should revert if the claim status is not 'Initiated'", async function () {
      // Attempt to dispute a claim not in 'Initiated' status
      await expect(
        this.contract.disputeClaim(this.args.claimIdNotInitiated, {
          value: this.args.disputeStake,
        }),
      ).to.be.revertedWith("ClaimNotChallengeable");
    });

    it("should revert if the challenge period has expired", async function () {
      // Attempt to dispute a claim after challenge period expiration
      await expect(
        this.contract.disputeClaim(this.args.expiredChallengeClaimId, {
          value: this.args.disputeStake,
        }),
      ).to.be.revertedWith("ClaimNotChallengeable");
    });

    it("should revert if the claim is already disputed", async function () {
      // Attempt to dispute an already disputed claim
      await expect(
        this.contract.disputeClaim(this.args.alreadyDisputedClaimId, {
          value: this.args.disputeStake,
        }),
      ).to.be.revertedWith("ClaimAlreadyChallenged");
    });

    it("should revert if not enough ETH is sent to cover the arbitration cost", async function () {
      // Attempt to dispute a claim with insufficient ETH for arbitration cost
      await expect(
        this.contract.disputeClaim(this.args.claimId, {
          value: this.args.insufficientStake,
        }),
      ).to.be.revertedWith("MustMatchClaimantDeposit");
    });

    it("should successfully create a dispute in Kleros", async function () {
      // Successfully create a dispute for a claim
      await expect(
        this.contract.disputeClaim(this.args.claimId, {
          value: this.args.disputeStake,
        }),
      ).to.emit(this.arbitrator, "DisputeCreation");
    });

    it("should update the claim status to 'Disputed'", async function () {
      // Dispute a claim and check if its status is updated to 'Disputed'
      await this.contract.disputeClaim(this.args.claimId, {
        value: this.args.disputeStake,
      });
      const updatedClaim = await this.contract.claims(this.args.claimId);

      expect(updatedClaim.status).to.equal(ClaimStatus.Disputed); // Use the actual enum value
    });

    it("should record the challenger's address in the claim", async function () {
      // Dispute a claim and check if the challenger's address is recorded
      await this.contract.disputeClaim(this.args.claimId, {
        value: this.args.disputeStake,
      });
      const updatedClaim = await this.contract.claims(this.args.claimId);

      expect(updatedClaim.challenger).to.equal(this.signers.challenger.address);
    });

    it("should correctly map the Kleros dispute ID to the claim ID", async function () {
      // Dispute a claim and check the mapping of Kleros dispute ID to claim ID
      await this.contract.disputeClaim(this.args.claimId, {
        value: this.args.disputeStake,
      });
      const updatedClaim = await this.contract.claims(this.args.claimId);
      const mappedClaimId = await this.contract.disputeIdToClaimId(
        updatedClaim.disputeId,
      );

      expect(mappedClaimId).to.equal(this.args.claimId);
    });

    it("should emit a 'Dispute' event with correct parameters", async function () {
      // Dispute a claim and check for the 'Dispute' event emission
      const tx = await this.contract.disputeClaim(this.args.claimId, {
        value: this.args.disputeStake,
      });
      const receipt = await tx.wait();

      const disputeEvent = receipt.events.find(
        (event) => event.event === "Dispute",
      );
      expect(disputeEvent.args).to.deep.equal([
        this.arbitrator.address,
        updatedClaim.disputeId,
        this.args.claimId,
        this.args.claimId,
      ]);
    });
  });
}
