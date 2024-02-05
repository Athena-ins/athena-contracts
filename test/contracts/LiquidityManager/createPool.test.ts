import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_createPool() {
  context("createPool", function () {
    before(async function () {
      this.args = {};
    });

    it("should create a new pool and initialize its parameters", async function () {
      // Create a new pool
      await expect(
        this.contracts.LiquidityManager.createPool(
          this.args.paymentAsset,
          this.args.strategyId,
          this.args.feeRate,
          this.args.uOptimal,
          this.args.r0,
          this.args.rSlope1,
          this.args.rSlope2,
          this.args.compatiblePools,
        ),
      ).to.not.throw;

      // Retrieve the created pool
      const poolId = this.args.nextPoolId; // The next pool ID before pool creation
      const pool = await this.contracts.TestableVirtualPool.pools(poolId);

      // Check if the pool parameters are initialized correctly
      expect(pool.paymentAsset).to.equal(this.args.paymentAsset);
      expect(pool.strategyId).to.equal(this.args.strategyId);
      expect(pool.feeRate).to.equal(this.args.feeRate);
      expect(pool.formula.uOptimal).to.equal(this.args.uOptimal);
      expect(pool.formula.r0).to.equal(this.args.r0);
      expect(pool.formula.rSlope1).to.equal(this.args.rSlope1);
      expect(pool.formula.rSlope2).to.equal(this.args.rSlope2);
    });

    it("should register the pool as compatible with specified pools", async function () {
      // Create a new pool and specify compatible pools
      await this.contracts.LiquidityManager.createPool(
        this.args.paymentAsset,
        this.args.strategyId,
        this.args.feeRate,
        this.args.uOptimal,
        this.args.r0,
        this.args.rSlope1,
        this.args.rSlope2,
        this.args.compatiblePools,
      );

      const poolId = this.args.nextPoolId; // The next pool ID before pool creation

      // Check if the pool is registered as compatible with specified pools
      for (let i = 0; i < this.args.compatiblePools.length; i++) {
        const compatiblePoolId = this.args.compatiblePools[i];
        const isCompatible =
          await this.contracts.LiquidityManager.arePoolCompatible(
            poolId,
            compatiblePoolId,
          );
        expect(isCompatible).to.be.true;
      }
    });

    it("should increment the pool ID for the next pool creation", async function () {
      // Create a new pool
      await this.contracts.LiquidityManager.createPool(
        this.args.paymentAsset,
        this.args.strategyId,
        this.args.feeRate,
        this.args.uOptimal,
        this.args.r0,
        this.args.rSlope1,
        this.args.rSlope2,
        this.args.compatiblePools,
      );

      // Check if the next pool ID is incremented
      const newNextPoolId = await this.contracts.LiquidityManager.nextPoolId();
      expect(newNextPoolId).to.equal(this.args.nextPoolId + 1);
    });

    it("should only allow the owner to create a new pool", async function () {
      // Attempt to create a new pool by a non-owner
      await expect(
        this.contracts.LiquidityManager.connect(
          this.signers.nonOwner,
        ).createPool(
          this.args.paymentAsset,
          this.args.strategyId,
          this.args.feeRate,
          this.args.uOptimal,
          this.args.r0,
          this.args.rSlope1,
          this.args.rSlope2,
          this.args.compatiblePools,
        ),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
}
