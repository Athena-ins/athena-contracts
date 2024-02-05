import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_addClaimToPool() {
  context("addClaimToPool", function () {
    before(async function () {
      this.args = {};
    });

    it("should increment the number of ongoing claims in the pool for a given cover ID", async function () {
      // Initially register a cover
      await this.contracts.LiquidityManager.registerCover(
        this.args.coverId,
        this.args.poolId,
      );

      // Add a claim to the pool for the registered cover
      await expect(
        this.contracts.LiquidityManager.connect(
          this.signers.claimManager,
        ).addClaimToPool(this.args.coverId),
      ).to.not.throw;

      // Retrieve the pool information
      const poolId = this.args.poolId; // Pool ID associated with the cover
      const poolInfo = await this.contracts.TestableVirtualPool.pools(poolId);

      // Check if the number of ongoing claims in the pool is incremented
      expect(poolInfo.ongoingClaims).to.equal(
        this.args.expectedOngoingClaims + 1,
      );
    });

    it("should only allow the claim manager to add a claim to the pool", async function () {
      // Attempt to add a claim to the pool by a non-claim manager
      await expect(
        this.contracts.LiquidityManager.connect(
          this.signers.nonClaimManager,
        ).addClaimToPool(this.args.coverId),
      ).to.be.revertedWith("OnlyClaimManager");
    });

    it("should not allow adding a claim to a non-existent cover", async function () {
      // Attempt to add a claim to the pool for a non-existent cover
      await expect(
        this.contracts.LiquidityManager.connect(
          this.signers.claimManager,
        ).addClaimToPool(this.args.nonExistentCoverId),
      ).to.be.reverted; // Check for appropriate revert condition for non-existent cover
    });

    it("should handle multiple claims for the same cover correctly", async function () {
      // Add multiple claims to the pool for the same cover
      await this.contracts.LiquidityManager.connect(
        this.signers.claimManager,
      ).addClaimToPool(this.args.coverId);
      await this.contracts.LiquidityManager.connect(
        this.signers.claimManager,
      ).addClaimToPool(this.args.coverId);

      // Retrieve the pool information
      const poolId = this.args.poolId; // Pool ID associated with the cover
      const poolInfo = await this.contracts.TestableVirtualPool.pools(poolId);

      // Check if the number of ongoing claims in the pool is incremented correctly
      expect(poolInfo.ongoingClaims).to.equal(
        this.args.expectedOngoingClaims + 2,
      );
    });
  });
}
