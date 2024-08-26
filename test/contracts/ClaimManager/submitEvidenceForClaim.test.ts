import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function ClaimManager_submitEvidenceForClaim() {
  context("submitEvidenceForClaim", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if claim status is not 'Initiated' or 'Disputed'", async function (this: Arguments) {
      // Check revert when claim status is neither 'Initiated' nor 'Disputed'
      expect(
        await this.contract.submitEvidenceForClaim(
          this.args.nonInitiatedClaimId,
          this.args.evidenceCids,
        ),
      ).to.be.revertedWith("WrongClaimStatus");
    });

    it("should allow claimant to submit evidence for an 'Initiated' claim", async function (this: Arguments) {
      // Check successful evidence submission by claimant for an 'Initiated' claim
      expect(
        await this.contract.submitEvidenceForClaim(
          this.args.initiatedClaimId,
          this.args.evidenceCids,
          { from: this.signers.claimant },
        ),
      ).to.not.throw;
    });

    it("should allow claimant to submit evidence for a 'Disputed' claim", async function (this: Arguments) {
      // Check successful evidence submission by claimant for a 'Disputed' claim
      expect(
        await this.contract.submitEvidenceForClaim(
          this.args.disputedClaimId,
          this.args.evidenceCids,
          { from: this.signers.claimant },
        ),
      ).to.not.throw;
    });

    it("should allow prosecutor to submit evidence for an 'Initiated' claim", async function (this: Arguments) {
      // Check successful evidence submission by prosecutor for an 'Initiated' claim
      expect(
        await this.contract.submitEvidenceForClaim(
          this.args.initiatedClaimId,
          this.args.evidenceCids,
          { from: this.signers.prosecutor },
        ),
      ).to.not.throw;
    });

    it("should allow prosecutor to submit evidence for a 'Disputed' claim", async function (this: Arguments) {
      // Check successful evidence submission by prosecutor for a 'Disputed' claim
      expect(
        await this.contract.submitEvidenceForClaim(
          this.args.disputedClaimId,
          this.args.evidenceCids,
          { from: this.signers.prosecutor },
        ),
      ).to.not.throw;
    });

    it("should allow metaEvidenceGuardian to submit evidence", async function (this: Arguments) {
      // Check successful evidence submission by metaEvidenceGuardian
      expect(
        await this.contract.submitEvidenceForClaim(
          this.args.claimId,
          this.args.evidenceCids,
          { from: this.signers.metaEvidenceGuardian },
        ),
      ).to.not.throw;
    });

    it("should revert if a non-involved party tries to submit evidence", async function (this: Arguments) {
      // Check revert when an unrelated party attempts to submit evidence
      expect(
        await this.contract.submitEvidenceForClaim(
          this.args.claimId,
          this.args.evidenceCids,
          { from: this.signers.unrelatedParty },
        ),
      ).to.be.revertedWith("InvalidParty");
    });

    it("should append submitted evidence to the claim's evidence array for claimant", async function (this: Arguments) {
      // Submit evidence and check if it is correctly appended to the claimant's evidence array
      await this.contract.submitEvidenceForClaim(
        this.args.claimId,
        this.args.evidenceCids,
        { from: this.signers.claimant },
      );
      const evidenceArray = await this.contract.getClaimEvidenceArray(
        this.args.claimId,
      ); // Replace with actual function
      expect(evidenceArray).to.include.members(this.args.evidenceCids);
    });

    it("should append submitted evidence to the claim's counter-evidence array for prosecutor", async function (this: Arguments) {
      // Submit evidence and check if it is correctly appended to the prosecutor's counter-evidence array
      await this.contract.submitEvidenceForClaim(
        this.args.claimId,
        this.args.evidenceCids,
        { from: this.signers.prosecutor },
      );
      const counterEvidenceArray =
        await this.contract.getClaimCounterEvidenceArray(this.args.claimId); // Replace with actual function
      expect(counterEvidenceArray).to.include.members(this.args.evidenceCids);
    });

    it("should emit an Evidence event for each submitted evidence CID", async function (this: Arguments) {
      // Submit evidence and check for emitted Evidence events
      const tx = await this.contract.submitEvidenceForClaim(
        this.args.claimId,
        this.args.evidenceCids,
        { from: this.signers.claimant },
      );
      const receipt = await tx.wait();
      for (let cid of this.args.evidenceCids) {
        expect(receipt.events).to.deep.include({
          event: "Evidence",
          args: [
            this.contract.address,
            this.args.claimId,
            this.signers.claimant.address,
            cid,
          ],
        });
      }
    });
  });
}
