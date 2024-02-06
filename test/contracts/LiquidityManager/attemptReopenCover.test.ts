import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_attemptReopenCover() {
  context("attemptReopenCover", function () {
    before(async function () {
      this.args = {};
    });

    it("should succeed in reopening a cover with valid parameters", async function () {
      // Simulate successful reopening of a cover
      expect(
        await this.contracts.LiquidityManager.attemptReopenCover(
          this.args.poolId,
          this.args.coverId,
          this.args.newCoverAmount,
          this.args.premiums,
        ),
      ).to.not.throw;
    });

    it("should revert if called by an address other than the LiquidityManager contract", async function () {
      // Attempt to call the function from an external address
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.external,
        ).attemptReopenCover(
          this.args.poolId,
          this.args.coverId,
          this.args.newCoverAmount,
          this.args.premiums,
        ),
      ).to.be.revertedWith("SenderNotLiquidationManager");
    });

    it("should update the cover information correctly after reopening", async function () {
      // Reopen a cover and check the updated cover information
      await this.contracts.LiquidityManager.attemptReopenCover(
        this.args.poolId,
        this.args.coverId,
        this.args.newCoverAmount,
        this.args.premiums,
      );

      // Retrieve the updated cover information
      const cover = await this.contracts.LiquidityManager._covers(
        this.args.coverId,
      );

      // Check if the cover information is updated correctly
      expect(cover.coverAmount).to.equal(this.args.newCoverAmount);
      const premiumsLeft =
        await this.contracts.TestableVirtualPool.coverPremiums(
          this.args.coverId,
        ).premiumsLeft;
      expect(premiumsLeft).to.equal(this.args.premiums);
    });

    // More tests could be useful to cover various edge cases and interactions.
  });
}
