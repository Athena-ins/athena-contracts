import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool__depositToPool() {
  context("_depositToPool", function () {
    before(async function () {
      this.args = {};
    });

    it("should correctly add liquidity to the pool and update its state", async function () {
      // Deposit liquidity to the pool
      expect(
        await this.contracts.LiquidityManager.depositToPool(
          this.args.tokenId,
          this.args.amount,
        ),
      ).to.not.throw;

      // Check if the liquidity is correctly added to the pool
      const liquidity = await this.contracts.LiquidityManager.totalLiquidity();
      expect(liquidity).to.equal(this.args.expectedTotalLiquidityAfterDeposit);

      // Check if the pool's state is updated correctly
      const lpInfo = await this.contracts.LiquidityManager.lpInfos(
        this.args.tokenId,
      );
      expect(lpInfo.beginLiquidityIndex).to.equal(
        this.args.expectedLiquidityIndex,
      );
      expect(lpInfo.beginClaimIndex).to.equal(this.args.expectedClaimIndex);
    });

    it("should revert if the added liquidity results in not enough liquidity for removal", async function () {
      // Attempt to add liquidity that results in not enough liquidity for removal
      expect(
        await this.contracts.LiquidityManager.depositToPool(
          this.args.tokenId,
          this.args.amountLeadingToLiquidityShortage,
        ),
      ).to.be.revertedWith("NotEnoughLiquidityForRemoval");
    });

    it("should update the LP info with the current liquidity index and claim index", async function () {
      // Deposit liquidity and verify LP info update
      await this.contracts.LiquidityManager.depositToPool(
        this.args.tokenId,
        this.args.amount,
      );
      const lpInfo = await this.contracts.LiquidityManager.lpInfos(
        this.args.tokenId,
      );

      // Check if the LP info is updated with the current liquidity index and claim index
      expect(lpInfo.beginLiquidityIndex).to.equal(
        this.args.expectedCurrentLiquidityIndex,
      );
      expect(lpInfo.beginClaimIndex).to.equal(
        this.args.expectedCurrentClaimIndex,
      );
    });

    it("should overwrite previous LP info after a withdrawal", async function () {
      // Withdraw and then deposit liquidity to verify LP info overwriting
      await this.contracts.LiquidityManager.withdrawFromPool(
        this.args.tokenId,
        this.args.withdrawAmount,
      );
      await this.contracts.LiquidityManager.depositToPool(
        this.args.tokenId,
        this.args.amount,
      );
      const lpInfo = await this.contracts.LiquidityManager.lpInfos(
        this.args.tokenId,
      );

      // Check if the LP info is overwritten after the withdrawal and subsequent deposit
      expect(lpInfo.beginLiquidityIndex).to.not.equal(
        this.args.liquidityIndexBeforeWithdrawal,
      );
      expect(lpInfo.beginClaimIndex).to.not.equal(
        this.args.claimIndexBeforeWithdrawal,
      );
    });
  });
}
