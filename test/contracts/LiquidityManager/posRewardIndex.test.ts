import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_posRewardIndex() {
  context("posRewardIndex", function () {
    before(async function () {
      this.args = {};
    });

    it("should return the correct strategy reward index for a valid positionId that exists", async function () {
      const rewardIndex = await this.contracts.LiquidityManager.posRewardIndex(
        this.args.validPositionId,
      );
      expect(rewardIndex).to.be.a("number");
    });

    it("should return zero for a positionId that does not exist", async function () {
      const rewardIndex = await this.contracts.LiquidityManager.posRewardIndex(
        this.args.nonExistentPositionId,
      );
      expect(rewardIndex).to.equal(0);
    });

    it("should return the correct strategy reward index for a positionId at the boundary of existing IDs", async function () {
      const rewardIndex = await this.contracts.LiquidityManager.posRewardIndex(
        this.args.boundaryPositionId,
      );
      expect(rewardIndex).to.be.a("number");
    });
  });
}
