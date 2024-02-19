import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function VirtualPool__refresh() {
  context("_refresh", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should correctly compute an updated slot0 and liquidity index up to a given timestamp", async function (this: Arguments) {
      // Setup the timestamp for the refresh
      const timestamp = this.args.timestampForRefresh;

      // Call _refresh and store the results
      const { slot0, liquidityIndex } =
        await this.contracts.LiquidityManager.refresh(timestamp);

      // Check if the returned slot0 values are as expected
      expect(slot0.tick).to.equal(this.args.expectedSlot0Tick);
      expect(slot0.lastUpdateTimestamp).to.equal(timestamp);

      // Check if the returned liquidity index matches the expected value
      expect(liquidityIndex).to.equal(this.args.expectedLiquidityIndex);
    });

    it("should handle crossing initialized ticks correctly", async function (this: Arguments) {
      // Setup the timestamp for the refresh that involves crossing initialized ticks
      const timestamp = this.args.timestampForCrossingInitializedTicks;

      // Call _refresh and store the results
      const { slot0 } =
        await this.contracts.LiquidityManager.refresh(timestamp);

      // Check if the slot0 values are updated correctly after crossing initialized ticks
      expect(slot0.tick).to.be.at.least(
        this.args.expectedMinimumTickAfterCrossing,
      );
      expect(slot0.lastUpdateTimestamp).to.equal(timestamp);
      // Additional checks can be implemented to verify other aspects of the slot0 update
    });

    it("should update the liquidity index based on utilization and premium rate", async function (this: Arguments) {
      // Setup the timestamp for the refresh
      const timestamp = this.args.timestampForLiquidityIndexUpdate;

      // Call _refresh and store the results
      const { liquidityIndex } =
        await this.contracts.LiquidityManager.refresh(timestamp);

      // Check if the liquidity index is updated correctly based on utilization and premium rate
      expect(liquidityIndex).to.equal(
        this.args.expectedLiquidityIndexAfterUpdate,
      );
    });
  });
}
