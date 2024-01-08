import { expect } from "chai";
import { ethers } from "hardhat";
// Helpers
import {} from "../helpers/hardhat";

export function liquidityManager() {
  context("Liquidity Manager", function () {
    before(async function () {});

    it("can create pools", async function () {
      // Create a pool
      expect(
        await this.contracts.LiquidityManager.createPool(
          this.contracts.TetherToken.address, // paymentAsset
          0, // strategyId
          0, // protocolShare
          ...this.protocolConfig.poolMarket,
          [], // compatiblePools
        ).then((tx) => tx.wait()),
      ).to.not.throw;

      // Check pool info
      const poolInfo = await this.contracts.LiquidityManager.poolInfo(0);
      expect(poolInfo.paymentAsset.toLowerCase()).to.equal(
        this.contracts.TetherToken.address,
      );
      expect(poolInfo.underlyingAsset.toLowerCase()).to.equal(
        this.contracts.TetherToken.address,
      );
      expect(poolInfo.protocolShare).to.equal(0);
      expect(poolInfo.strategyId).to.equal(0);
      expect(poolInfo.formula.uOptimal).to.equal(
        this.protocolConfig.poolMarket[0],
      );
      expect(poolInfo.formula.r0).to.equal(this.protocolConfig.poolMarket[1]);
      expect(poolInfo.formula.rSlope1).to.equal(
        this.protocolConfig.poolMarket[2],
      );
      expect(poolInfo.formula.rSlope2).to.equal(
        this.protocolConfig.poolMarket[3],
      );
      expect(poolInfo.poolId).to.equal(0);
    });

    it("accepts LPs", async function () {});
    it("accepts covers", async function () {});

    it("has coherent state", async function () {});
    it("has lasting coherent state ", async function () {});

    it("can update LPs", async function () {});
    it("can update cover", async function () {});

    it("has coherent state", async function () {});
    it("has lasting coherent state", async function () {});

    it("can close cover", async function () {});
    it("can close LPs", async function () {});

    it("has coherent state", async function () {});
    it("has lasting coherent state", async function () {});
  });
}
