import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function ClaimManager_overrule() {
  context("overrule", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if called by a non-owner", async function (this: Arguments) {
      // Attempt to overrule a claim as a non-owner
      expect(
        await this.contract.overrule(
          this.args.claimId,
          this.args.punishClaimant,
          {
            from: this.signers.nonOwner,
          },
        ),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert if the claim status is not 'AcceptedByCourtDecision'", async function (this: Arguments) {
      // Attempt to overrule a claim not in 'AcceptedByCourtDecision' status
      expect(
        await this.contract.overrule(
          this.args.claimIdNotAcceptedByCourt,
          this.args.punishClaimant,
        ),
      ).to.be.revertedWith("WrongClaimStatus");
    });

    it("should revert if the ruling has passed the overrule period", async function (this: Arguments) {
      // Attempt to overrule a claim after the overrule period has ended
      expect(
        await this.contract.overrule(
          this.args.claimIdAfterOverrulePeriod,
          this.args.punishClaimant,
        ),
      ).to.be.revertedWith("OverrulePeriodEnded");
    });

    it("should successfully overrule a claim and punish the claimant if specified", async function (this: Arguments) {
      // Overrule a claim with punishClaimant set to true
      await this.contract.overrule(this.args.claimId, true);

      const updatedClaim = await this.contract.claims(this.args.claimId);
      expect(updatedClaim.status).to.equal(ClaimStatus.RejectedByOverrule);
      // Check if the deposit was sent to the leverageRiskWallet
    });

    it("should successfully overrule a claim and refund the claimant if not punishing", async function (this: Arguments) {
      // Overrule a claim with punishClaimant set to false
      await this.contract.overrule(this.args.claimId, false);

      const updatedClaim = await this.contract.claims(this.args.claimId);
      expect(updatedClaim.status).to.equal(ClaimStatus.RejectedByOverrule);
      // Check if the deposit was refunded to the claimant
    });
  });
}
