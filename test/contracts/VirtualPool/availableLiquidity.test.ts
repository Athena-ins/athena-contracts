import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool_availableLiquidity() {
  context("availableLiquidity", function () {
    before(async function () {
      this.args = {};
    });

    it("should return the available liquidity of the pool", async function () {
      // Call availableLiquidity on the TestableVirtualPool contract
      const availableLiquidity =
        await this.contracts.TestableVirtualPool.availableLiquidity();

      // The expected available liquidity is the pool's total liquidity minus the covered capital
      const expectedAvailableLiquidity =
        this.args.totalLiquidity - this.args.coveredCapital;

      // Check if the returned available liquidity matches the expected value
      expect(availableLiquidity).to.equal(expectedAvailableLiquidity);
    });
  });
}
