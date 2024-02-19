import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function VirtualPool__crossingInitializedTick() {
  context("_crossingInitializedTick", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should correctly mutate slot0 upon crossing an initialized tick", async function (this: Arguments) {
      // Setup a VPool instance and slot0
      let self = setupVPoolInstance(); // Replace with the actual setup method
      let slot0 = setupSlot0Instance(); // Replace with the actual setup method for slot0
      const tick = this.args.tickToCross;

      // Call _crossingInitializedTick and store the result
      const { mutatedSlot0, utilization, premiumRate } =
        await this.contracts.LiquidityManager.crossingInitializedTick(
          self,
          slot0,
          tick,
        );

      // The expected values after crossing the tick
      const expectedCoveredCapital = this.args.expectedCoveredCapitalAfterCross;
      const expectedRemainingCovers =
        this.args.expectedRemainingCoversAfterCross;
      const expectedSecondsPerTick = this.args.expectedSecondsPerTickAfterCross;

      // Check if the mutated values match the expected values
      expect(mutatedSlot0.coveredCapital).to.equal(expectedCoveredCapital);
      expect(mutatedSlot0.remainingCovers).to.equal(expectedRemainingCovers);
      expect(mutatedSlot0.secondsPerTick).to.equal(expectedSecondsPerTick);
      expect(utilization).to.equal(this.args.expectedUtilizationAfterCross);
      expect(premiumRate).to.equal(this.args.expectedPremiumRateAfterCross);
    });

    function setupVPoolInstance() {
      // Setup the VPool instance with required initial values
      // This function needs to be implemented to create and return a VPool instance with appropriate values
    }

    function setupSlot0Instance() {
      // Setup the Slot0 instance with required initial values
      // This function needs to be implemented to create and return a Slot0 instance with appropriate values
    }
  });
}
