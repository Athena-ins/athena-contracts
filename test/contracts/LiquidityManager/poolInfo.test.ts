import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function LiquidityManager_poolInfo() {
  context("poolInfo", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should return the correct virtual pool's storage for a given pool ID", async function (this: Arguments) {
      // Retrieve pool info for a specific pool ID
      const poolInfo = await this.contracts.LiquidityManager.poolInfo(
        this.args.poolId,
      );

      // Check if the retrieved pool info matches the expected values
      expect(poolInfo.poolId).to.equal(this.args.poolId);
      expect(poolInfo.feeRate).to.equal(this.args.expectedFeeRate);
      expect(poolInfo.formula).to.eql(this.args.expectedFormula);
      expect(poolInfo.slot0).to.eql(this.args.expectedSlot0);
      expect(poolInfo.liquidityIndex).to.equal(
        this.args.expectedLiquidityIndex,
      );
      expect(poolInfo.strategyId).to.equal(this.args.expectedStrategyId);
      expect(poolInfo.paymentAsset).to.equal(this.args.expectedPaymentAsset);
      expect(poolInfo.underlyingAsset).to.equal(
        this.args.expectedUnderlyingAsset,
      );
      expect(poolInfo.wrappedAsset).to.equal(this.args.expectedWrappedAsset);
      expect(poolInfo.isPaused).to.equal(this.args.expectedIsPaused);
      expect(poolInfo.overlappedPools).to.eql(
        this.args.expectedOverlappedPools,
      );
      expect(poolInfo.compensationIds).to.eql(
        this.args.expectedCompensationIds,
      );
    });

    it("should return an empty pool storage if the pool ID does not exist", async function (this: Arguments) {
      // Attempt to retrieve pool info for a non-existent pool ID
      const poolInfo = await this.contracts.LiquidityManager.poolInfo(
        this.args.nonExistentPoolId,
      );

      // Check if the retrieved pool info is empty or default
      expect(poolInfo.poolId).to.equal(0);
      expect(poolInfo.feeRate).to.equal(0);
      // Additional checks for other default or empty values
    });

    it("should include the correct overlapped pools in the pool info", async function (this: Arguments) {
      // Retrieve pool info and check overlapped pools
      const poolInfo = await this.contracts.LiquidityManager.poolInfo(
        this.args.poolId,
      );

      // Check if the overlapped pools match the expected values
      expect(poolInfo.overlappedPools).to.eql(
        this.args.expectedOverlappedPools,
      );
    });

    it("should correctly reflect the pool's paused status in the pool info", async function (this: Arguments) {
      // Retrieve pool info and check the paused status
      const poolInfo = await this.contracts.LiquidityManager.poolInfo(
        this.args.poolId,
      );

      // Check if the paused status matches the expected value
      expect(poolInfo.isPaused).to.equal(this.args.expectedIsPaused);
    });
  });
}
