import { expect } from "chai";
import { ethers } from "hardhat";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../helpers/protocol";
import { BigNumber } from "ethers";

export function liquidityManager() {
  context("Liquidity Manager", function () {
    before(async function () {
      this.args = {
        nbPools: 3,
        daoStakeAmount: toErc20(1000),
        daoLockDuration: 60 * 60 * 24 * 365,
        lpAmount: toUsd(10000),
        coverAmount: toUsd(300),
        coverPremiums: toUsd(200),
        claimAmount: toUsd(200),
        lpIncreaseAmount: toUsd(1500),
        coverIncreaseAmount: toUsd(400),
        coverIncreasePremiums: toUsd(50),
      };
    });

    it("creates lock in dao", async function () {
      expect(
        await this.helpers.createDaoLock(
          this.signers.deployer,
          this.args.daoStakeAmount,
          this.args.daoLockDuration,
        ),
      ).to.not.throw;
    });

    it("can create pools", async function () {
      this.timeout(300_000);

      for (let i = 0; i < this.args.nbPools; i++) {
        const poolId = i;
        // Create a pool
        expect(
          await postTxHandler(
            this.contracts.LiquidityManager.createPool(
              this.contracts.TetherToken.address, // paymentAsset
              0, // strategyId
              0, // feeRate
              ...this.protocolConfig.poolMarket,
              makeIdArray(this.args.nbPools).filter((id) => id != poolId), // compatiblePools
            ),
          ),
        ).to.not.throw;

        // Check pool info
        const poolInfo = await this.contracts.LiquidityManager.poolInfo(poolId);
        expect(poolInfo.paymentAsset.toLowerCase()).to.equal(
          this.contracts.TetherToken.address,
        );
        expect(poolInfo.underlyingAsset.toLowerCase()).to.equal(
          this.contracts.TetherToken.address,
        );
        expect(poolInfo.feeRate).to.equal(0);
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
        expect(poolInfo.poolId).to.equal(poolId);
      }
    });

    it("accepts LPs", async function () {
      this.timeout(300_000);

      expect(
        await this.helpers.createPosition(
          this.signers.deployer,
          this.args.lpAmount,
          false,
          makeIdArray(this.args.nbPools),
        ),
      ).to.not.throw;

      expect(
        await this.contracts.AthenaPositionToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(1);

      const position = await this.contracts.LiquidityManager.positions(0);

      // expect(position.poolIds.length).to.equal(3);
      expect(position.poolIds[0]).to.equal(0);
      expect(position.poolIds[1]).to.equal(1);
      expect(position.poolIds[2]).to.equal(2);
      expect(position.supplied).to.equal(this.args.lpAmount);
    });

    it("accepts covers", async function () {
      this.timeout(300_000);

      for (let i = 0; i < this.args.nbPools; i++) {
        expect(
          await this.helpers.buyCover(
            this.signers.deployer,
            i,
            this.args.coverAmount,
            this.args.coverPremiums,
          ),
        ).to.not.throw;

        expect(
          await this.contracts.AthenaCoverToken.balanceOf(
            this.signers.deployer.address,
          ),
        ).to.equal(1 + i);

        const cover = await this.contracts.LiquidityManager.covers(i);

        expect(cover.poolId).to.equal(i);
        expect(cover.coverAmount).to.equal(this.args.coverAmount);
        expect(cover.premiums).to.equal(this.args.coverPremiums);
        // expect(cover.start.div(100)).to.equal(17047336);
        expect(cover.end).to.equal(0);
      }
    });

    // it("has coherent state", async function () {});

    it("can create claims", async function () {
      this.timeout(300_000);
      await setNextBlockTimestamp({ days: 365 });

      for (let i = 0; i < this.args.nbPools; i++) {
        expect(
          await this.helpers.initiateClaim(
            this.signers.deployer,
            i,
            this.args.claimAmount,
          ),
        ).to.not.throw;

        const claim = await this.contracts.ClaimManager.claims(i);

        expect(claim.status).to.equal(0);
        expect(claim.amount).to.equal(this.args.claimAmount);
        expect(claim.coverId).to.equal(i);
        expect(claim.arbitrationCost).to.equal(
          await this.contracts.ClaimManager.arbitrationCost(),
        );
      }
    });
    it("can resolve claims", async function () {
      this.timeout(600_000);
      await setNextBlockTimestamp({ days: 15 });

      for (let i = 0; i < this.args.nbPools; i++) {
        expect(
          await this.helpers.withdrawWithoutDispute(this.signers.deployer, i),
        ).to.not.throw;
      }
    });

    // it("has coherent state", async function () {});

    it.skip("can increase LPs", async function () {
      await setNextBlockTimestamp({ days: 365 });

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

      expect(position.poolIds.length).to.equal(3);
      expect(position.poolIds[0]).to.equal(0);
      expect(position.poolIds[1]).to.equal(1);
      expect(position.poolIds[2]).to.equal(2);
      // expect(position.supplied).to.equal(
      //   this.args.lpIncreaseAmount
      //     .add(this.args.lpAmount)
      //     .sub(this.args.claimAmount),
      // );
    });

    it.skip("can increase cover & premiums", async function () {
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
      // expect(cover.start.div(100)).to.equal(17047336);
      expect(cover.end).to.equal(0);
    });

    // it("has coherent state", async function () {});

    // it("can decrease cover amount", async function () {});
    // it("can decrease cover premiums", async function () {});

    // it("has coherent state", async function () {});

    it.skip("can close cover", async function () {
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
      // expect(cover.start.div(100)).to.equal(17047336);
      // expect(cover.end.div(100)).to.equal(17060296);
    });

    it("can commit LPs withdrawal", async function () {
      this.timeout(300_000);
      await setNextBlockTimestamp({ days: 10 });

      expect(
        await postTxHandler(
          this.contracts.LiquidityManager.commitPositionWithdrawal(0),
        ),
      ).to.not.throw;

      const position = await this.contracts.LiquidityManager.positions(0);
      // expect(position.commitWithdrawalTimestamp.div(100)).to.equal(17060296);
    });

    it("can withdraw LPs", async function () {
      this.timeout(600_000);
      // Wait for unlock delay to pass
      await setNextBlockTimestamp({ days: 15 });

      expect(
        await postTxHandler(
          this.contracts.LiquidityManager.closePosition(0, false),
        ),
      ).to.not.throw;

      const position = await this.contracts.LiquidityManager.positions(0);

      // expect(position.poolIds.length).to.equal(3);
      expect(position.poolIds[0]).to.equal(0);
      expect(position.supplied).to.equal(0);
      // expect(position.commitWithdrawalTimestamp.div(100)).to.equal(17060296);
    });

    // it("has coherent state", async function () {});
  });
}
