import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function ClaimManager_getCoverIdToClaimIds() {
  context("getCoverIdToClaimIds", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if the cover does not exist", async function (this: Arguments) {
      // Attempt to retrieve claim IDs for a non-existent cover
      expect(
        await this.contract.getCoverIdToClaimIds(this.args.nonExistentCoverId),
      ).to.be.revertedWith("CoverDoesNotExist"); // Use the actual error message
    });

    it("should return an empty array for a cover with no associated claims", async function (this: Arguments) {
      // Retrieve claim IDs for a cover with no associated claims
      const claimIds = await this.contract.getCoverIdToClaimIds(
        this.args.coverIdWithNoClaims,
      );

      // Check if the returned array is empty
      expect(claimIds).to.be.empty;
    });

    it("should return all claim IDs associated with a given cover", async function (this: Arguments) {
      // Retrieve claim IDs for a cover with associated claims
      const claimIds = await this.contract.getCoverIdToClaimIds(
        this.args.coverIdWithClaims,
      );

      // Check if the returned array matches the expected claim IDs
      expect(claimIds).to.deep.equal(this.args.expectedClaimIdsForCover);
    });
  });
}
