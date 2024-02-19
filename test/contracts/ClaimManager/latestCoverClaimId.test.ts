import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function ClaimManager_latestCoverClaimId() {
  context("latestCoverClaimId", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if the cover does not exist", async function (this: Arguments) {
      // Attempt to retrieve the latest claim ID for a non-existent cover
      expect(
        await this.contract.latestCoverClaimId(this.args.nonExistentCoverId),
      ).to.be.revertedWith("CoverDoesNotExist"); // Use the actual error message
    });

    it("should revert if there are no claims associated with the cover", async function (this: Arguments) {
      // Attempt to retrieve the latest claim ID for a cover with no claims
      expect(
        await this.contract.latestCoverClaimId(this.args.coverIdWithNoClaims),
      ).to.be.revertedWith("NoClaimsForCover"); // Use the actual error message if checking for empty claims array
    });

    it("should return the latest claim ID for a cover with associated claims", async function (this: Arguments) {
      // Retrieve the latest claim ID for a cover with associated claims
      const latestClaimId = await this.contract.latestCoverClaimId(
        this.args.coverIdWithClaims,
      );

      // Check if the returned claim ID matches the expected latest claim ID
      expect(latestClaimId).to.equal(this.args.expectedLatestClaimId);
    });
  });
}
