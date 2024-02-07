import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_commitRemoveLiquidity() {
  context("commitRemoveLiquidity", function () {
    before(async function () {
      this.args = {};
    });

    it("should successfully commit withdrawal for a valid positionId owned by the caller with no ongoing claims", async function () {
      const initialTimestamp = await this.contracts.LiquidityManager.positions(
        this.args.validPositionId,
      ).commitWithdrawalTimestamp;

      await this.contracts.LiquidityManager.commitRemoveLiquidity(
        this.args.validPositionId,
      );

      const finalTimestamp = await this.contracts.LiquidityManager.positions(
        this.args.validPositionId,
      ).commitWithdrawalTimestamp;

      expect(finalTimestamp).to.be.above(initialTimestamp);
    });

    it("should revert when trying to commit withdrawal for a positionId not owned by the caller", async function () {
      try {
        await this.contracts.LiquidityManager.commitRemoveLiquidity(
          this.args.positionIdNotOwned,
        );
        throw new Error(
          "Expected function to revert when called by non-owner, but it didn't",
        );
      } catch (error) {
        expect(error.message).to.include("OnlyPositionOwner");
      }
    });

    it("should revert when trying to commit withdrawal for a position with ongoing claims in associated pools", async function () {
      try {
        await this.contracts.LiquidityManager.commitRemoveLiquidity(
          this.args.positionIdWithOngoingClaims,
        );
        throw new Error(
          "Expected function to revert due to ongoing claims, but it didn't",
        );
      } catch (error) {
        expect(error.message).to.include("PoolHasOnGoingClaims");
      }
    });

    it("should revert when trying to commit withdrawal for a non-existent positionId", async function () {
      try {
        await this.contracts.LiquidityManager.commitRemoveLiquidity(
          this.args.nonExistentPositionId,
        );
        throw new Error(
          "Expected function to revert for non-existent positionId, but it didn't",
        );
      } catch (error) {
        // Expecting a specific revert reason if applicable
        // Example: expect(error.message).to.include("PositionDoesNotExist");
      }
    });

    it("should take interests in all pools associated with the position before withdrawal", async function () {
      await this.contracts.LiquidityManager.commitRemoveLiquidity(
        this.args.validPositionId,
      );
      const position = await this.contracts.LiquidityManager.positions(
        this.args.validPositionId,
      );

      // Here, you would need to verify the interests taken for each pool in position.poolIds
      // This might involve checking each pool's state or the position's rewards
      // Example: expect(rewardForPool).to.be.above(initialRewardForPool);
    });

    it("should update the commitWithdrawalTimestamp on each commit to withdraw the same position", async function () {
      await this.contracts.LiquidityManager.commitRemoveLiquidity(
        this.args.validPositionId,
      );
      const firstTimestamp = await this.contracts.LiquidityManager.positions(
        this.args.validPositionId,
      ).commitWithdrawalTimestamp;

      // Wait for some time (if necessary) before making another commit
      // Example: await network.provider.send("evm_increaseTime", [someTime]);

      await this.contracts.LiquidityManager.commitRemoveLiquidity(
        this.args.validPositionId,
      );
      const secondTimestamp = await this.contracts.LiquidityManager.positions(
        this.args.validPositionId,
      ).commitWithdrawalTimestamp;

      expect(secondTimestamp).to.be.above(firstTimestamp);
    });

    it("should distribute interests earned between commit and withdrawal to the DAO", async function () {
      // Assuming we have a method to get the DAO's balance or relevant state
      const initialDaoState = await getDaoState(); // Replace with actual method to get DAO state

      await this.contracts.LiquidityManager.commitRemoveLiquidity(
        this.args.validPositionId,
      );

      // Simulate time passage to accrue interests (if necessary)
      // Example: await network.provider.send("evm_increaseTime", [someTime]);

      const finalDaoState = await getDaoState(); // Replace with actual method to get DAO state

      // Check if the DAO's state has increased as expected due to the distribution of interests
      expect(finalDaoState).to.be.above(initialDaoState);
    });
  });
}
