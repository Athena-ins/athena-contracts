import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function VirtualPool__purgeExpiredCovers() {
  context("_purgeExpiredCovers", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should not make any changes if there are no remaining covers in the pool", async function (this: Arguments) {
      // Setup a scenario where the pool has no remaining covers
      await this.contracts.LiquidityManager.setupNoRemainingCovers();

      // Call _purgeExpiredCovers and check that no changes are made
      const slot0Before = await this.contracts.LiquidityManager.slot0();
      await this.contracts.LiquidityManager.purgeExpiredCovers();
      const slot0After = await this.contracts.LiquidityManager.slot0();

      // Check that slot0 remains unchanged
      expect(slot0After).to.deep.equal(slot0Before);
    });

    it("should remove expired covers and update the pool's slot0", async function (this: Arguments) {
      // Setup a scenario where the pool has remaining covers that are expired
      await this.contracts.LiquidityManager.setupWithExpiredCovers();

      // Call _purgeExpiredCovers and verify changes
      await this.contracts.LiquidityManager.purgeExpiredCovers();

      // Check if the expired covers are removed and slot0 is updated
      const slot0AfterPurge = await this.contracts.LiquidityManager.slot0();
      expect(slot0AfterPurge.remainingCovers).to.equal(
        this.args.expectedRemainingCoversAfterPurge,
      );
      expect(slot0AfterPurge.tick).to.equal(this.args.expectedTickAfterPurge);
      // Additional checks can be added for other fields of slot0
    });

    it("should correctly update the liquidity index after purging expired covers", async function (this: Arguments) {
      // Setup a scenario and call _purgeExpiredCovers
      await this.contracts.LiquidityManager.setupWithExpiredCovers();
      await this.contracts.LiquidityManager.purgeExpiredCovers();

      // Verify the liquidity index is updated
      const liquidityIndexAfterPurge =
        await this.contracts.LiquidityManager.liquidityIndex();
      expect(liquidityIndexAfterPurge).to.equal(
        this.args.expectedLiquidityIndexAfterPurge,
      );
    });

    it("should update the last update timestamp to the current timestamp", async function (this: Arguments) {
      // Call _purgeExpiredCovers and check the last update timestamp
      await this.contracts.LiquidityManager.purgeExpiredCovers();
      const lastUpdateTimestamp =
        await this.contracts.LiquidityManager.lastUpdateTimestamp();

      // Check if the last update timestamp is set to the current timestamp
      expect(lastUpdateTimestamp).to.be.closeTo(
        block.timestamp,
        this.args.timestampTolerance,
      );
    });
  });
}
