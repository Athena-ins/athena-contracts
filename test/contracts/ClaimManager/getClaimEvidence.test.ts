import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_getClaimEvidence() {
  context("getClaimEvidence", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the claim does not exist", async function () {
      // Attempt to retrieve evidence for a non-existent claim
      await expect(
        this.contract.getClaimEvidence(this.args.nonExistentClaimId),
      ).to.be.revertedWith("ClaimDoesNotExist"); // Use the actual error message
    });

    it("should return an empty array for a claim with no evidence", async function () {
      // Retrieve evidence for a claim with no evidence submitted
      const evidence = await this.contract.getClaimEvidence(
        this.args.claimIdWithNoEvidence,
      );

      // Check if the returned array is empty
      expect(evidence).to.be.empty;
    });

    it("should return all evidence submitted for a claim", async function () {
      // Retrieve evidence for a claim with evidence submitted
      const evidence = await this.contract.getClaimEvidence(
        this.args.claimIdWithEvidence,
      );

      // Check if the returned array matches the expected evidence
      expect(evidence).to.deep.equal(this.args.expectedEvidence);
    });
  });
}
