import { utils } from "ethers";
import { expect } from "chai";
// Helpers
import { getCoverRewards } from "../helpers/utils/poolRayMath";
import {
  setNextBlockTimestamp,
  postTxHandler,
  getCurrentTime,
  evmSnapshot,
  evmRevert,
} from "../helpers/hardhat";
import { makeIdArray } from "../helpers/miscUtils";
import {
  deployAllContractsAndInitializeProtocolVE,
  VEProtocolContracts,
} from "../helpers/deployersVE";
import { makeTestHelpers, TestHelper } from "../helpers/protocol";
import {
  genContractAddress,
  getCurrentBlockNumber,
  entityProviderChainId,
} from "../helpers/hardhat";
import {
  aaveLendingPoolV3Address,
  usdcTokenAddress,
} from "../helpers/protocol";
import { ERC20Basic__factory } from "../../typechain";
// Types
import { BigNumber } from "ethers";

const { parseUnits } = utils;

interface Arguments extends Mocha.Context {
  customEnv: {
    contracts: VEProtocolContracts;
    helpers: TestHelper;
  };
  args: {
    nbPools: number;
    daoLockDuration: number;
    assets: string[];
    //
    lpAmount: BigNumber;
    coverAmount: BigNumber;
    coverPremiums: BigNumber;
    claimAmount: BigNumber;
    lpIncreaseAmount: BigNumber;
    coverIncreaseAmount: BigNumber;
    coverIncreasePremiums: BigNumber;
    lpAmountUsd: BigNumber;
    coverAmountUsd: BigNumber;
    coverPremiumsUsd: BigNumber;
    claimAmountUsd: BigNumber;
    lpIncreaseAmountUsd: BigNumber;
    coverIncreaseAmountUsd: BigNumber;
    coverIncreasePremiumsUsd: BigNumber;
  };
}

