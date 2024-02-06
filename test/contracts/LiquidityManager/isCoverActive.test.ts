import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_isCoverActive() {
  context("isCoverActive", function () {
    before(async function () {
      this.args = {};
    });

    it("should return true if a cover is still active", async function () {
      // Register a cover and simulate it being still active
      await this.contracts.LiquidityManager.registerActiveCover(
        this.args.coverId,
        this.args.poolId,
      );

      // Check if the cover is still active
      const isActive = await this.contracts.LiquidityManager.isCoverActive(
        this.args.coverId,
      );

      // Expect the cover to be active
      expect(isActive).to.be.true;
    });

    it("should return false if a cover has expired", async function () {
      // Register a cover and simulate it being expired
      await this.contracts.LiquidityManager.registerExpiredCover(
        this.args.coverId,
        this.args.poolId,
      );

      // Check if the cover is expired
      const isActive = await this.contracts.LiquidityManager.isCoverActive(
        this.args.coverId,
      );

      // Expect the cover to be inactive (expired)
      expect(isActive).to.be.false;
    });

    it("should handle multiple covers with different active states correctly", async function () {
      // Register multiple covers with different active states
      await this.contracts.LiquidityManager.registerActiveCover(
        this.args.coverId1,
        this.args.poolId,
      );
      await this.contracts.LiquidityManager.registerExpiredCover(
        this.args.coverId2,
        this.args.poolId,
      );

      // Check the active state of each cover
      const isActive1 = await this.contracts.LiquidityManager.isCoverActive(
        this.args.coverId1,
      );
      const isActive2 = await this.contracts.LiquidityManager.isCoverActive(
        this.args.coverId2,
      );

      // Expect the covers to have their respective active states
      expect(isActive1).to.be.true;
      expect(isActive2).to.be.false;
    });

    it("should revert when querying the active state of a non-existent cover", async function () {
      // Attempt to check the active state of a non-existent cover
      expect(
        await this.contracts.LiquidityManager.isCoverActive(
          this.args.nonExistentCoverId,
        ),
      ).to.be.reverted; // Check for appropriate revert condition for non-existent cover
    });
  });
}
