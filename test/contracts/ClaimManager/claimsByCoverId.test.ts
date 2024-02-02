import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_claimsByCoverId() {
  context("claimsByCoverId", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the cover does not exist", async function () {
      // Attempt to call claimsByCoverId with a non-existent cover ID
      await expect(
        this.contract.claimsByCoverId(this.args.nonExistentCoverId),
      ).to.be.revertedWith("CoverDoesNotExist"); // Use the actual error message
    });

    it("should return an empty array for a cover with no claims", async function () {
      // Call claimsByCoverId with a coverId that has no associated claims
      const claimsInfo = await this.contract.claimsByCoverId(
        this.args.coverIdWithNoClaims,
      );

      // Check if the returned array is empty
      expect(claimsInfo).to.be.empty;
    });

    it("should return all claims associated with a given cover", async function () {
      // Call claimsByCoverId with a coverId that has associated claims
      const claimsInfo = await this.contract.claimsByCoverId(
        this.args.coverIdWithClaims,
      );

      // Check if the returned array matches the expected claims data
      // This check may require further detail depending on the structure of ClaimView
      expect(claimsInfo).to.deep.equal(this.args.expectedClaimsInfo);
    });
  });
}
