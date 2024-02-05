import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool_getDailyCost() {
  context("getDailyCost", function () {
    before(async function () {
      this.args = {};
    });

    it("should correctly compute the new daily cost of a cover", function () {
      // Compute the new daily cost of a cover based on premium rate changes
      const newDailyCost = this.contracts.TestableVirtualPool.getDailyCost(
        this.args.oldDailyCost,
        this.args.oldPremiumRate,
        this.args.newPremiumRate,
      );

      // Calculate the expected new daily cost
      const expectedNewDailyCost = this.args.oldDailyCost
        .rayMul(this.args.newPremiumRate)
        .rayDiv(this.args.oldPremiumRate);

      // Check if the computed new daily cost matches the expected value
      expect(newDailyCost).to.equal(expectedNewDailyCost);
    });

    it("should return the old daily cost if the premium rate remains unchanged", function () {
      // Compute the daily cost of a cover when the premium rate does not change
      const newDailyCost = this.contracts.TestableVirtualPool.getDailyCost(
        this.args.oldDailyCost,
        this.args.oldPremiumRate,
        this.args.oldPremiumRate, // No change in premium rate
      );

      // Check if the new daily cost equals the old daily cost
      expect(newDailyCost).to.equal(this.args.oldDailyCost);
    });
  });
}
