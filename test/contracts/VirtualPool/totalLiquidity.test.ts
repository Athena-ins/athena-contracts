import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool_totalLiquidity() {
  context("totalLiquidity", function () {
    before(async function () {
      this.args = {};
    });

    it("should return the total liquidity of the pool", async function () {
      // Call totalLiquidity on the TestableVirtualPool contract
      const totalLiquidity =
        await this.contracts.TestableVirtualPool.totalLiquidity();

      // Compare the result with the expected total liquidity value
      expect(totalLiquidity).to.equal(this.args.expectedTotalLiquidity);
    });
  });
}
