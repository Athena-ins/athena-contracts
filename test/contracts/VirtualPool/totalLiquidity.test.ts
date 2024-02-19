import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function VirtualPool_totalLiquidity() {
  context("totalLiquidity", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should return the total liquidity of the pool", async function (this: Arguments) {
      // Call totalLiquidity on the LiquidityManager contract
      const totalLiquidity =
        await this.contracts.LiquidityManager.totalLiquidity();

      // Compare the result with the expected total liquidity value
      expect(totalLiquidity).to.equal(this.args.expectedTotalLiquidity);
    });
  });
}
