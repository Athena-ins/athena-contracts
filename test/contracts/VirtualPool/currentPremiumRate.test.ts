import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool_currentPremiumRate() {
  context("currentPremiumRate", function () {
    before(async function () {
      this.args = {};
    });

    it("should return the current premium rate based on pool utilization", async function () {
      // Get the current premium rate
      const currentPremiumRate =
        await this.contracts.TestableVirtualPool.currentPremiumRate();

      // Expected premium rate based on utilization
      const expectedPremiumRate = this.args.expectedPremiumRate;

      // Compare the result with the expected premium rate
      expect(currentPremiumRate).to.equal(expectedPremiumRate);
    });
  });
}