export function AmphorStrategiesTest() {
  context("Amphor Strategies Test", function () {
    // @dev Huge timeout for edge cases with +20 pools / claims / positions / etc.
    this.timeout(600_000);

    before(async function (this: Arguments) {
      const chainId = await entityProviderChainId(this.signers.deployer);

      if (chainId !== 1) {
        console.warn("\n\nTest is disabled for non-mainnet network\n\n");
        this.skip();
      }
      if (!this.protocolConfig.amphrETH || !this.protocolConfig.amphrLRT) {
        throw new Error("amphrETH or amphrLRT not set in protocol config");
      }

      const veContracts = await deployAllContractsAndInitializeProtocolVE(
        this.signers.deployer,
        this.protocolConfig,
      );
      const veHelpers = await makeTestHelpers(
        this.signers.deployer,
        veContracts,
      );
      this.customEnv = {
        contracts: veContracts,
        helpers: veHelpers,
      };

      this.args = {
        nbPools: 3,
        daoLockDuration: 60 * 60 * 24 * 365,
        assets: [
          veContracts.CircleToken.address,
          this.protocolConfig.amphrETH,
          this.protocolConfig.amphrLRT,
        ],
        //
        lpAmountUsd: parseUnits("1000", 6),
        lpIncreaseAmountUsd: parseUnits("1500", 6),
        coverAmountUsd: parseUnits("1000", 6),
        coverPremiumsUsd: parseUnits("1000", 6),
        coverIncreaseAmountUsd: parseUnits("400", 6),
        coverIncreasePremiumsUsd: parseUnits("50", 6),
        claimAmountUsd: parseUnits("200", 6),
        //
        lpAmount: parseUnits("10", 18),
        lpIncreaseAmount: parseUnits("15", 18),
        coverAmount: parseUnits("10", 18),
        coverPremiums: parseUnits("10", 18),
        coverIncreaseAmount: parseUnits("4", 18),
        coverIncreasePremiums: parseUnits("4", 18),
        claimAmount: parseUnits("2", 18),
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
            this.customEnv.contracts.LiquidityManager.createPool(
              this.args.assets[i], // paymentAsset
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
        const poolInfo =
          await this.customEnv.contracts.LiquidityManager.poolInfo(poolId);

        expect(poolInfo.paymentAsset.toLowerCase()).to.equal(
          this.args.assets[i],
        );
        expect(poolInfo.underlyingAsset.toLowerCase()).to.equal(
          i === 0
            ? this.customEnv.contracts.CircleToken.address
            : this.protocolConfig.wstETH,
        );
        expect(poolInfo.strategyId).to.equal(i);
        expect(poolInfo.feeRate).to.equal(0);
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
      for (let i = 0; i < this.args.nbPools; i++) {
        const lpAmount = i === 0 ? this.args.lpAmountUsd : this.args.lpAmount;

        expect(
          await this.customEnv.helpers.openPosition(
            this.signers.deployer,
            lpAmount,
            i === 0 ? false : true,
            [i],
          ),
        ).to.not.throw;

        expect(
          await this.customEnv.contracts.AthenaPositionToken.balanceOf(
            this.signers.deployer.address,
          ),
        ).to.equal(i + 1);

        const position =
          await this.customEnv.contracts.LiquidityManager.positionInfo(i);

        expect(position.poolIds.length).to.equal(1);
        expect(position.supplied).to.equal(lpAmount);
      }
    });

    it("accepts covers", async function (this: Arguments) {
      for (let i = 0; i < this.args.nbPools; i++) {
        const [coverAmount, coverPremiums] =
          i === 0
            ? [this.args.coverAmountUsd, this.args.coverPremiumsUsd]
            : [this.args.coverAmount, this.args.coverPremiums];

        expect(
          await this.customEnv.helpers.openCover(
            this.signers.deployer,
            i,
            coverAmount,
            coverPremiums,
          ),
        ).to.not.throw;
      }

      expect(
        await this.customEnv.contracts.AthenaCoverToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(this.args.nbPools);

      // await setNextBlockTimestamp({ days: 365 });

      for (let i = 0; i < this.args.nbPools; i++) {
        const coverAmount =
          i === 0 ? this.args.coverAmountUsd : this.args.coverAmount;

        const cover =
          await this.customEnv.contracts.LiquidityManager.coverInfo(i);

        expect(cover.coverId).to.equal(i);
        expect(cover.poolId).to.equal(i);
        expect(cover.coverAmount).to.equal(coverAmount);
        expect(cover.isActive).to.be.true;
        // expect(cover.premiumsLeft).to.almostEqual(840000000);
      }
    });

    it("can take interests", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 2 });

      for (let i = 0; i < this.args.nbPools; i++) {
        const positionBefore =
          await this.customEnv.contracts.LiquidityManager.positionInfo(i);

        expect(await this.customEnv.contracts.LiquidityManager.takeInterests(i))
          .to.not.throw;

        const position =
          await this.customEnv.contracts.LiquidityManager.positionInfo(i);

        expect(positionBefore.coverRewards[0]).to.not.equal(0);
      }
    });

    it("can create claims", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 365 });

      for (let i = 0; i < this.args.nbPools; i++) {
        const claimAmount =
          i === 0 ? this.args.claimAmountUsd : this.args.claimAmount;

        expect(
          await this.customEnv.helpers.initiateClaim(
            this.signers.deployer,
            i,
            claimAmount,
          ),
        ).to.not.throw;

        const claim = await this.customEnv.contracts.ClaimManager.claims(i);

        expect(claim.status).to.equal(0);
        expect(claim.amount).to.equal(claimAmount);
        expect(claim.coverId).to.equal(i);
      }
    });

    it("can resolve claims", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 15 });

      for (let i = 0; i < this.args.nbPools; i++) {
        expect(
          await this.customEnv.helpers.withdrawCompensation(
            this.signers.deployer,
            i,
          ),
        ).to.not.throw;
      }
    });

    it("can increase LPs", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 365 });

      for (let i = 0; i < this.args.nbPools; i++) {
        const lpIncreaseAmount =
          i === 0 ? this.args.lpIncreaseAmountUsd : this.args.lpIncreaseAmount;

        await this.customEnv.helpers.addLiquidity(
          this.signers.deployer,
          i,
          lpIncreaseAmount,
          i === 0 ? false : true,
        );
      }

      await setNextBlockTimestamp({ days: 5 });

      expect(
        await this.customEnv.contracts.AthenaPositionToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(this.args.nbPools);

      for (let i = 0; i < this.args.nbPools; i++) {
        const [lpAmount, claimAmount, lpIncreaseAmount] =
          i === 0
            ? [
                this.args.lpAmountUsd,
                this.args.claimAmountUsd,
                this.args.lpIncreaseAmountUsd,
              ]
            : [
                this.args.lpAmount,
                this.args.claimAmount,
                this.args.lpIncreaseAmount,
              ];

        const position =
          await this.customEnv.contracts.LiquidityManager.positionInfo(i);

        expect(position.poolIds.length).to.equal(1);
        expect(position.newUserCapital).to.equal(
          lpIncreaseAmount.add(lpAmount).sub(claimAmount),
        );
        const totalRewards = position.coverRewards.reduce(
          (acc, reward) => acc.add(reward),
          BigNumber.from(0),
        );

        expect(totalRewards).to.almostEqual(
          i === 0 ? "350682" : "3506823988457635",
        );
      }
    });

    it("can increase cover & premiums", async function (this: Arguments) {
      const coverId = 2;

      const [coverAmount, coverIncreaseAmount, coverIncreasePremiums] = [
        this.args.coverAmount,
        this.args.coverIncreaseAmount,
        this.args.coverIncreasePremiums,
      ];

      expect(
        await this.customEnv.helpers.updateCover(
          this.signers.deployer,
          coverId,
          coverIncreaseAmount,
          0,
          coverIncreasePremiums,
          0,
        ),
      ).to.not.throw;

      await setNextBlockTimestamp({ days: 5 });

      expect(
        await this.customEnv.contracts.AthenaCoverToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(this.args.nbPools);

      const cover =
        await this.customEnv.contracts.LiquidityManager.coverInfo(coverId);

      expect(cover.poolId).to.equal(coverId);
      expect(cover.coverAmount).to.gt(0);
      expect(cover.coverAmount).to.lte(
        this.args.coverIncreaseAmount
          .add(coverAmount)
          .sub(this.args.claimAmount),
      );
      expect(cover.premiumsLeft).to.almostEqual("11033965587651379789");
    });

    it("can close cover", async function (this: Arguments) {
      expect(
        await this.customEnv.contracts.AthenaCoverToken.balanceOf(
          this.signers.deployer.address,
        ),
      ).to.equal(this.args.nbPools);

      for (let i = 0; i < this.args.nbPools; i++) {
        const [coverAmount, coverIncreaseAmount, claimAmount] =
          i === 0
            ? [
                this.args.coverAmountUsd,
                this.args.coverIncreaseAmountUsd,
                this.args.claimAmountUsd,
              ]
            : [
                this.args.coverAmount,
                this.args.coverIncreaseAmount,
                this.args.claimAmount,
              ];

        const uint256Max = BigNumber.from(2).pow(256).sub(1);

        expect(
          await this.customEnv.helpers.updateCover(
            this.signers.deployer,
            i,
            0,
            0,
            0,
            uint256Max,
          ),
        ).to.not.throw;

        const cover =
          await this.customEnv.contracts.LiquidityManager.coverInfo(i);

        expect(cover.poolId).to.equal(i);
        expect(cover.coverAmount).to.equal(
          i === 2
            ? coverIncreaseAmount.add(coverAmount).sub(claimAmount)
            : coverAmount.sub(claimAmount),
        );
        expect(cover.premiumsLeft).to.equal(0);
      }
    });

    it("can commit LPs withdrawal", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 15 });

      const expectedTimestamp = await getCurrentTime();

      for (let i = 0; i < this.args.nbPools; i++) {
        expect(
          await postTxHandler(
            this.customEnv.contracts.LiquidityManager.commitRemoveLiquidity(i),
          ),
        ).to.not.throw;

        const position =
          await this.customEnv.contracts.LiquidityManager.positionInfo(i);

        expect(position.commitWithdrawalTimestamp.div(100)).to.equal(
          Math.floor(expectedTimestamp / 100),
        );
      }
    });

    it("can withdraw LPs", async function (this: Arguments) {
      // Wait for unlock delay to pass
      await setNextBlockTimestamp({ days: 15 });

      for (let i = 0; i < this.args.nbPools; i++) {
        const positionInfo =
          await this.customEnv.contracts.LiquidityManager.positionInfo(i);

        expect(
          await postTxHandler(
            this.customEnv.contracts.LiquidityManager.removeLiquidity(
              i,
              positionInfo.newUserCapital,
              i === 0 ? false : true,
            ),
          ),
        ).to.not.throw;

        const position =
          await this.customEnv.contracts.LiquidityManager.positionInfo(i);

        expect(position.poolIds.length).to.equal(1);
        expect(position.poolIds[0]).to.equal(i);
        expect(position.supplied).to.equal(0);
        expect(position.newUserCapital).to.equal(0);
        expect(position.strategyRewards).to.almostEqual(0);
        expect(position.coverRewards[0]).to.equal(0);
        expect(position.commitWithdrawalTimestamp).to.equal(0);
      }
    });

    describe("Strategy Computation", async function () {
      it("builds test setup", async function (this: Arguments) {
        expect(
          await this.customEnv.helpers.openPosition(
            this.signers.deployer,
            parseUnits("10", 18),
            true,
            [2],
          ),
        ).to.not.throw;

        expect(
          await this.customEnv.helpers.openCover(
            this.signers.deployer,
            2,
            parseUnits("10", 18),
            parseUnits("10", 18),
          ),
        ).to.not.throw;
      });

      it("check results", async function (this: Arguments) {
        const uint256Max = BigNumber.from(2).pow(256).sub(1);
        const token = ERC20Basic__factory.connect(
          this.args.assets[2],
          this.signers.deployer,
        );

        const poolInfoBefore =
          await this.customEnv.contracts.LiquidityManager.poolInfo(2);

        await setNextBlockTimestamp({ days: 365 });

        const poolInfoAfter =
          await this.customEnv.contracts.LiquidityManager.poolInfo(2);

        const latestPositionId = (
          await this.customEnv.contracts.AthenaPositionToken.nextPositionId()
        ).sub(1);
        const latestCoverId = (
          await this.customEnv.contracts.AthenaCoverToken.nextCoverId()
        ).sub(1);

        const positionInfo =
          await this.customEnv.contracts.LiquidityManager.positionInfo(
            latestPositionId,
          );

        const expectedRewards = getCoverRewards(
          positionInfo.newUserCapital,
          poolInfoBefore.slot0.liquidityIndex,
          poolInfoAfter.slot0.liquidityIndex,
        );

        expect(positionInfo.newUserCapital).to.almostEqual(
          parseUnits("10", 18),
        );
        expect(positionInfo.strategyRewards).to.almostEqual("0");
        expect(positionInfo.coverRewards[0]).to.almostEqual(expectedRewards);

        expect(
          await this.customEnv.helpers.updateCover(
            this.signers.deployer,
            latestCoverId,
            0,
            0,
            0,
            uint256Max,
          ),
        ).to.not.throw;

        const balanceBefore = await token.balanceOf(
          this.signers.deployer.address,
        );

        expect(
          await postTxHandler(
            this.customEnv.contracts.LiquidityManager.commitRemoveLiquidity(
              latestPositionId,
            ),
          ),
        ).to.not.throw;

        // Wait for unlock delay to pass
        await setNextBlockTimestamp({ days: 15 });

        expect(
          await postTxHandler(
            this.customEnv.contracts.LiquidityManager.removeLiquidity(
              latestPositionId,
              positionInfo.newUserCapital,
              true,
            ),
          ),
        ).to.not.throw;

        const balanceAfter = await token.balanceOf(
          this.signers.deployer.address,
        );

        expect(balanceAfter.sub(balanceBefore)).to.almostEqual(
          parseUnits("10", 18).add(expectedRewards),
        );
      });
    });
  });
}
