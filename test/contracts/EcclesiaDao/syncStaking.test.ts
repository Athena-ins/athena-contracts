import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function EcclesiaDao_syncStaking() {
  context("syncStaking", function () {
    before(async function () {
      this.args = {};
    });

    it("should successfully sync staking rewards", async function () {
      // Sync staking rewards
      expect(await this.contract.syncStaking()).to.not.throw;
      // Add logic to verify the staking rewards are updated correctly
    });

    it("should increase the contract's token balance by the staking rewards amount", async function () {
      // Get token balance before syncing
      const balBefore = await this.token.balanceOf(this.contract.address);

      // Sync staking rewards
      await this.contract.syncStaking();

      // Get token balance after syncing and calculate staking rewards
      const balAfter = await this.token.balanceOf(this.contract.address);
      const stakingRewards = balAfter.sub(balBefore);

      // Verify the increase in balance is equal to the staking rewards
      expect(stakingRewards).to.be.a("number").that.is.greaterThan(0);
      // Add additional checks as needed
    });

    it("should update the staking index with accrued rewards", async function () {
      // Sync staking rewards and verify the staking index is updated accordingly
      await this.contract.syncStaking();
      // Add logic to check the updated staking index
    });
  });
}
