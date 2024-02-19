import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function LiquidityManager_uncommitRemoveLiquidity() {
  context("uncommitRemoveLiquidity", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });
    it("should successfully uncommit a committed position owned by the caller", async function (this: Arguments) {
      // First, commit the position to set the commitWithdrawalTimestamp
      await this.contracts.LiquidityManager.commitRemoveLiquidity(
        this.args.validPositionId,
      );

      const committedTimestamp =
        await this.contracts.LiquidityManager.positions(
          this.args.validPositionId,
        ).commitWithdrawalTimestamp;
      expect(committedTimestamp).to.be.above(0);

      // Now, uncommit the position
      await this.contracts.LiquidityManager.uncommitRemoveLiquidity(
        this.args.validPositionId,
      );

      const uncommittedTimestamp =
        await this.contracts.LiquidityManager.positions(
          this.args.validPositionId,
        ).commitWithdrawalTimestamp;
      expect(uncommittedTimestamp).to.equal(0);
    });

    it("should revert when trying to uncommit a position not owned by the caller", async function (this: Arguments) {
      try {
        await this.contracts.LiquidityManager.uncommitRemoveLiquidity(
          this.args.positionIdNotOwned,
        );
        throw new Error(
          "Expected function to revert when called by non-owner, but it didn't",
        );
      } catch (error) {
        expect(error.message).to.include("OnlyPositionOwner");
      }
    });

    it("should revert when trying to uncommit a position that is not committed", async function (this: Arguments) {
      try {
        await this.contracts.LiquidityManager.uncommitRemoveLiquidity(
          this.args.uncommittedPositionId,
        );
        throw new Error(
          "Expected function to revert for uncommitted position, but it didn't",
        );
      } catch (error) {
        expect(error.message).to.include("PositionNotCommited");
      }
    });

    it("should revert when trying to uncommit a non-existent positionId", async function (this: Arguments) {
      try {
        await this.contracts.LiquidityManager.uncommitRemoveLiquidity(
          this.args.nonExistentPositionId,
        );
        throw new Error(
          "Expected function to revert for non-existent positionId, but it didn't",
        );
      } catch (error) {
        // Expecting a specific revert reason if applicable
      }
    });

    it("should reset the commitWithdrawalTimestamp to zero after uncommitting", async function (this: Arguments) {
      await this.contracts.LiquidityManager.commitRemoveLiquidity(
        this.args.validPositionId,
      );
      await this.contracts.LiquidityManager.uncommitRemoveLiquidity(
        this.args.validPositionId,
      );
      const timestamp = await this.contracts.LiquidityManager.positions(
        this.args.validPositionId,
      ).commitWithdrawalTimestamp;
      expect(timestamp).to.equal(0);
    });

    it("should redirect interest back to the position owner after uncommitting", async function (this: Arguments) {
      const initialOwnerReward =
        await this.contracts.LiquidityManager.getOwnerReward(
          this.args.positionOwner,
        ); // Replace with actual method to get owner reward
      await this.contracts.LiquidityManager.commitRemoveLiquidity(
        this.args.validPositionId,
      );
      await this.contracts.LiquidityManager.uncommitRemoveLiquidity(
        this.args.validPositionId,
      );
      const finalOwnerReward =
        await this.contracts.LiquidityManager.getOwnerReward(
          this.args.positionOwner,
        ); // Replace with actual method to get owner reward
      expect(finalOwnerReward).to.be.above(initialOwnerReward);
    });
  });
}
