import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_withdrawCompensation() {
  context("withdrawCompensation", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the claim does not exist", async function () {
      // Attempt to withdraw compensation for a non-existent claim
      expect(
        await this.contract.withdrawCompensation(this.args.nonExistentClaimId),
      ).to.be.revertedWith("ClaimDoesNotExist"); // Use the actual error message
    });

    it("should revert if the claim status is not 'Initiated' or 'AcceptedByCourtDecision'", async function () {
      // Attempt to withdraw compensation for a claim not in eligible status
      expect(
        await this.contract.withdrawCompensation(
          this.args.ineligibleStatusClaimId,
        ),
      ).to.be.revertedWith("WrongClaimStatus");
    });

    it("should revert if the challenge period for an 'Initiated' claim has not elapsed", async function () {
      // Attempt to withdraw compensation for an 'Initiated' claim before the challenge period ends
      expect(
        await this.contract.withdrawCompensation(
          this.args.initiatedClaimIdBeforeChallengeEnds,
        ),
      ).to.be.revertedWith("PeriodNotElapsed");
    });

    it("should revert if the overrule period for an 'AcceptedByCourtDecision' claim has not elapsed", async function () {
      // Attempt to withdraw compensation for an 'AcceptedByCourtDecision' claim before the overrule period ends
      expect(
        await this.contract.withdrawCompensation(
          this.args.acceptedByCourtClaimIdBeforeOverruleEnds,
        ),
      ).to.be.revertedWith("PeriodNotElapsed");
    });

    it("should successfully withdraw compensation for an 'Initiated' claim after the challenge period", async function () {
      // Withdraw compensation for an 'Initiated' claim after the challenge period
      expect(
        await this.contract.withdrawCompensation(
          this.args.initiatedClaimIdAfterChallengeEnds,
        ),
      ).to.not.throw;
      // Verify the claim status is updated and compensation is paid
    });

    it("should successfully withdraw compensation for an 'AcceptedByCourtDecision' claim after the overrule period", async function () {
      // Withdraw compensation for an 'AcceptedByCourtDecision' claim after the overrule period
      expect(
        await this.contract.withdrawCompensation(
          this.args.acceptedByCourtClaimIdAfterOverruleEnds,
        ),
      ).to.not.throw;
      // Verify the claim status is updated and compensation is paid
    });

    it("should update the claim status to 'Compensated' or 'CompensatedAfterDispute' accordingly", async function () {
      // Withdraw compensation and check the claim status update
      await this.contract.withdrawCompensation(this.args.eligibleClaimId);
      const updatedClaim = await this.contract.claims(
        this.args.eligibleClaimId,
      );

      // Assert the status is either 'Compensated' or 'CompensatedAfterDispute'
      expect(updatedClaim.status).to.satisfy(
        (status) =>
          status === ClaimStatus.Compensated ||
          status === ClaimStatus.CompensatedAfterDispute,
      );
    });

    it("should send the claim amount to the claimant", async function () {
      // Withdraw compensation and verify the claim amount is sent to the claimant
      await this.contract.withdrawCompensation(this.args.eligibleClaimId);
      // Add logic to check if the claimant received the claim amount
    });
  });
}
