import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_claimIdsByCoverId() {
  context("claimIdsByCoverId", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the cover does not exist", async function () {
      // Attempt to call getCoverIdToClaimIds with a non-existent cover ID
      await expect(
        this.contract.getCoverIdToClaimIds(this.args.nonExistentCoverId),
      ).to.be.reverted; // Adjust error message as needed
    });

    it("should return an empty array for a cover with no claims", async function () {
      // Call getCoverIdToClaimIds with a coverId that has no associated claims
      const claimIds = await this.contract.getCoverIdToClaimIds(
        this.args.coverIdWithNoClaims,
      );

      // Check if the returned array is empty
      expect(claimIds).to.be.empty;
    });

    it("should return all claim IDs associated with a given cover", async function () {
      // Call getCoverIdToClaimIds with a coverId that has associated claims
      const claimIds = await this.contract.getCoverIdToClaimIds(
        this.args.coverIdWithClaims,
      );

      // Check if the returned array matches the expected claim IDs
      expect(claimIds).to.deep.equal(this.args.expectedClaimIds);
    });
  });
}
