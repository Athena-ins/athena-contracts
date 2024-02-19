import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function VirtualPool__removeTick() {
  context("_removeTick", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should successfully remove the specified tick and associated premium data", async function (this: Arguments) {
      // Setup a tick to be removed
      const tickToRemove = this.args.tickToRemove;
      await this.contracts.LiquidityManager.addTickWithCovers(
        tickToRemove,
        this.args.coverIds,
      ); // Replace with actual setup method

      // Remove the tick
      expect(await this.contracts.LiquidityManager.removeTick(tickToRemove)).to
        .not.throw;

      // Verify the tick and associated premium data are removed
      const removedTickData =
        await this.contracts.LiquidityManager.ticks(tickToRemove);
      expect(removedTickData).to.be.empty;
      for (let coverId of this.args.coverIds) {
        const coverPremiumData =
          await this.contracts.LiquidityManager.coverPremiums(coverId);
        expect(coverPremiumData).to.be.undefined;
      }

      // Verify the tick bitmap is updated
      const isTickFlipped =
        await this.contracts.LiquidityManager.isTickFlipped(tickToRemove);
      expect(isTickFlipped).to.be.true;
    });

    it("should return the cover IDs associated with the removed tick", async function (this: Arguments) {
      // Setup a tick to be removed
      const tickToRemove = this.args.tickToRemove;
      await this.contracts.LiquidityManager.addTickWithCovers(
        tickToRemove,
        this.args.coverIds,
      ); // Replace with actual setup method

      // Remove the tick and capture the returned cover IDs
      const coverIdsReturned =
        await this.contracts.LiquidityManager.removeTick(tickToRemove);

      // Compare returned cover IDs with the expected cover IDs
      expect(coverIdsReturned).to.deep.equal(this.args.coverIds);
    });
  });
}
