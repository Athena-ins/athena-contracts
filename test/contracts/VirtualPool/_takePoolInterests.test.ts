import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool__takePoolInterests() {
  context("_takePoolInterests", function () {
    before(async function () {
      this.args = {};
    });

    it("should correctly take pool interests and update the position's state", async function () {
      // Take pool interests and store the returned values
      const [newUserCapital, coverRewards] =
        await this.contracts.TestableVirtualPool.takePoolInterests(
          this.args.tokenId,
          this.args.account,
          this.args.amount,
          this.args.yieldBonus,
          this.args.poolIds,
        );

      // Check if the returned newUserCapital matches the expected value
      expect(newUserCapital).to.equal(this.args.expectedNewUserCapital);

      // Check if the returned coverRewards matches the expected value
      expect(coverRewards).to.equal(this.args.expectedCoverRewards);

      // Check if the LpInfo of the position is updated correctly
      const lpInfo = await this.contracts.TestableVirtualPool.lpInfos(
        this.args.tokenId,
      );
      expect(lpInfo.beginLiquidityIndex).to.equal(
        this.args.expectedBeginLiquidityIndex,
      );
      expect(lpInfo.beginClaimIndex).to.equal(
        this.args.expectedBeginClaimIndex,
      );
    });

    it("should pay the cover rewards to the account and send fees to the treasury", async function () {
      // Take pool interests and verify rewards payment and fees
      await this.contracts.TestableVirtualPool.takePoolInterests(
        this.args.tokenId,
        this.args.account,
        this.args.amount,
        this.args.yieldBonus,
        this.args.poolIds,
      );
      // Add logic to verify that the rewards are paid to the account and fees are sent to the treasury
    });

    it("should update the user's capital and strategy rewards in the pool", async function () {
      // Take pool interests and verify the user's capital and strategy rewards update
      const [newUserCapital, strategyRewards] =
        await this.contracts.TestableVirtualPool.takePoolInterests(
          this.args.tokenId,
          this.args.account,
          this.args.amount,
          this.args.yieldBonus,
          this.args.poolIds,
        );
      // Check if newUserCapital and strategyRewards are updated as expected
      expect(newUserCapital).to.equal(this.args.expectedNewUserCapital);
      expect(strategyRewards).to.equal(this.args.expectedStrategyRewards);
    });
  });
}
