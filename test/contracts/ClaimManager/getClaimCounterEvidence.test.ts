import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_getClaimCounterEvidence() {
  context("getClaimCounterEvidence", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the claim does not exist", async function () {
      // Attempt to retrieve counter-evidence for a non-existent claim
      expect(
        await this.contract.getClaimCounterEvidence(
          this.args.nonExistentClaimId,
        ),
      ).to.be.revertedWith("ClaimDoesNotExist"); // Use the actual error message
    });

    it("should return an empty array for a claim with no counter-evidence", async function () {
      // Retrieve counter-evidence for a claim with no counter-evidence submitted
      const counterEvidence = await this.contract.getClaimCounterEvidence(
        this.args.claimIdWithNoCounterEvidence,
      );

      // Check if the returned array is empty
      expect(counterEvidence).to.be.empty;
    });

    it("should return all counter-evidence submitted for a claim", async function () {
      // Retrieve counter-evidence for a claim with counter-evidence submitted
      const counterEvidence = await this.contract.getClaimCounterEvidence(
        this.args.claimIdWithCounterEvidence,
      );

      // Check if the returned array matches the expected counter-evidence
      expect(counterEvidence).to.deep.equal(this.args.expectedCounterEvidence);
    });
  });
}
