import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function VirtualPool_currentPremiumRate() {
  context("currentPremiumRate", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should return the current premium rate based on pool utilization", async function (this: Arguments) {
      // Get the current premium rate
      const currentPremiumRate =
        await this.contracts.LiquidityManager.currentPremiumRate();

      // Expected premium rate based on utilization
      const expectedPremiumRate = this.args.expectedPremiumRate;

      // Compare the result with the expected premium rate
      expect(currentPremiumRate).to.equal(expectedPremiumRate);
    });
  });
}
