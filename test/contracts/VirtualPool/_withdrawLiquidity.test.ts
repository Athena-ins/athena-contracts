import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool__withdrawLiquidity() {
  context("_withdrawLiquidity", function () {
    before(async function () {
      this.args = {};
    });

    it("should correctly withdraw liquidity and update the pool's state", async function () {
      // Withdraw liquidity and store the returned values
      const [newUserCapital, strategyRewards] =
        await this.contracts.LiquidityManager.withdrawLiquidity(
          this.args.tokenId,
          this.args.amount,
          this.args.poolIds,
        );

      // Check if the returned newUserCapital matches the expected value
      expect(newUserCapital).to.equal(this.args.expectedNewUserCapital);

      // Check if the returned strategyRewards matches the expected value
      expect(strategyRewards).to.equal(this.args.expectedStrategyRewards);

      // Check if the liquidity index of the pool is updated correctly
      const liquidityIndex =
        await this.contracts.LiquidityManager.liquidityIndex();
      expect(liquidityIndex).to.equal(this.args.expectedLiquidityIndex);
    });

    it("should pay the cover rewards to the DAO's leverage risk wallet", async function () {
      // Withdraw liquidity and verify rewards payment to the DAO's leverage risk wallet
      await this.contracts.LiquidityManager.withdrawLiquidity(
        this.args.tokenId,
        this.args.amount,
        this.args.poolIds,
      );
      // Add logic to verify that the cover rewards are paid to the DAO's leverage risk wallet
    });

    it("should update the user's capital in the pool", async function () {
      // Withdraw liquidity and verify the user's capital update
      const [newUserCapital, _] =
        await this.contracts.LiquidityManager.withdrawLiquidity(
          this.args.tokenId,
          this.args.amount,
          this.args.poolIds,
        );
      // Check if newUserCapital is updated as expected
      expect(newUserCapital).to.equal(this.args.expectedNewUserCapital);
    });
  });
}
