import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_getPoolCoverTerms() {
  context("getPoolCoverTerms", function () {
    before(async function () {
      this.args = {};
    });

    it("should return an empty string if the pool does not exist", async function () {
      // Attempt to retrieve cover terms for a non-existent pool
      const coverTerms = await this.contract.getPoolCoverTerms(
        this.args.poolIdWithNoCoverTerms,
      );

      // Check if the returned string is empty
      expect(coverTerms).to.equal("");
    });

    it("should return an empty string for a pool with no cover terms set", async function () {
      // Retrieve cover terms for a pool with no cover terms set
      const coverTerms = await this.contract.getPoolCoverTerms(
        this.args.poolIdWithNoCoverTerms,
      );

      // Check if the returned string is empty
      expect(coverTerms).to.equal("");
    });

    it("should return the correct URI of the cover terms for a pool", async function () {
      // Retrieve cover terms for a pool with cover terms set
      const coverTerms = await this.contract.getPoolCoverTerms(
        this.args.poolIdWithCoverTerms,
      );

      // Check if the returned URI matches the expected cover terms URI
      expect(coverTerms).to.equal(this.args.expectedCoverTermsUri);
    });
  });
}
