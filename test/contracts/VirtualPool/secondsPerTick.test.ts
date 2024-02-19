import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool_secondsPerTick() {
  context("secondsPerTick", function () {
    before(async function () {
      this.args = {};
    });

    it("should correctly compute the new seconds per tick after premium rate change", function () {
      // Compute the new seconds per tick with given old seconds per tick, old premium rate, and new premium rate
      const newSecondsPerTick = this.contracts.LiquidityManager.secondsPerTick(
        this.args.oldSecondsPerTick,
        this.args.oldPremiumRate,
        this.args.newPremiumRate,
      );

      // Calculate expected new seconds per tick
      const expectedNewSecondsPerTick = this.args.expectedNewSecondsPerTick; // Calculated based on provided formula

      // Check if the computed value matches the expected value
      expect(newSecondsPerTick).to.equal(expectedNewSecondsPerTick);
    });

    it("should increase the seconds per tick when the new premium rate is lower than the old rate", function () {
      // Compute the new seconds per tick with a lower new premium rate
      const newSecondsPerTick = this.contracts.LiquidityManager.secondsPerTick(
        this.args.oldSecondsPerTick,
        this.args.oldPremiumRate,
        this.args.lowerNewPremiumRate, // Lower than oldPremiumRate
      );

      // Check if the new seconds per tick is greater than the old seconds per tick
      expect(newSecondsPerTick).to.be.greaterThan(this.args.oldSecondsPerTick);
    });

    it("should decrease the seconds per tick when the new premium rate is higher than the old rate", function () {
      // Compute the new seconds per tick with a higher new premium rate
      const newSecondsPerTick = this.contracts.LiquidityManager.secondsPerTick(
        this.args.oldSecondsPerTick,
        this.args.oldPremiumRate,
        this.args.higherNewPremiumRate, // Higher than oldPremiumRate
      );

      // Check if the new seconds per tick is less than the old seconds per tick
      expect(newSecondsPerTick).to.be.lessThan(this.args.oldSecondsPerTick);
    });

    it("should retain the seconds per tick if the premium rate remains unchanged", function () {
      // Compute the new seconds per tick with the same premium rate
      const newSecondsPerTick = this.contracts.LiquidityManager.secondsPerTick(
        this.args.oldSecondsPerTick,
        this.args.oldPremiumRate,
        this.args.oldPremiumRate, // Same as oldPremiumRate
      );

      // Check if the new seconds per tick is equal to the old seconds per tick
      expect(newSecondsPerTick).to.equal(this.args.oldSecondsPerTick);
    });
  });
}
