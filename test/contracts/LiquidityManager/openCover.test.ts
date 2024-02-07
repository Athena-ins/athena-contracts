import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_openCover() {
  context("openCover", function () {
    before(async function () {
      this.args = {};
    });

    it("should buy a cover and update the pool and cover information correctly", async function () {
      // Simulate buying a cover
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.user,
        ).openCover(
          this.args.poolId,
          this.args.coverAmount,
          this.args.premiums,
        ),
      ).to.not.throw;

      // Retrieve the created cover information
      const coverId = this.args.nextCoverId; // The next cover ID before buying the cover
      const cover = await this.contracts.LiquidityManager._covers(coverId);

      // Check if the cover information is initialized correctly
      expect(cover.poolId).to.equal(this.args.poolId);
      expect(cover.coverAmount).to.equal(this.args.coverAmount);
      expect(cover.start).to.be.at.least(this.args.expectedStartTime);

      // Check if the cover is correctly created in the pool
      const pool = await this.contracts.TestableVirtualPool.pools(
        this.args.poolId,
      );
      const coverPremium = pool.coverPremiums(coverId);
      expect(coverPremium).to.exist; // Check for correct initialization of cover premium

      // Check if the cover NFT is minted to the user
      const ownerOfCover =
        await this.contracts.AthenaCoverToken.ownerOf(coverId);
      expect(ownerOfCover).to.equal(this.signers.user.address);
    });

    it("should revert if the pool is paused", async function () {
      // Pause the pool
      await this.contracts.TestableVirtualPool.setPoolPause(
        this.args.poolId,
        true,
      );

      // Attempt to buy a cover in a paused pool
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.user,
        ).openCover(
          this.args.poolId,
          this.args.coverAmount,
          this.args.premiums,
        ),
      ).to.be.revertedWith("PoolIsPaused");

      // Reset pool pause for subsequent tests
      await this.contracts.TestableVirtualPool.setPoolPause(
        this.args.poolId,
        false,
      );
    });

    it("should revert if there is insufficient liquidity in the pool", async function () {
      // Attempt to buy a cover with an amount higher than available liquidity
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.user,
        ).openCover(
          this.args.poolId,
          this.args.coverAmountExceedingLiquidity,
          this.args.premiums,
        ),
      ).to.be.revertedWith("InsufficientLiquidityForCover");
    });

    it("should transfer premiums from the user to the contract", async function () {
      // Buy a cover and check premiums transfer
      await this.contracts.LiquidityManager.connect(
        this.signers.user,
      ).openCover(this.args.poolId, this.args.coverAmount, this.args.premiums);

      // Check if the premiums are transferred from the user to the contract
      const balanceOfContract = await this.contracts.AthenaCoverToken.balanceOf(
        address(this.contracts.LiquidityManager),
      );
      expect(balanceOfContract).to.equal(this.args.premiums);
    });
  });
}
