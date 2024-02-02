import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_latestCoverClaimId() {
  context("latestCoverClaimId", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the cover does not exist", async function () {
      // Attempt to retrieve the latest claim ID for a non-existent cover
      await expect(
        this.contract.latestCoverClaimId(this.args.nonExistentCoverId),
      ).to.be.revertedWith("CoverDoesNotExist"); // Use the actual error message
    });

    it("should revert if there are no claims associated with the cover", async function () {
      // Attempt to retrieve the latest claim ID for a cover with no claims
      await expect(
        this.contract.latestCoverClaimId(this.args.coverIdWithNoClaims),
      ).to.be.revertedWith("NoClaimsForCover"); // Use the actual error message if checking for empty claims array
    });

    it("should return the latest claim ID for a cover with associated claims", async function () {
      // Retrieve the latest claim ID for a cover with associated claims
      const latestClaimId = await this.contract.latestCoverClaimId(
        this.args.coverIdWithClaims,
      );

      // Check if the returned claim ID matches the expected latest claim ID
      expect(latestClaimId).to.equal(this.args.expectedLatestClaimId);
    });
  });
}
