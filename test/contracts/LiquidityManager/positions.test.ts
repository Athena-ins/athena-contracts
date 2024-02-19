import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function LiquidityManager_positions() {
  context("positions", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should return correct position data for a valid positionId that exists", async function (this: Arguments) {
      const positionData = await this.contracts.LiquidityManager.positions(
        this.args.validPositionId,
      );
      expect(positionData.supplied).to.be.a("number");
      expect(positionData.commitWithdrawalTimestamp).to.be.a("number");
      expect(positionData.poolIds).to.be.an("array");
    });

    it("should return default or empty data for a positionId that does not exist", async function (this: Arguments) {
      const positionData = await this.contracts.LiquidityManager.positions(
        this.args.nonExistentPositionId,
      );
      expect(positionData.supplied).to.equal(0);
      expect(positionData.commitWithdrawalTimestamp).to.equal(0);
      expect(positionData.poolIds).to.deep.equal([]);
    });

    it("should return correct position data for a positionId at the boundary of existing IDs", async function (this: Arguments) {
      const positionData = await this.contracts.LiquidityManager.positions(
        this.args.boundaryPositionId,
      );
      expect(positionData.supplied).to.be.a("number");
      expect(positionData.commitWithdrawalTimestamp).to.be.a("number");
      expect(positionData.poolIds).to.be.an("array");
    });
  });
}
