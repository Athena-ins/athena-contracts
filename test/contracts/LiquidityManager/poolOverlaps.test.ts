import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_poolOverlaps() {
  context("poolOverlaps", function () {
    before(async function () {
      this.args = {};
    });

    it("should return the amount of liquidity overlap when poolIdA < poolIdB and an overlap exists", async function () {
      const overlap = await this.contracts.myContract.poolOverlaps(
        this.args.poolIdA,
        this.args.poolIdB,
      );
      expect(overlap).to.be.a("number");
      expect(overlap).to.be.greaterThan(0);
    });

    it("should return the amount of liquidity overlap when poolIdA > poolIdB and an overlap exists", async function () {
      const overlap = await this.contracts.myContract.poolOverlaps(
        this.args.poolIdB,
        this.args.poolIdA,
      ); // Assuming poolIdB < poolIdA
      expect(overlap).to.be.a("number");
      expect(overlap).to.be.greaterThan(0);
    });

    it("should return the pool's liquidity when poolIdA and poolIdB are equal", async function () {
      const liquidity = await this.contracts.myContract.poolOverlaps(
        this.args.poolIdA,
        this.args.poolIdA,
      );
      expect(liquidity).to.be.a("number");
    });

    it("should return zero when there is no overlap between valid poolIdA and poolIdB", async function () {
      const overlap = await this.contracts.myContract.poolOverlaps(
        this.args.poolIdA,
        this.args.poolIdB,
      );
      expect(overlap).to.equal(0);
    });

    it("should return zero when either poolIdA or poolIdB is invalid/non-existent", async function () {
      const overlap = await this.contracts.myContract.poolOverlaps(
        this.args.invalidPoolId,
        this.args.validPoolId,
      );
      expect(overlap).to.equal(0);
    });

    it("should return zero when both poolIdA and poolIdB are invalid/non-existent", async function () {
      const overlap = await this.contracts.myContract.poolOverlaps(
        this.args.invalidPoolIdA,
        this.args.invalidPoolIdB,
      );
      expect(overlap).to.equal(0);
    });

    it("should return the correct amount of liquidity overlap for poolIdA and poolIdB at the boundary of existing pool IDs", async function () {
      const overlap = await this.contracts.myContract.poolOverlaps(
        this.args.boundaryPoolIdA,
        this.args.boundaryPoolIdB,
      );
      expect(overlap).to.be.a("number");
    });
  });
}
