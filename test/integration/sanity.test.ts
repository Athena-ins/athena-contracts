import { expect } from "chai";
// Helpers
import {
  setNextBlockTimestamp,
  postTxHandler,
  getCurrentTime,
} from "../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {
    nbPools: number;
    daoLockDuration: number;
    lpAmount: BigNumber;
    nbLpProviders: number;
    coverAmount: BigNumber;
    coverPremiums: BigNumber;
    claimAmount: BigNumber;
    lpIncreaseAmount: BigNumber;
    coverIncreaseAmount: BigNumber;
    coverIncreasePremiums: BigNumber;
  };
}

export function SanityTest() {
  context("Sanity Test", function () {
    // @dev Huge timeout for edge cases with +20 pools / claims / positions / etc.
    this.timeout(600_000);

    before(async function (this: Arguments) {
      this.args = {
        nbPools: 3,
        daoLockDuration: 60 * 60 * 24 * 365,
        lpAmount: toUsd(1000),
        nbLpProviders: 1,
        coverAmount: toUsd(1000),
        coverPremiums: toUsd(1000),
        claimAmount: toUsd(200),
        lpIncreaseAmount: toUsd(1500),
        coverIncreaseAmount: toUsd(400),
        coverIncreasePremiums: toUsd(50),
      };
    });

    it("can create pools", async function (this: Arguments) {
      for (let i = 0; i < this.args.nbPools; i++) {
        const poolId = i;

        const { uOptimal, r0, rSlope1, rSlope2 } =
          this.protocolConfig.poolFormula;

        // Create a pool
        expect(
          await postTxHandler(
            this.contracts.LiquidityManager.createPool(
              this.contracts.CircleToken.address, // paymentAsset
              0, // strategyId
              0, // feeRate
              uOptimal,
              r0,
              rSlope1,
              rSlope2,
              makeIdArray(this.args.nbPools).filter((id) => id != poolId), // compatiblePools
            ),
          ),
        ).to.not.throw;

        // Check pool info
        const poolInfo = await this.contracts.LiquidityManager.poolInfo(poolId);
        expect(poolInfo.paymentAsset.toLowerCase()).to.equal(
          this.contracts.CircleToken.address,
        );
        expect(poolInfo.underlyingAsset.toLowerCase()).to.equal(
          this.contracts.CircleToken.address,
        );
        expect(poolInfo.feeRate).to.equal(0);
        expect(poolInfo.strategyId).to.equal(0);
        expect(poolInfo.formula.uOptimal).to.equal(
          this.protocolConfig.poolFormula.uOptimal,
        );
        expect(poolInfo.formula.r0).to.equal(
          this.protocolConfig.poolFormula.r0,
        );
        expect(poolInfo.formula.rSlope1).to.equal(
          this.protocolConfig.poolFormula.rSlope1,
        );
        expect(poolInfo.formula.rSlope2).to.equal(
          this.protocolConfig.poolFormula.rSlope2,
        );
        expect(poolInfo.poolId).to.equal(poolId);
      }
    });

    it("accepts LPs", async function (this: Arguments) {
      for (let i = 0; i < this.args.nbLpProviders; i++) {
        expect(
          await this.helpers.openPosition(
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
        ).to.equal(i + 1);

        const position = await this.contracts.LiquidityManager.positionInfo(i);

        expect(position.poolIds.length).to.equal(this.args.nbPools);
        for (let j = 0; j < this.args.nbPools; j++) {
          expect(position.poolIds[j]).to.equal(j);
        }
        expect(position.supplied).to.equal(this.args.lpAmount);
      }
    });

    it("accepts covers", async function (this: Arguments) {
      for (let i = 0; i < this.args.nbPools; i++) {
        expect(
          await this.helpers.openCover(
            this.signers.deployer,
            i,
            this.args.coverAmount,
            this.args.coverPremiums,
          ),
        ).to.not.throw;
      }

        expect(
          await this.contracts.AthenaCoverToken.balanceOf(
            this.signers.deployer.address,
          ),
      ).to.equal(this.args.nbPools);

      // await setNextBlockTimestamp({ days: 365 });

      for (let i = 0; i < this.args.nbPools; i++) {
        const cover = await this.contracts.LiquidityManager.coverInfo(i);

        expect(cover.coverId).to.equal(i);
        expect(cover.poolId).to.equal(i);
        expect(cover.coverAmount).to.equal(this.args.coverAmount);
        expect(cover.isActive).to.be.true;
        // expect(cover.premiumsLeft).to.almostEqual(840000000);
      }
    });

    it("can take interests", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 2 });

      for (let i = 0; i < this.args.nbLpProviders; i++) {
        const positionBefore =
          await this.contracts.LiquidityManager.positionInfo(i);

        expect(await this.contracts.LiquidityManager.takeInterests(i)).to.not
          .throw;

        const position = await this.contracts.LiquidityManager.positionInfo(i);

        // Check that there were rewards before
        for (let j = 0; j < this.args.nbPools; j++) {
          expect(positionBefore.coverRewards[j]).to.not.equal(0);
        }
        expect(positionBefore.strategyRewards).to.not.equal(0);

        // Check that rewards were taken
        for (let j = 0; j < this.args.nbPools; j++) {
          expect(position.coverRewards[j]).to.equal(0);
        }
        expect(position.strategyRewards).to.equal(0);
      }
    });

    it("can create claims", async function (this: Arguments) {
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
      }
    });

    it("can resolve claims", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 15 });

      for (let i = 0; i < this.args.nbPools; i++) {
        expect(
          await this.helpers.withdrawCompensation(this.signers.deployer, i),
        ).to.not.throw;
      }
    });

    it("can increase LPs", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 365 });

      for (let i = 0; i < this.args.nbLpProviders; i++) {
        await this.helpers.addLiquidity(
          this.signers.deployer,
          i,
          this.args.lpIncreaseAmount,
          false,
        );
      }

      await setNextBlockTimestamp({ days: 5 });

      for (let i = 0; i < this.args.nbLpProviders; i++) {
        expect(
          await this.contracts.AthenaPositionToken.balanceOf(
            this.signers.deployer.address,
          ),
        ).to.equal(this.args.nbLpProviders);

        const position = await this.contracts.LiquidityManager.positionInfo(i);

        expect(position.poolIds.length).to.equal(this.args.nbPools);
        expect(position.newUserCapital).to.equal(
          this.args.lpIncreaseAmount
            .add(this.args.lpAmount)
            .sub(this.args.claimAmount.mul(this.args.nbPools)),
        );
        const totalRewards = position.coverRewards.reduce(
          (acc, reward) => acc.add(reward),
          BigNumber.from(0),
        );
        expect(totalRewards).to.almostEqual(416439);
      }
    });

    it("can increase cover & premiums", async function (this: Arguments) {
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
      ).to.equal(this.args.nbPools);

      const cover = await this.contracts.LiquidityManager.coverInfo(0);

      expect(cover.poolId).to.equal(0);
      expect(cover.coverAmount).to.equal(
        this.args.coverIncreaseAmount
          .add(this.args.coverAmount)
          .sub(this.args.claimAmount),
      );
      expect(cover.premiumsLeft).to.equal("594121582");
    });

    it("can close cover", async function (this: Arguments) {
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
      ).to.equal(this.args.nbPools);

      const cover = await this.contracts.LiquidityManager.coverInfo(0);

      expect(cover.poolId).to.equal(0);
      expect(cover.coverAmount).to.equal(
        this.args.coverIncreaseAmount
          .add(this.args.coverAmount)
          .sub(this.args.claimAmount),
      );
      expect(cover.premiumsLeft).to.equal(0);
    });

    it("can commit LPs withdrawal", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 10 });

      const expectedTimestamp = await getCurrentTime();

      expect(
        await postTxHandler(
          this.contracts.LiquidityManager.commitRemoveLiquidity(0),
        ),
      ).to.not.throw;

      const position = await this.contracts.LiquidityManager.positionInfo(0);

      expect(position.commitWithdrawalTimestamp.div(100)).to.equal(
        Math.floor(expectedTimestamp / 100),
      );
    });

    it("can withdraw LPs", async function (this: Arguments) {
      // Wait for unlock delay to pass
      await setNextBlockTimestamp({ days: 15 });

      for (let i = 0; i < this.args.nbLpProviders; i++) {
        const positionInfo =
          await this.contracts.LiquidityManager.positionInfo(i);

        expect(
          await postTxHandler(
            this.contracts.LiquidityManager.removeLiquidity(
              i,
              positionInfo.newUserCapital,
              false,
            ),
          ),
        ).to.not.throw;

        const position = await this.contracts.LiquidityManager.positionInfo(i);

        expect(position.poolIds.length).to.equal(this.args.nbPools);
        expect(position.poolIds[0]).to.equal(0);
        expect(position.supplied).to.equal(0);
        expect(position.newUserCapital).to.equal(0);
        expect(position.strategyRewards).to.almostEqual(0);
        for (let i = 0; i < this.args.nbPools; i++) {
          expect(position.coverRewards[0]).to.equal(0);
        }
        expect(position.commitWithdrawalTimestamp).to.equal(0);
      }
    });
  });
}
