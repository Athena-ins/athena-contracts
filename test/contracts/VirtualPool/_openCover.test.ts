import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool__openCover() {
  context("_openCover", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if available liquidity is less than the cover amount", async function () {
      // Attempt to buy cover when available liquidity is insufficient
      expect(
        await this.contracts.LiquidityManager.openCover(
          this.args.coverId,
          this.args.coverAmountExceedingLiquidity,
          this.args.premiums,
        ),
      ).to.be.revertedWith("InsufficientCapacity");
    });

    it("should revert if the calculated duration is too low", async function () {
      // Attempt to buy cover with a duration shorter than the new seconds per tick
      expect(
        await this.contracts.LiquidityManager.openCover(
          this.args.coverId,
          this.args.coverAmount,
          this.args.premiumsLeadingToLowDuration,
        ),
      ).to.be.revertedWith("DurationTooLow");
    });

    it("should successfully register a premium position and update the pool's slot0", async function () {
      // Buy cover and check successful registration of premium position
      expect(
        await this.contracts.LiquidityManager.openCover(
          this.args.coverId,
          this.args.coverAmount,
          this.args.premiums,
        ),
      ).to.not.throw;
      // Check the pool's slot0 for updated values
      const slot0 = await this.contracts.LiquidityManager.slot0();
      expect(slot0.coveredCapital).to.equal(this.args.expectedCoveredCapital);
      expect(slot0.secondsPerTick).to.equal(this.args.expectedSecondsPerTick);
      expect(slot0.remainingCovers).to.equal(this.args.expectedRemainingCovers);
    });

    it("should correctly calculate the new premium rate, duration, and update the premium position", async function () {
      // Buy cover and verify the new premium rate and duration calculation
      await this.contracts.LiquidityManager.openCover(
        this.args.coverId,
        this.args.coverAmount,
        this.args.premiums,
      );

      // Verify the new premium rate
      const newPremiumRate =
        await this.contracts.LiquidityManager.currentPremiumRate();
      expect(newPremiumRate).to.equal(this.args.expectedNewPremiumRate);

      // Retrieve and verify the updated cover premiums data
      const coverPremiums = await this.contracts.LiquidityManager.coverPremiums(
        this.args.poolId,
        this.args.coverId,
      );
      expect(coverPremiums.lastTick).to.equal(this.args.expectedLastTick);
      expect(coverPremiums.beginPremiumRate).to.equal(
        this.args.expectedBeginPremiumRate,
      );

      // Additional checks can be implemented to verify other aspects of the cover premium data
    });
  });
}
