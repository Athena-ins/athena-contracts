import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool__syncLiquidity() {
  context("_syncLiquidity", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if trying to remove more liquidity than available", async function () {
      // Attempt to sync liquidity with removal greater than available liquidity
      expect(
        await this.contracts.TestableVirtualPool.syncLiquidity(
          this.args.liquidityToAdd,
          this.args.liquidityToRemoveExceedingAvailable,
        ),
      ).to.be.revertedWith("NotEnoughLiquidityForRemoval");
    });

    it("should successfully update the pool's slot0 when adding liquidity", async function () {
      // Sync liquidity with adding liquidity
      expect(
        await this.contracts.TestableVirtualPool.syncLiquidity(
          this.args.liquidityToAdd,
          0, // No liquidity removal
        ),
      ).to.not.throw;
      // Check the updated values in slot0
      const slot0 = await this.contracts.TestableVirtualPool.slot0();
      expect(slot0.secondsPerTick).to.equal(
        this.args.expectedSecondsPerTickAfterAdd,
      );
    });

    it("should successfully update the pool's slot0 when removing liquidity", async function () {
      // Sync liquidity with removing liquidity
      expect(
        await this.contracts.TestableVirtualPool.syncLiquidity(
          0, // No liquidity addition
          this.args.liquidityToRemove,
        ),
      ).to.not.throw;
      // Check the updated values in slot0
      const slot0 = await this.contracts.TestableVirtualPool.slot0();
      expect(slot0.secondsPerTick).to.equal(
        this.args.expectedSecondsPerTickAfterRemove,
      );
    });

    it("should correctly calculate the new premium rate after liquidity change", async function () {
      // Sync liquidity and check the new premium rate
      await this.contracts.TestableVirtualPool.syncLiquidity(
        this.args.liquidityToAdd,
        this.args.liquidityToRemove,
      );
      const newPremiumRate =
        await this.contracts.TestableVirtualPool.currentPremiumRate();
      expect(newPremiumRate).to.equal(this.args.expectedNewPremiumRate);
    });
  });
}
