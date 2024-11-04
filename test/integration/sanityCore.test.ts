import { utils } from "ethers";
import { expect } from "chai";
// Helpers
import {
  setNextBlockTimestamp,
  postTxHandler,
  getCurrentTime,
} from "../helpers/hardhat";
import { makeIdArray } from "../helpers/miscUtils";
import {
  deployAllContractsAndInitializeProtocolCore,
  CoreProtocolContracts,
} from "../helpers/deployersCore";
import { makeTestHelpers, TestHelper } from "../helpers/protocol";
// Types
import { BigNumber } from "ethers";

const { parseUnits } = utils;

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

export function SanityTestCore() {
  context("Sanity Test Core", function () {
    this.timeout(600_000);

    before(async function (this: Arguments) {
      this.args = {
        nbPools: 2,
        daoLockDuration: 60 * 60 * 24 * 365,
        lpAmount: parseUnits("1000", 6),
        nbLpProviders: 2,
        coverAmount: parseUnits("1000", 6),
        coverPremiums: parseUnits("1000", 6),
        claimAmount: parseUnits("200", 6),
        lpIncreaseAmount: parseUnits("1500", 6),
        coverIncreaseAmount: parseUnits("400", 6),
        coverIncreasePremiums: parseUnits("50", 6),
      };

      const contractsCore = await deployAllContractsAndInitializeProtocolCore(
        this.signers.deployer,
        this.protocolConfig,
      );

      const helpersCore = await makeTestHelpers(
        this.signers.deployer,
        contractsCore,
      );

      this.customEnv = {
        contracts: contractsCore,
        helpers: helpersCore,
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
              i, // strategyId
              0, // feeRate
              uOptimal,
              r0,
              rSlope1,
              rSlope2,
              [], // compatiblePools
            ),
          ),
        ).to.not.throw;

        // Check pool info
        const poolInfo = await this.contracts.LiquidityManager.poolInfo(poolId);
        // expect(poolInfo.paymentAsset.toLowerCase()).to.equal(
        //   this.contracts.CircleToken.address,
        // );
        // expect(poolInfo.underlyingAsset.toLowerCase()).to.equal(
        //   this.contracts.CircleToken.address,
        // );
        expect(poolInfo.feeRate).to.equal(0);
        expect(poolInfo.strategyId).to.equal(i);
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
            i === 0 ? false : true,
            [i],
          ),
        ).to.not.throw;

        expect(
          await this.contracts.AthenaPositionToken.balanceOf(
            this.signers.deployer.address,
          ),
        ).to.equal(i + 1);

        const position = await this.contracts.LiquidityManager.positionInfo(i);

        expect(position.poolIds.length).to.equal(1);
        expect(position.poolIds[0]).to.equal(i);
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
        expect(Number(positionBefore.coverRewards[0])).to.not.equal(0);
        if (i === 0) expect(positionBefore.strategyRewards).to.not.equal(0);

        // Check that rewards were taken
        expect(position.coverRewards[0]).to.equal(0);
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
          i === 0 ? false : true,
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

        expect(position.poolIds.length).to.equal(1);
        expect(position.newUserCapital).to.equal(
          this.args.lpIncreaseAmount
            .add(this.args.lpAmount)
            .sub(this.args.claimAmount),
        );
        const totalRewards = position.coverRewards.reduce(
          (acc, reward) => acc.add(reward),
          BigNumber.from(0),
        );
        expect(totalRewards).to.almostEqual(350682);
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
      expect(cover.coverAmount).to.gt(0);
      expect(cover.coverAmount).to.lte(
        this.args.coverIncreaseAmount
          .add(this.args.coverAmount)
          .sub(this.args.claimAmount),
      );
      expect(cover.premiumsLeft).to.almostEqual("753394777");
    });

    it("can close cover", async function (this: Arguments) {
      const uint256Max = BigNumber.from(2).pow(256).sub(1);

      expect(
        await this.contracts.AthenaCoverToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(this.args.nbPools);

      for (let i = 0; i < this.args.nbPools; i++) {
        expect(
          await postTxHandler(
            this.contracts.LiquidityManager.updateCover(i, 0, 0, 0, uint256Max),
          ),
        ).to.not.throw;

        const cover = await this.contracts.LiquidityManager.coverInfo(i);

        expect(cover.poolId).to.equal(i);
        expect(cover.coverAmount).to.equal(
          this.args.coverAmount
            .add(i === 0 ? this.args.coverIncreaseAmount : 0)
            .sub(this.args.claimAmount),
        );
        expect(cover.premiumsLeft).to.equal(0);
      }
    });

    it("can commit LPs withdrawal", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 10 });

      const expectedTimestamp = await getCurrentTime();

      for (let i = 0; i < this.args.nbLpProviders; i++) {
        expect(
          await postTxHandler(
            this.contracts.LiquidityManager.commitRemoveLiquidity(i),
          ),
        ).to.not.throw;

        const position = await this.contracts.LiquidityManager.positionInfo(i);

        expect(position.commitWithdrawalTimestamp.div(100)).to.almostEqual(
          Math.floor(expectedTimestamp / 100),
        );
      }
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
              i === 0 ? false : true,
            ),
          ),
        ).to.not.throw;

        const position = await this.contracts.LiquidityManager.positionInfo(i);

        expect(position.poolIds.length).to.equal(1);
        expect(position.poolIds[0]).to.equal(i);
        expect(position.supplied).to.equal(0);
        expect(position.newUserCapital).to.equal(0);
        expect(position.strategyRewards).to.almostEqual(0);
        expect(position.coverRewards[0]).to.equal(0);
        expect(position.commitWithdrawalTimestamp).to.equal(0);
      }
    });
  });
}
