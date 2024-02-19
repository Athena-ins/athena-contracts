import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function LiquidityManager_openPosition() {
  context("openPosition", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should create a new LP position with valid parameters", async function (this: Arguments) {
      // Simulate creating a new LP position
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.user,
        ).openPosition(
          this.args.amount,
          this.args.isWrapped,
          this.args.poolIds,
        ),
      ).to.not.throw;

      // Retrieve the created position information
      const tokenId = this.args.nextPositionId; // The next position ID before creating the position
      const position =
        await this.contracts.LiquidityManager._positions(tokenId);

      // Check if the position information is initialized correctly
      expect(position.supplied).to.equal(this.args.expectedSupplied);
      expect(position.commitWithdrawalTimestamp).to.equal(0);
      expect(position.poolIds).to.deep.equal(this.args.poolIds);

      // Check if the position NFT is minted to the user
      const ownerOfPosition =
        await this.contracts.AthenaPositionToken.ownerOf(tokenId);
      expect(ownerOfPosition).to.equal(this.signers.user.address);
    });

    it("should revert if the number of pools exceeds the maximum leverage", async function (this: Arguments) {
      // Attempt to create a position with pool count exceeding max leverage
      const excessPoolIds = new Array(this.args.maxLeverage + 1)
        .fill(0)
        .map((_, i) => i);
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.user,
        ).openPosition(this.args.amount, this.args.isWrapped, excessPoolIds),
      ).to.be.revertedWith("AmountOfPoolsIsAboveMaxLeverage");
    });

    it("should correctly handle wrapped and non-wrapped token deposits", async function (this: Arguments) {
      // Create a position with non-wrapped tokens
      await this.contracts.LiquidityManager.connect(
        this.signers.user,
      ).openPosition(this.args.amount, false, this.args.poolIds);

      // Create a position with wrapped tokens
      await this.contracts.LiquidityManager.connect(
        this.signers.user,
      ).openPosition(this.args.amount, true, this.args.poolIds);

      // Check if the positions are created correctly
      const nonWrappedPosition =
        await this.contracts.LiquidityManager._positions(
          this.args.nextPositionId - 2,
        );
      const wrappedPosition = await this.contracts.LiquidityManager._positions(
        this.args.nextPositionId - 1,
      );

      expect(nonWrappedPosition.supplied).to.equal(
        this.args.expectedSuppliedForNonWrapped,
      );
      expect(wrappedPosition.supplied).to.equal(
        this.args.expectedSuppliedForWrapped,
      );
    });

    it("should check pool compatibility before creating a position", async function (this: Arguments) {
      // Attempt to create a position with incompatible pools
      const incompatiblePools = [this.args.poolId1, this.args.poolId2]; // Assume these pool IDs are incompatible
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.user,
        ).openPosition(
          this.args.amount,
          this.args.isWrapped,
          incompatiblePools,
        ),
      ).to.be.revertedWith("IncompatiblePools");
    });

    it("should register overlapping capital correctly for leveraged positions", async function (this: Arguments) {
      // Create a leveraged position
      await this.contracts.LiquidityManager.connect(
        this.signers.user,
      ).openPosition(
        this.args.amount,
        this.args.isWrapped,
        this.args.leveragedPoolIds,
      );

      // Check if overlapping capital is registered correctly
      for (let i = 0; i < this.args.leveragedPoolIds.length; i++) {
        const poolId = this.args.leveragedPoolIds[i];
        const pool = await this.contracts.TestableVirtualPool.pools(poolId);
        expect(pool.overlaps[poolId]).to.equal(this.args.expectedOverlapAmount);
      }
    });

    it("should mint a position NFT to the position creator", async function (this: Arguments) {
      // Create a new LP position
      await this.contracts.LiquidityManager.connect(
        this.signers.user,
      ).openPosition(this.args.amount, this.args.isWrapped, this.args.poolIds);

      // Check if the position NFT is minted correctly
      const tokenId = this.args.nextPositionId - 1; // The last minted position ID
      const ownerOfToken =
        await this.contracts.AthenaPositionToken.ownerOf(tokenId);
      expect(ownerOfToken).to.equal(this.signers.user.address);
    });

    it("should revert if any pool ID in the array does not exist", async function (this: Arguments) {
      // Attempt to create a position with a non-existent pool ID
      const invalidPoolIds = [this.args.nonExistentPoolId].concat(
        this.args.poolIds,
      );
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.user,
        ).openPosition(this.args.amount, this.args.isWrapped, invalidPoolIds),
      ).to.be.reverted; // Specific error message depends on contract implementation
    });

    it("should correctly update the reward index for the position", async function (this: Arguments) {
      // Create a position
      await this.contracts.LiquidityManager.connect(
        this.signers.user,
      ).openPosition(this.args.amount, this.args.isWrapped, this.args.poolIds);

      // Retrieve the updated reward index for the position
      const tokenId = this.args.nextPositionId - 1; // The last minted position ID
      const rewardIndex =
        await this.contracts.LiquidityManager._posRewardIndex(tokenId);

      // Compare with the expected reward index
      expect(rewardIndex).to.equal(this.args.expectedRewardIndex);
    });

    it("should revert if pool IDs are not unique and in ascending order", async function (this: Arguments) {
      // Attempt to create a position with non-unique or non-ascending pool IDs
      const unorderedPoolIds = [...this.args.poolIds].sort().reverse(); // Assuming this results in a non-ascending order
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.user,
        ).openPosition(this.args.amount, this.args.isWrapped, unorderedPoolIds),
      ).to.be.revertedWith("PoolIdsMustBeUniqueAndAscending");
    });

    it("should handle positions affected by claims correctly", async function (this: Arguments) {
      // Create a position after a claim is created and before compensation
      // Assuming a claim has been created and compensation ID is set accordingly
      await this.contracts.LiquidityManager.connect(
        this.signers.user,
      ).openPosition(this.args.amount, this.args.isWrapped, this.args.poolIds);

      const tokenId = this.args.nextPositionId - 1; // The last minted position ID
      const position =
        await this.contracts.LiquidityManager._positions(tokenId);

      // Check if the position is affected by the claim correctly
      expect(position.commitWithdrawalTimestamp).to.equal(
        this.args.expectedCommitWithdrawalTimestamp,
      );
      // Additional checks for claim impact can be added based on contract logic
    });
  });
}
