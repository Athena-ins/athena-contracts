import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function ClaimManager_rule() {
  context("rule", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if called by a non-arbitrator", async function (this: Arguments) {
      // Attempt to rule on a dispute as a non-arbitrator
      expect(
        await this.contract.rule(this.args.disputeId, this.args.ruling, {
          from: this.signers.nonArbitrator,
        }),
      ).to.be.revertedWith("OnlyArbitrator");
    });

    it("should revert if the claim is not in dispute", async function (this: Arguments) {
      // Attempt to rule on a claim that is not in dispute
      expect(
        await this.contract.rule(
          this.args.nonDisputedClaimDisputeId,
          this.args.ruling,
        ),
      ).to.be.revertedWith("ClaimNotInDispute");
    });

    it("should revert if the ruling is invalid", async function (this: Arguments) {
      // Attempt to rule with an invalid ruling number
      expect(
        await this.contract.rule(
          this.args.validDisputeId,
          this.args.invalidRuling,
        ),
      ).to.be.revertedWith("InvalidRuling");
    });

    it("should correctly rule in favor of the claimant", async function (this: Arguments) {
      // Rule in favor of the claimant and check claim status and other side effects
      await this.contract.rule(
        this.args.validDisputeId,
        this.args.rulingInFavorOfClaimant,
      );

      const updatedClaim = await this.contract.claims(this.args.claimId);
      expect(updatedClaim.status).to.equal(ClaimStatus.AcceptedByCourtDecision);
      // Check for other side effects such as timestamp updates, etc.
    });

    it("should correctly rule in favor of the challenger", async function (this: Arguments) {
      // Rule in favor of the challenger and check claim status, refunds, and other side effects
      await this.contract.rule(
        this.args.validDisputeId,
        this.args.rulingInFavorOfChallenger,
      );

      const updatedClaim = await this.contract.claims(this.args.claimId);
      expect(updatedClaim.status).to.equal(ClaimStatus.RejectedByCourtDecision);
      // Check for refund to the challenger and other side effects
    });

    it("should handle the case where the arbitrator refuses to rule", async function (this: Arguments) {
      // Rule with refusal to arbitrate and check claim status, refunds, and other side effects
      await this.contract.rule(
        this.args.validDisputeId,
        this.args.rulingRefusalToArbitrate,
      );

      const updatedClaim = await this.contract.claims(this.args.claimId);
      expect(updatedClaim.status).to.equal(
        ClaimStatus.RejectedByRefusalToArbitrate,
      );
      // Check for refunds to both parties and other side effects
    });

    it("should emit a DisputeResolved event with correct parameters", async function (this: Arguments) {
      // Rule on a dispute and check for the DisputeResolved event emission
      const tx = await this.contract.rule(
        this.args.validDisputeId,
        this.args.ruling,
      );
      const receipt = await tx.wait();

      const disputeResolvedEvent = receipt.events.find(
        (event) => event.event === "DisputeResolved",
      );
      expect(disputeResolvedEvent.args).to.deep.equal({
        claimId: this.args.claimId,
        disputeId: this.args.validDisputeId,
        ruling: this.args.ruling,
      });
    });

    it("should remove the claim from the pool after a ruling", async function (this: Arguments) {
      // Rule on a dispute and check if the claim is removed from the pool
      await this.contract.rule(this.args.validDisputeId, this.args.ruling);

      // Check if the claim is removed from the pool (This may require additional logic based on how claims are tracked within the pool)
    });
  });
}
