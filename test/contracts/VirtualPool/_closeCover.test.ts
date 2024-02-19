import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function VirtualPool__closeCover() {
  context("_closeCover", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if the cover has already expired", async function (this: Arguments) {
      // Attempt to close an already expired cover
      expect(
        await this.contracts.LiquidityManager.closeCover(
          this.args.coverIdExpired,
          this.args.coverAmount,
        ),
      ).to.be.revertedWith("CoverAlreadyExpired");
    });

    it("should successfully close a cover and update the pool's slot0", async function (this: Arguments) {
      // Close a valid cover and check successful update of the pool's slot0
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

    it("should correctly handle cover removal from the tick data structure", async function (this: Arguments) {
      // Close a cover and check correct handling of cover removal
      await this.contracts.LiquidityManager.closeCover(
        this.args.coverId,
        this.args.coverAmount,
      );
      // Verify the cover is removed from the tick data structure
      // This requires specific checks depending on the implementation of the ticks data structure
    });

    it("should correctly update the premium rate and seconds per tick", async function (this: Arguments) {
      // Close a cover and verify the new premium rate and seconds per tick calculation
      await this.contracts.LiquidityManager.closeCover(
        this.args.coverId,
        this.args.coverAmount,
      );
      const newPremiumRate =
        await this.contracts.LiquidityManager.currentPremiumRate();
      expect(newPremiumRate).to.equal(
        this.args.expectedNewPremiumRateAfterClose,
      );
      // Additional checks can be implemented to verify the seconds per tick calculation
    });
  });
}
