import { expect } from "chai";
import { ethers } from "hardhat";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../helpers/hardhat";
import { toUsd, toErc20 } from "../helpers/protocol";
import { BigNumber } from "ethers";

export function liquidityManager() {
  context("Liquidity Manager", function () {
    before(async function () {
      this.args = {
        daoStakeAmount: toErc20(1000),
        daoLockDuration: 60 * 60 * 24 * 365,
        lpAmount: toUsd(1000),
        coverAmount: toUsd(1000),
        coverPremiums: toUsd(100),
        claimAmount: toUsd(1000),
        lpIncreaseAmount: toUsd(1500),
        coverIncreaseAmount: toUsd(400),
        coverIncreasePremiums: toUsd(50),
      };
    });

    it("creates lock in dao", async function () {
      expect(
        this.helpers.createDaoLock(
          this.signers.deployer,
          this.args.daoStakeAmount,
          this.args.daoLockDuration,
        ),
      ).to.not.throw;
    });

    it("can create pools", async function () {
      // Create a pool
      expect(
        await postTxHandler(
          this.contracts.LiquidityManager.createPool(
            this.contracts.TetherToken.address, // paymentAsset
            0, // strategyId
            0, // protocolShare
            ...this.protocolConfig.poolMarket,
            [], // compatiblePools
          ),
        ),
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
          this.args.lpAmount,
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
      expect(position.supplied).to.equal(this.args.lpAmount);
    });

    it("accepts covers", async function () {
      expect(
        await this.helpers.buyCover(
          this.signers.deployer,
          0,
          this.args.coverAmount,
          this.args.coverPremiums,
        ),
      ).to.not.throw;

      await setNextBlockTimestamp({ days: 5 });

      expect(
        await this.contracts.AthenaCoverToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(1);

      const cover = await this.contracts.LiquidityManager.covers(0);
      // console.log("cover: ", cover);

      expect(cover.poolId).to.equal(0);
      expect(cover.coverAmount).to.equal(this.args.coverAmount);
      expect(cover.premiums).to.equal(this.args.coverPremiums);
      expect(cover.start.div(100)).to.equal(17047336);
      expect(cover.end).to.equal(0);
    });

    // it("has coherent state", async function () {});

    it("can create claim", async function () {});
    it("can resolve claim", async function () {});

    // it("has coherent state", async function () {});

    it("can increase LPs", async function () {
      expect(
        await this.helpers.increasePosition(
          this.signers.deployer,
          0,
          this.args.lpIncreaseAmount,
          false,
        ),
      ).to.not.throw;

      await setNextBlockTimestamp({ days: 5 });

      expect(
        await this.contracts.AthenaPositionToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(1);

      const position = await this.contracts.LiquidityManager.positions(0);

      expect(position.poolIds.length).to.equal(1);
      expect(position.poolIds[0]).to.equal(0);
      expect(position.supplied).to.equal(
        this.args.lpIncreaseAmount.add(this.args.lpAmount),
      );
    });

    it("can increase cover & premiums", async function () {
      expect(
        await this.helpers.updateCover(
          this.signers.deployer,
          0,
          this.args.coverIncreaseAmount,
          0,
          this.args.coverIncreasePremiums,
          0,
        ),
      ).to.not.throw;

      await setNextBlockTimestamp({ days: 5 });

      expect(
        await this.contracts.AthenaCoverToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(1);

      const cover = await this.contracts.LiquidityManager.covers(0);
      // console.log('cover: ', cover);

      expect(cover.poolId).to.equal(0);
      expect(cover.coverAmount).to.equal(
        this.args.coverIncreaseAmount.add(this.args.coverAmount),
      );
      expect(cover.premiumsLeft).to.equal(60037622);
      expect(cover.start.div(100)).to.equal(17047336);
      expect(cover.end).to.equal(0);
    });

    // it("has coherent state", async function () {});

    // it("can decrease cover amount", async function () {});
    // it("can decrease cover premiums", async function () {});

    // it("has coherent state", async function () {});

    it("can close cover", async function () {
      const uint256Max = BigNumber.from(2).pow(256).sub(1);
      expect(
        await postTxHandler(
          this.contracts.LiquidityManager.updateCover(0, 0, 0, 0, uint256Max),
        ),
      ).to.not.throw;

      expect(
        await this.contracts.AthenaCoverToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(1);

      const cover = await this.contracts.LiquidityManager.covers(0);

      expect(cover.poolId).to.equal(0);
      expect(cover.coverAmount).to.equal(
        this.args.coverIncreaseAmount.add(this.args.coverAmount),
      );
      expect(cover.premiumsLeft).to.equal(0);
      expect(cover.start.div(100)).to.equal(17047336);
      expect(cover.end.div(100)).to.equal(17060296);
    });

    it("can commit LPs withdrawal", async function () {
      await setNextBlockTimestamp({ days: 365 });

      expect(
        await postTxHandler(
          this.contracts.LiquidityManager.commitPositionWithdrawal(0),
        ),
      ).to.not.throw;

      const position = await this.contracts.LiquidityManager.positions(0);
      // expect(position.commitWithdrawalTimestamp.div(100)).to.equal(17060296);
    });

    it("can withdraw LPs", async function () {
      // Wait for unlock delay to pass
      await setNextBlockTimestamp({ days: 15 });

      expect(
        await postTxHandler(
          this.contracts.LiquidityManager.closePosition(0, false),
        ),
      ).to.not.throw;

      const position = await this.contracts.LiquidityManager.positions(0);

      expect(position.poolIds.length).to.equal(1);
      expect(position.poolIds[0]).to.equal(0);
      expect(position.supplied).to.equal(0);
      // expect(position.commitWithdrawalTimestamp.div(100)).to.equal(17060296);
    });

    // it("has coherent state", async function () {});
  });
}
