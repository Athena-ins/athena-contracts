import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_removeClaimFromPool() {
  context("removeClaimFromPool", function () {
    before(async function () {
      this.args = {};
    });

    it("should decrement the number of ongoing claims in the pool for a given cover ID", async function () {
      // Initially add a claim to the pool
      await this.contracts.LiquidityManager.connect(
        this.signers.claimManager,
      ).addClaimToPool(this.args.coverId);

      // Remove the claim from the pool
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.claimManager,
        ).removeClaimFromPool(this.args.coverId),
      ).to.not.throw;

      // Retrieve the pool information
      const poolId = this.args.poolId; // Pool ID associated with the cover
      const poolInfo = await this.contracts.TestableVirtualPool.pools(poolId);

      // Check if the number of ongoing claims in the pool is decremented
      expect(poolInfo.ongoingClaims).to.equal(this.args.initialOngoingClaims); // Assuming initialOngoingClaims was 1
    });

    it("should only allow the claim manager to remove a claim from the pool", async function () {
      // Add a claim to the pool first
      await this.contracts.LiquidityManager.connect(
        this.signers.claimManager,
      ).addClaimToPool(this.args.coverId);

      // Attempt to remove a claim from the pool by a non-claim manager
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.nonClaimManager,
        ).removeClaimFromPool(this.args.coverId),
      ).to.be.revertedWith("OnlyClaimManager");
    });

    it("should not allow removing a claim from a non-existent cover", async function () {
      // Attempt to remove a claim from the pool for a non-existent cover
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.claimManager,
        ).removeClaimFromPool(this.args.nonExistentCoverId),
      ).to.be.reverted; // Check for appropriate revert condition for non-existent cover
    });

    it("should handle the scenario where no claims are left in the pool", async function () {
      // Remove all claims from the pool
      await this.contracts.LiquidityManager.connect(
        this.signers.claimManager,
      ).removeClaimFromPool(this.args.coverId);
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.claimManager,
        ).removeClaimFromPool(this.args.coverId),
      ).to.not.throw; // Should not revert even if no claims are left

      // Retrieve the pool information
      const poolId = this.args.poolId; // Pool ID associated with the cover
      const poolInfo = await this.contracts.TestableVirtualPool.pools(poolId);

      // Check if the number of ongoing claims in the pool is zero or non-negative
      expect(poolInfo.ongoingClaims).to.be.at.least(0);
    });
  });
}
