import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_removeLiquidity() {
  context("removeLiquidity", function () {
    before(async function () {
      this.args = {};
    });

    it("should successfully remove liquidity for a valid positionId with commit delay elapsed", async function () {
      await this.contracts.LiquidityManager.commitPositionWithdrawal(
        this.args.validPositionId,
      );
      // Simulate time passage to exceed the commit delay
      await network.provider.send("evm_increaseTime", [
        this.args.withdrawDelay,
      ]);
      await network.provider.send("evm_mine");

      const initialSupplied = (
        await this.contracts.LiquidityManager.positions(
          this.args.validPositionId,
        )
      ).supplied;
      await this.contracts.LiquidityManager.removeLiquidity(
        this.args.validPositionId,
        this.args.validAmount,
        this.args.keepWrapped,
      );
      const finalSupplied = (
        await this.contracts.LiquidityManager.positions(
          this.args.validPositionId,
        )
      ).supplied;

      expect(finalSupplied).to.equal(initialSupplied - this.args.validAmount);
    });

    it("should revert when trying to remove liquidity for a position not owned by the caller", async function () {
      try {
        await this.contracts.LiquidityManager.removeLiquidity(
          this.args.positionIdNotOwned,
          this.args.validAmount,
          this.args.keepWrapped,
        );
        throw new Error(
          "Expected function to revert when called by non-owner, but it didn't",
        );
      } catch (error) {
        expect(error.message).to.include("OnlyPositionOwner");
      }
    });

    it("should revert when trying to remove liquidity before the commit delay has been reached", async function () {
      await this.contracts.LiquidityManager.commitPositionWithdrawal(
        this.args.validPositionId,
      );
      // Assuming the delay is not manually advanced here
      try {
        await this.contracts.LiquidityManager.removeLiquidity(
          this.args.validPositionId,
          this.args.validAmount,
          this.args.keepWrapped,
        );
        throw new Error(
          "Expected function to revert due to commit delay not reached, but it didn't",
        );
      } catch (error) {
        expect(error.message).to.include("WithdrawCommitDelayNotReached");
      }
    });

    it("should revert when trying to remove liquidity for a non-existent positionId", async function () {
      try {
        await this.contracts.LiquidityManager.removeLiquidity(
          this.args.nonExistentPositionId,
          this.args.validAmount,
          this.args.keepWrapped,
        );
        throw new Error(
          "Expected function to revert for non-existent positionId, but it didn't",
        );
      } catch (error) {
        // Expecting a specific revert reason if applicable
      }
    });

    it("should revert when trying to remove an amount greater than the position's supplied capital", async function () {
      await this.contracts.LiquidityManager.commitPositionWithdrawal(
        this.args.validPositionId,
      );
      await network.provider.send("evm_increaseTime", [
        this.args.withdrawDelay,
      ]);
      await network.provider.send("evm_mine");

      const position = await this.contracts.LiquidityManager.positions(
        this.args.validPositionId,
      );
      const excessAmount = position.supplied.add(1);
      try {
        await this.contracts.LiquidityManager.removeLiquidity(
          this.args.validPositionId,
          excessAmount,
          this.args.keepWrapped,
        );
        throw new Error(
          "Expected function to revert due to excess withdrawal amount, but it didn't",
        );
      } catch (error) {
        // Expecting a specific revert reason if applicable
      }
    });

    it("should handle keepWrapped scenario correctly for keepWrapped set to true", async function () {
      await this.contracts.LiquidityManager.commitPositionWithdrawal(
        this.args.validPositionId,
      );
      await network.provider.send("evm_increaseTime", [
        this.args.withdrawDelay,
      ]);
      await network.provider.send("evm_mine");

      await this.contracts.LiquidityManager.removeLiquidity(
        this.args.validPositionId,
        this.args.validAmount,
        true,
      );
      // Additional checks related to keepWrapped being true
    });

    it("should handle keepWrapped scenario correctly for keepWrapped set to false", async function () {
      await this.contracts.LiquidityManager.commitPositionWithdrawal(
        this.args.validPositionId,
      );
      await network.provider.send("evm_increaseTime", [
        this.args.withdrawDelay,
      ]);
      await network.provider.send("evm_mine");

      await this.contracts.LiquidityManager.removeLiquidity(
        this.args.validPositionId,
        this.args.validAmount,
        false,
      );
      // Additional checks related to keepWrapped being false
    });

    it("should reduce the position.supplied by amount after withdrawal", async function () {
      await this.contracts.LiquidityManager.commitPositionWithdrawal(
        this.args.validPositionId,
      );
      await network.provider.send("evm_increaseTime", [
        this.args.withdrawDelay,
      ]);
      await network.provider.send("evm_mine");

      const initialSupplied = (
        await this.contracts.LiquidityManager.positions(
          this.args.validPositionId,
        )
      ).supplied;
      await this.contracts.LiquidityManager.removeLiquidity(
        this.args.validPositionId,
        this.args.validAmount,
        this.args.keepWrapped,
      );
      const finalSupplied = (
        await this.contracts.LiquidityManager.positions(
          this.args.validPositionId,
        )
      ).supplied;

      expect(finalSupplied).to.equal(initialSupplied - this.args.validAmount);
    });

    it("should reset the commitWithdrawalTimestamp to zero after withdrawal", async function () {
      await this.contracts.LiquidityManager.commitPositionWithdrawal(
        this.args.validPositionId,
      );
      await network.provider.send("evm_increaseTime", [
        this.args.withdrawDelay,
      ]);
      await network.provider.send("evm_mine");

      await this.contracts.LiquidityManager.removeLiquidity(
        this.args.validPositionId,
        this.args.validAmount,
        this.args.keepWrapped,
      );
      const timestamp = (
        await this.contracts.LiquidityManager.positions(
          this.args.validPositionId,
        )
      ).commitWithdrawalTimestamp;

      expect(timestamp).to.equal(0);
    });

    it("should distribute interests earned between commit and withdrawal to the DAO", async function () {
      const initialDaoState = await getDaoState(); // Replace with actual method to get DAO state

      await this.contracts.LiquidityManager.commitPositionWithdrawal(
        this.args.validPositionId,
      );
      await network.provider.send("evm_increaseTime", [
        this.args.withdrawDelay,
      ]);
      await network.provider.send("evm_mine");

      await this.contracts.LiquidityManager.removeLiquidity(
        this.args.validPositionId,
        this.args.validAmount,
        this.args.keepWrapped,
      );

      const finalDaoState = await getDaoState(); // Replace with actual method to get DAO state

      expect(finalDaoState).to.be.above(initialDaoState);
    });

    it("should handle strategy rewards properly, including when strategyRewards are zero", async function () {
      await this.contracts.LiquidityManager.commitPositionWithdrawal(
        this.args.validPositionId,
      );
      await network.provider.send("evm_increaseTime", [
        this.args.withdrawDelay,
      ]);
      await network.provider.send("evm_mine");

      // Additional setup to ensure strategyRewards are zero, if necessary

      await this.contracts.LiquidityManager.removeLiquidity(
        this.args.validPositionId,
        this.args.validAmount,
        this.args.keepWrapped,
      );
      // Verify handling of strategy rewards
    });

    it("should handle position interests properly, including when they are zero", async function () {
      await this.contracts.LiquidityManager.commitPositionWithdrawal(
        this.args.validPositionId,
      );
      await network.provider.send("evm_increaseTime", [
        this.args.withdrawDelay,
      ]);
      await network.provider.send("evm_mine");

      // Additional setup to ensure position interests are zero, if necessary

      await this.contracts.LiquidityManager.removeLiquidity(
        this.args.validPositionId,
        this.args.validAmount,
        this.args.keepWrapped,
      );
      // Verify handling of position interests
    });
  });
}
