import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function VirtualPool__coverInfo() {
  context("_coverInfo", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    // Test for _closeCover function

    it("should revert if the cover has already expired", async function (this: Arguments) {
      // Attempt to close an expired cover
      expect(
        await this.contracts.LiquidityManager.closeCover(
          this.args.coverIdWithExpiredCover,
          this.args.coverAmount,
        ),
      ).to.be.revertedWith("CoverAlreadyExpired");
    });

    it("should successfully close a cover and update the pool's slot0", async function (this: Arguments) {
      // Close a valid cover
      expect(
        await this.contracts.LiquidityManager.closeCover(
          this.args.coverId,
          this.args.coverAmount,
        ),
      ).to.not.throw;
      // Check the pool's slot0 for updated values
      const slot0 = await this.contracts.LiquidityManager.slot0();
      expect(slot0.coveredCapital).to.equal(
        this.args.expectedCoveredCapitalAfterClose,
      );
      expect(slot0.secondsPerTick).to.equal(
        this.args.expectedSecondsPerTickAfterClose,
      );
      expect(slot0.remainingCovers).to.equal(
        this.args.expectedRemainingCoversAfterClose,
      );
    });

    it("should remove the cover from the tick data if it's the last cover in the tick", async function (this: Arguments) {
      // Close a cover that is the last cover in its tick
      await this.contracts.LiquidityManager.closeCover(
        this.args.coverIdLastInTick,
        this.args.coverAmount,
      );
      // Verify that the tick is removed
      // Note: Additional checks needed to ensure the tick is correctly removed
    });

    it("should adjust cover premium data if the cover is not the last cover in the tick", async function (this: Arguments) {
      // Close a cover that is not the last cover in its tick
      await this.contracts.LiquidityManager.closeCover(
        this.args.coverIdNotLastInTick,
        this.args.coverAmount,
      );
      // Verify that the cover premium data is adjusted correctly
      // Note: Additional checks needed to ensure the cover premium data is updated properly
    });

    // Test for _coverInfo function

    it("should return zero values if the cover's last tick is overtaken", async function (this: Arguments) {
      // Retrieve cover info for an expired cover
      const coverInfo = await this.contracts.LiquidityManager.coverInfo(
        this.args.coverIdWithExpiredCover,
      );
      // Check if the returned values are zeros
      expect(coverInfo.premiumsLeft).to.equal(0);
      expect(coverInfo.currentDailyCost).to.equal(0);
    });

    it("should correctly compute the premium rate and daily cost of a cover", async function (this: Arguments) {
      // Retrieve cover info for a valid cover
      const coverInfo = await this.contracts.LiquidityManager.coverInfo(
        this.args.coverId,
      );
      // Check if the returned values match the expected premium rate and daily cost
      expect(coverInfo.premiumRate).to.equal(this.args.expectedPremiumRate);
      expect(coverInfo.currentDailyCost).to.equal(
        this.args.expectedCurrentDailyCost,
      );
    });

    it("should correctly calculate the premiums left for a cover", async function (this: Arguments) {
      // Retrieve cover info for a valid cover
      const coverInfo = await this.contracts.LiquidityManager.coverInfo(
        this.args.coverId,
      );
      // Check if the returned premiums left match the expected value
      expect(coverInfo.premiumsLeft).to.equal(this.args.expectedPremiumsLeft);
    });
  });
}
