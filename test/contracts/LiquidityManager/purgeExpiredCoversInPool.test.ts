import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_purgeExpiredCoversInPool() {
  context("purgeExpiredCoversInPool", function () {
    before(async function () {
      this.args = {};
    });

    it("should not change the pool state when no covers are expired", async function () {
      // Setup: Initialize a pool with no expired covers

      await this.liquidityManager.purgeExpiredCoversInPool(this.args.poolId);

      const poolAfterPurge = await this.liquidityManager.poolInfo(
        this.args.poolId,
      );

      expect(poolAfterPurge).to.deep.equal(this.args.initialPoolState);
    });

    it("should remove only expired covers from the pool", async function () {
      // Setup: Initialize a pool with some expired and some active covers

      await this.liquidityManager.purgeExpiredCoversInPool(this.args.poolId);

      const poolAfterPurge = await this.liquidityManager.poolInfo(
        this.args.poolId,
      );
      expect(poolAfterPurge.remainingCovers).to.equal(
        this.args.expectedRemainingCovers,
      );
    });

    it("should remove all covers when all are expired in the pool", async function () {
      // Setup: Initialize a pool where all covers are expired

      await this.liquidityManager.purgeExpiredCoversInPool(this.args.poolId);

      const poolAfterPurge = await this.liquidityManager.poolInfo(
        this.args.poolId,
      );
      expect(poolAfterPurge.remainingCovers).to.equal(0);
    });

    it("should correctly update the remainingCovers count in the pool", async function () {
      // Setup: Initialize a pool with a known number of expired and active covers

      await this.liquidityManager.purgeExpiredCoversInPool(this.args.poolId);

      const poolAfterPurge = await this.liquidityManager.poolInfo(
        this.args.poolId,
      );
      expect(poolAfterPurge.remainingCovers).to.equal(
        this.args.expectedRemainingCoversCount,
      );
    });

    it("should correctly update the coveredCapital in the pool", async function () {
      // Setup: Initialize a pool with a known covered capital including expired covers

      await this.liquidityManager.purgeExpiredCoversInPool(this.args.poolId);

      const poolAfterPurge = await this.liquidityManager.poolInfo(
        this.args.poolId,
      );
      expect(poolAfterPurge.coveredCapital).to.equal(
        this.args.expectedCoveredCapital,
      );
    });

    it("should verify that the correct covers are removed from the pool's cover list", async function () {
      // Setup: Initialize a pool with specific covers, including expired and active ones

      await this.liquidityManager.purgeExpiredCoversInPool(this.args.poolId);

      const remainingCovers = await this.liquidityManager.getRemainingCovers(
        this.args.poolId,
      );
      expect(remainingCovers).to.deep.equal(this.args.expectedRemainingCovers);
    });

    it("should handle calls with invalid or non-existent pool IDs", async function () {
      expect(
        await this.liquidityManager.purgeExpiredCoversInPool(
          this.args.invalidPoolId,
        ),
      ).to.be.revertedWith("InvalidPoolId");
    });

    it("should not affect pools that have no covers or only active covers", async function () {
      // Setup: Initialize a pool with no covers or only active covers

      await this.liquidityManager.purgeExpiredCoversInPool(
        this.args.poolIdWithActiveCoversOnly,
      );

      const poolAfterPurge = await this.liquidityManager.poolInfo(
        this.args.poolIdWithActiveCoversOnly,
      );
      expect(poolAfterPurge.remainingCovers).to.equal(
        this.args.initialRemainingCoversCount,
      );
      expect(poolAfterPurge.coveredCapital).to.equal(
        this.args.initialCoveredCapital,
      );
    });

    it("should emit appropriate events if any are defined for cover removal or pool updates", async function () {
      // Setup: Initialize a pool with known expired covers

      // Call the function and capture the transaction receipt
      const tx = await this.liquidityManager.purgeExpiredCoversInPool(
        this.args.poolId,
      );
      const receipt = await tx.wait();

      // Check for specific events, such as CoverRemoved or PoolUpdated
      // Replace event names and arguments with the actual expected values
      expect(receipt.events).to.deep.include({
        event: "CoverRemoved", // Replace with the actual event name
        args: [
          /* event arguments here */
        ], // Replace with the actual event arguments
      });
      expect(receipt.events).to.deep.include({
        event: "PoolUpdated", // Replace with the actual event name
        args: [
          /* event arguments here */
        ], // Replace with the actual event arguments
      });
      // Add additional event checks as necessary
    });
  });
}
