import { expect } from "chai";
import { ethers } from "hardhat";
// Helpers
import {} from "../helpers/hardhat";

const { parseUnits } = ethers.utils;

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

    it("accepts LPs", async function () {
      expect(
        await this.helpers.createPosition(
          this.signers.deployer,
          parseUnits("1000", 6),
          false,
          [0],
        ),
      ).to.not.throw;

      expect(
        await this.contracts.AthenaPositionToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(1);

      const position = await this.contracts.LiquidityManager.positions(0);

      expect(position.poolIds.length).to.equal(1);
      expect(position.poolIds[0]).to.equal(0);
      expect(position.supplied).to.equal(parseUnits("1000", 6));
    });
    it("accepts covers", async function () {
      expect(
        await this.helpers.buyCover(
          this.signers.deployer,
          0,
          parseUnits("500", 6),
          parseUnits("20", 6),
        ),
      ).to.not.throw;

      expect(
        await this.contracts.AthenaCoverToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(1);

      const cover = await this.contracts.LiquidityManager.covers(0);

      expect(cover.poolId).to.equal(0);
      expect(cover.coverAmount).to.equal(parseUnits("500", 6));
      expect(cover.premiums).to.equal(parseUnits("20", 6));
      expect(cover.start.div(10)).to.equal(170473365);
      expect(cover.end).to.equal(0);
    });

    // it("has coherent state", async function () {});
    // it("has lasting coherent state ", async function () {});

    it("can increase LPs", async function () {
      expect(
        await this.helpers.increasePosition(
          this.signers.deployer,
          0,
          parseUnits("1000", 6),
          false,
        ),
      ).to.not.throw;

      expect(
        await this.contracts.AthenaPositionToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(1);

      const position = await this.contracts.LiquidityManager.positions(0);

      expect(position.poolIds.length).to.equal(1);
      expect(position.poolIds[0]).to.equal(0);
      expect(position.supplied).to.equal(parseUnits("2000", 6));
    });
    it("can increase cover & premiums", async function () {
      expect(
        await this.helpers.updateCover(
          this.signers.deployer,
          0,
          parseUnits("1000", 6),
          0,
          parseUnits("50", 6),
          0,
        ),
      ).to.not.throw;

      expect(
        await this.contracts.AthenaCoverToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(1);

      const cover = await this.contracts.LiquidityManager.covers(0);

      expect(cover.poolId).to.equal(0);
      expect(cover.coverAmount).to.equal(parseUnits("1500", 6));
      expect(cover.premiums).to.equal(parseUnits("70", 6));
      expect(cover.start.div(10)).to.equal(170473365);
      expect(cover.end).to.equal(0);
    });

    // it("has coherent state", async function () {});
    // it("has lasting coherent state", async function () {});

    // it("can decrease cover amount", async function () {});
    // it("can decrease cover premiums", async function () {});

    // it("has coherent state", async function () {});
    // it("has lasting coherent state", async function () {});

    it("can close cover", async function () {});
    it("can close LPs", async function () {});

    it("has coherent state", async function () {});
    it("has lasting coherent state", async function () {});
  });
}
