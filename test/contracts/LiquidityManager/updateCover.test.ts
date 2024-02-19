import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function LiquidityManager_updateCover() {
  context("updateCover", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if called by non-cover owner", async function (this: Arguments) {
      // Attempt to update cover by a non-cover owner
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.nonOwner,
        ).updateCover(
          this.args.coverId,
          this.args.coverToAdd,
          this.args.coverToRemove,
          this.args.premiumsToAdd,
          this.args.premiumsToRemove,
        ),
      ).to.be.revertedWith("OnlyTokenOwner");
    });

    it("should succeed if called by cover owner", async function (this: Arguments) {
      // Update the cover by the cover owner
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.coverOwner,
        ).updateCover(
          this.args.coverId,
          this.args.coverToAdd,
          this.args.coverToRemove,
          this.args.premiumsToAdd,
          this.args.premiumsToRemove,
        ),
      ).to.not.throw;
    });

    it("should purge expired covers from the pool", async function (this: Arguments) {
      // Expire a cover and then attempt to update it
      await this.contracts.LiquidityManager.registerExpiredCover(
        this.args.coverId,
        this.args.poolId,
      );
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.coverOwner,
        ).updateCover(
          this.args.coverId,
          this.args.coverToAdd,
          this.args.coverToRemove,
          this.args.premiumsToAdd,
          this.args.premiumsToRemove,
        ),
      ).to.not.throw; // Check if the updateCover function purges expired covers
    });

    it("should update the cover and handle premiums correctly", async function (this: Arguments) {
      // Initially register and buy a cover
      await this.contracts.LiquidityManager.registerAndBuyCover(
        this.args.coverId,
        this.args.poolId,
        this.args.coverAmount,
        this.args.initialPremiums,
      );

      // Update the cover with added cover and premiums
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.coverOwner,
        ).updateCover(
          this.args.coverId,
          this.args.coverToAdd,
          this.args.coverToRemove,
          this.args.premiumsToAdd,
          this.args.premiumsToRemove,
        ),
      ).to.not.throw;

      // Retrieve the updated cover information
      const cover = await this.contracts.LiquidityManager._covers(
        this.args.coverId,
      );

      // Check if the cover amount and premiums are updated correctly
      expect(cover.coverAmount).to.equal(
        this.args.coverAmount + this.args.coverToAdd - this.args.coverToRemove,
      );
      const premiums = await this.contracts.TestableVirtualPool.coverPremiums(
        this.args.coverId,
      ).premiumsLeft;
      expect(premiums).to.equal(
        this.args.initialPremiums +
          this.args.premiumsToAdd -
          this.args.premiumsToRemove,
      );
    });

    it("should revert if the pool is paused", async function (this: Arguments) {
      // Pause the pool
      await this.contracts.TestableVirtualPool.setPoolPause(
        this.args.poolId,
        true,
      );

      // Attempt to update a cover in a paused pool
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.coverOwner,
        ).updateCover(
          this.args.coverId,
          this.args.coverToAdd,
          this.args.coverToRemove,
          this.args.premiumsToAdd,
          this.args.premiumsToRemove,
        ),
      ).to.be.revertedWith("PoolIsPaused");

      // Reset pool pause for subsequent tests
      await this.contracts.TestableVirtualPool.setPoolPause(
        this.args.poolId,
        false,
      );
    });

    it("should revert if the cover is already expired", async function (this: Arguments) {
      // Simulate an expired cover
      await this.contracts.LiquidityManager.registerExpiredCover(
        this.args.coverId,
        this.args.poolId,
      );

      // Attempt to update an expired cover
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.coverOwner,
        ).updateCover(
          this.args.coverId,
          this.args.coverToAdd,
          this.args.coverToRemove,
          this.args.premiumsToAdd,
          this.args.premiumsToRemove,
        ),
      ).to.be.revertedWith("CoverIsExpired");
    });

    it("should handle the complete removal of premiums correctly", async function (this: Arguments) {
      // Register a cover and add premiums
      await this.contracts.LiquidityManager.registerAndBuyCover(
        this.args.coverId,
        this.args.poolId,
        this.args.coverAmount,
        this.args.initialPremiums,
      );

      // Update the cover to remove all premiums
      await this.contracts.LiquidityManager.connect(
        this.signers.coverOwner,
      ).updateCover(this.args.coverId, 0, 0, 0, type(uint256).max);

      // Check if all premiums are removed and cover is expired
      const premiums = await this.contracts.TestableVirtualPool.coverPremiums(
        this.args.coverId,
      ).premiumsLeft;
      expect(premiums).to.equal(0);
      const isCoverActive = await this.contracts.LiquidityManager.isCoverActive(
        this.args.coverId,
      );
      expect(isCoverActive).to.be.false;
    });
  });
}
