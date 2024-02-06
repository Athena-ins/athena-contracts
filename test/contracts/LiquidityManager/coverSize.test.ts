import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_coverSize() {
  context("coverSize", function () {
    before(async function () {
      this.args = {};
    });

    it("should return the correct size of a cover's protection for a given cover ID", async function () {
      // Register a cover with a specific size of protection
      await this.contracts.LiquidityManager.registerCoverWithAmount(
        this.args.coverId,
        this.args.coverAmount,
      );

      // Retrieve the size of the cover's protection
      const coverSize = await this.contracts.LiquidityManager.coverSize(
        this.args.coverId,
      );

      // Check if the retrieved cover size matches the expected size
      expect(coverSize).to.equal(this.args.coverAmount);
    });

    it("should revert when querying the size of protection for a non-existent cover", async function () {
      // Attempt to retrieve the size of protection for a non-existent cover
      expect(
        await this.contracts.LiquidityManager.coverSize(
          this.args.nonExistentCoverId,
        ),
      ).to.be.reverted; // Check for appropriate revert condition for non-existent cover
    });

    it("should handle multiple covers with different sizes of protection correctly", async function () {
      // Register multiple covers with different sizes of protection
      await this.contracts.LiquidityManager.registerCoverWithAmount(
        this.args.coverId1,
        this.args.coverAmount1,
      );
      await this.contracts.LiquidityManager.registerCoverWithAmount(
        this.args.coverId2,
        this.args.coverAmount2,
      );

      // Retrieve sizes of protection for the covers
      const coverSize1 = await this.contracts.LiquidityManager.coverSize(
        this.args.coverId1,
      );
      const coverSize2 = await this.contracts.LiquidityManager.coverSize(
        this.args.coverId2,
      );

      // Check if the retrieved cover sizes match the expected values
      expect(coverSize1).to.equal(this.args.coverAmount1);
      expect(coverSize2).to.equal(this.args.coverAmount2);
    });

    it("should consistently return the same size of protection for the same cover", async function () {
      // Register a cover with a specific size of protection
      await this.contracts.LiquidityManager.registerCoverWithAmount(
        this.args.coverId,
        this.args.coverAmount,
      );

      // Retrieve the size of the cover's protection multiple times
      const coverSize1 = await this.contracts.LiquidityManager.coverSize(
        this.args.coverId,
      );
      const coverSize2 = await this.contracts.LiquidityManager.coverSize(
        this.args.coverId,
      );

      // Check if the retrieved cover sizes are consistent
      expect(coverSize1).to.equal(coverSize2);
    });
  });
}
