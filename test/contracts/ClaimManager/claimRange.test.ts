import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function ClaimManager_claimRange() {
  context("claimRange", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if the end index is out of range", async function (this: Arguments) {
      // Attempt to retrieve claims with an end index beyond the range of existing claims
      expect(
        await this.contract.claimRange(
          this.args.validBeginIndex,
          this.args.outOfRangeEndIndex,
        ),
      ).to.be.revertedWith("OutOfRange");
    });

    it("should revert if the end index is less than or equal to the begin index", async function (this: Arguments) {
      // Attempt to retrieve claims with an end index less than or equal to the begin index
      expect(
        await this.contract.claimRange(
          this.args.beginIndex,
          this.args.beginIndex,
        ),
      ).to.be.revertedWith("BadRange");
    });

    it("should return an empty array if there are no claims within the specified range", async function (this: Arguments) {
      // Retrieve claims within a range that has no claims
      const claimsInfo = await this.contract.claimRange(
        this.args.emptyRangeBeginIndex,
        this.args.emptyRangeEndIndex,
      );

      // Check if the returned array is empty
      expect(claimsInfo).to.be.empty;
    });

    it("should return all claims within the specified range", async function (this: Arguments) {
      // Retrieve claims within a specified range
      const claimsInfo = await this.contract.claimRange(
        this.args.validBeginIndex,
        this.args.validEndIndex,
      );

      // Check if the returned array matches the expected claims data
      // This check may require further detail depending on the structure of ClaimView
      expect(claimsInfo).to.deep.equal(this.args.expectedClaimsInfoInRange);
    });

    it("should correctly populate the claims info array", async function (this: Arguments) {
      // Retrieve claims within a specified range and check the data for each claim
      const claimsInfo = await this.contract.claimRange(
        this.args.validBeginIndex,
        this.args.validEndIndex,
      );

      for (let i = 0; i < claimsInfo.length; i++) {
        const claimData = await this.contract._claimViewData(
          this.args.validBeginIndex + i,
        );
        expect(claimsInfo[i]).to.deep.equal(claimData);
      }
    });
  });
}
