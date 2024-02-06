import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool__payRewardsAndFees() {
  context("_payRewardsAndFees", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the rewards are less than the fees and yield bonus", async function () {
      // Attempt to pay rewards when the rewards are insufficient to cover fees and yield bonus
      expect(
        await this.contracts.TestableVirtualPool.payRewardsAndFees(
          this.args.insufficientRewards, // Rewards less than fees and yield bonus
          this.args.account,
          this.args.yieldBonus,
          this.args.nbPools,
        ),
      ).to.be.revertedWith("Some Error Related to Insufficient Rewards"); // Replace with the actual error message
    });

    it("should apply leverage fee only when using leverage", async function () {
      // Pay rewards with leverage and check for leverage fee application
      expect(
        await this.contracts.TestableVirtualPool.payRewardsAndFees(
          this.args.rewards,
          this.args.account,
          this.args.yieldBonus,
          this.args.nbPoolsWithLeverage, // Number of pools indicating leverage use
        ),
      ).to.not.throw;
      // Verify that leverage fee is applied
      // Additional checks can be implemented for exact fee calculations
    });

    it("should transfer net rewards to the position owner", async function () {
      // Pay rewards and verify the net amount is transferred to the position owner
      await this.contracts.TestableVirtualPool.payRewardsAndFees(
        this.args.rewards,
        this.args.account, // Position owner
        this.args.yieldBonus,
        this.args.nbPools,
      );
      // Add logic to verify the net rewards transfer to the position owner
    });

    it("should pay fees to the treasury and leverage risk wallet", async function () {
      // Pay rewards and verify fees are paid to the treasury and leverage risk wallet
      await this.contracts.TestableVirtualPool.payRewardsAndFees(
        this.args.rewards,
        this.args.account,
        this.args.yieldBonus,
        this.args.nbPools,
      );
      // Add logic to verify fees payment to the treasury and leverage risk wallet
    });

    it("should accrue revenue to the DAO for the fees", async function () {
      // Pay rewards and check if the fees are accrued as revenue to the DAO
      await this.contracts.TestableVirtualPool.payRewardsAndFees(
        this.args.rewards,
        this.args.daoAccount, // DAO account
        this.args.yieldBonus,
        this.args.nbPools,
      );
      // Add logic to verify revenue accrual to the DAO
    });
  });
}
