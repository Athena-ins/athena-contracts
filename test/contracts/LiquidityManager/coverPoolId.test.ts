import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_coverPoolId() {
  context("coverPoolId", function () {
    before(async function () {
      this.args = {};
    });

    it("should return the correct pool ID for a given cover ID", async function () {
      // Register a cover with a specific pool ID
      await this.contracts.LiquidityManager.registerCover(
        this.args.coverId,
        this.args.poolId,
      );

      // Retrieve the pool ID for the cover
      const poolId = await this.contracts.LiquidityManager.coverPoolId(
        this.args.coverId,
      );

      // Check if the retrieved pool ID matches the expected pool ID
      expect(poolId).to.equal(this.args.poolId);
    });

    it("should revert when querying the pool ID of a non-existent cover", async function () {
      // Attempt to retrieve the pool ID for a non-existent cover
      expect(
        await this.contracts.LiquidityManager.coverPoolId(
          this.args.nonExistentCoverId,
        ),
      ).to.be.reverted; // Check for appropriate revert condition for non-existent cover
    });

    it("should handle multiple covers with different pool IDs correctly", async function () {
      // Register multiple covers with different pool IDs
      await this.contracts.LiquidityManager.registerCover(
        this.args.coverId1,
        this.args.poolId1,
      );
      await this.contracts.LiquidityManager.registerCover(
        this.args.coverId2,
        this.args.poolId2,
      );

      // Retrieve pool IDs for the covers
      const poolId1 = await this.contracts.LiquidityManager.coverPoolId(
        this.args.coverId1,
      );
      const poolId2 = await this.contracts.LiquidityManager.coverPoolId(
        this.args.coverId2,
      );

      // Check if the retrieved pool IDs match the expected values
      expect(poolId1).to.equal(this.args.poolId1);
      expect(poolId2).to.equal(this.args.poolId2);
    });

    it("should consistently return the same pool ID for the same cover", async function () {
      // Register a cover with a specific pool ID
      await this.contracts.LiquidityManager.registerCover(
        this.args.coverId,
        this.args.poolId,
      );

      // Retrieve the pool ID for the cover multiple times
      const poolId1 = await this.contracts.LiquidityManager.coverPoolId(
        this.args.coverId,
      );
      const poolId2 = await this.contracts.LiquidityManager.coverPoolId(
        this.args.coverId,
      );

      // Check if the retrieved pool IDs are consistent
      expect(poolId1).to.equal(poolId2);
    });
  });
}
