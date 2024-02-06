import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_covers() {
  context("covers", function () {
    before(async function () {
      this.args = {};
    });

    it("should return the correct cover data for a valid coverId that exists", async function () {
      const coverData = await this.contracts.LiquidityManager.covers(
        this.args.validCoverId,
      );
      expect(coverData.coverId).to.equal(this.args.validCoverId);
      expect(coverData.coverAmount).to.be.a("number");
      expect(coverData.start).to.be.a("number");
      expect(coverData.end).to.be.a("number");
      expect(coverData.premiumsLeft).to.be.a("number");
      expect(coverData.dailyCost).to.be.a("number");
      expect(coverData.premiumRate).to.be.a("number");
    });

    it("should return default or empty data for a coverId that does not exist", async function () {
      const coverData = await this.contracts.LiquidityManager.covers(
        this.args.nonExistentCoverId,
      );
      expect(coverData).to.deep.equal({});
    });

    it("should return correct cover data for a coverId at the boundary of existing IDs", async function () {
      const coverData = await this.contracts.LiquidityManager.covers(
        this.args.boundaryCoverId,
      );
      expect(coverData.coverId).to.equal(this.args.boundaryCoverId);
    });

    it("should ensure that the returned CoverRead struct fields match the underlying Cover struct and corresponding VirtualPool.CoverInfo", async function () {
      const coverData = await this.contracts.LiquidityManager.covers(
        this.args.validCoverId,
      );

      expect(coverData.coverId).to.equal(this.args.validCoverId);
      expect(coverData.poolId).to.equal(this.args.poolIdExpected);
      expect(coverData.coverAmount).to.equal(this.args.coverAmountExpected);
      expect(coverData.start).to.equal(this.args.startExpected);
      expect(coverData.end).to.equal(this.args.endExpected);
      expect(coverData.premiumsLeft).to.equal(this.args.premiumsLeftExpected);
      expect(coverData.dailyCost).to.equal(this.args.dailyCostExpected);
      expect(coverData.premiumRate).to.equal(this.args.premiumRateExpected);
    });
  });
}
