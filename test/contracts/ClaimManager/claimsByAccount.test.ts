import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_claimsByAccount() {
  context("claimsByAccount", function () {
    before(async function () {
      this.args = {};
    });

    it("should return an empty array for a user with no covers", async function () {
      // Call claimsByAccount with an account that has no covers
      const claimsInfo = await this.contract.claimsByAccount(
        this.args.accountWithNoCovers,
      );

      // Check if the returned array is empty
      expect(claimsInfo).to.be.empty;
    });

    it("should return an empty array for a user with covers but no claims", async function () {
      // Call claimsByAccount with an account that has covers but no claims
      const claimsInfo = await this.contract.claimsByAccount(
        this.args.accountWithCoversNoClaims,
      );

      // Check if the returned array is empty
      expect(claimsInfo).to.be.empty;
    });

    it("should return all claims for a user with multiple covers and claims", async function () {
      // Call claimsByAccount with an account that has multiple covers and claims
      const claimsInfo = await this.contract.claimsByAccount(
        this.args.accountWithMultipleCoversAndClaims,
      );

      // Check if the returned array matches the expected claims
      // This will require a more complex check, depending on how you define a ClaimView and what you expect
      expect(claimsInfo).to.deep.equal(this.args.expectedClaimsInfo);
    });

    it("should correctly assemble ClaimView data for each claim", async function () {
      // Call claimsByAccount with an account that has at least one claim
      const claimsInfo = await this.contract.claimsByAccount(
        this.args.accountWithClaims,
      );

      // Check if each ClaimView in the array is correctly assembled
      // This includes checking individual fields in the ClaimView struct for correctness
      for (let claim of claimsInfo) {
        // Check each field of the claim
        // Example: expect(claim.claimant).to.equal(expectedClaimant);
        // Repeat for other fields
      }
    });
  });
}
