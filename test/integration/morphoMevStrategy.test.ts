import { expect } from "chai";
import { utils } from "ethers";
import { getNetworkAddresses } from "../../scripts/verificationData/addresses";
import {
  getConnectedProtocolContracts,
  MorphoConnectedProtocolContracts,
} from "../helpers/contracts-getters";
import { MorphoProtocolContracts } from "../helpers/deployersMorpho";
import {
  entityProviderChainId,
  getCurrentTime,
  postTxHandler,
  setNextBlockTimestamp,
} from "../helpers/hardhat";
import { makeTestHelpers, TestHelper } from "../helpers/protocol";
import { getCoverRewards } from "../helpers/utils/poolRayMath";
import { BigNumber } from "ethers";
import { ERC20Basic__factory } from "../../typechain";

const { parseUnits } = utils;
const DAY_SECONDS = 24 * 60 * 60;

interface Arguments extends Mocha.Context {
  customEnv: {
    contracts: MorphoProtocolContracts | MorphoConnectedProtocolContracts;
    helpers: TestHelper;
  };
  args: {
    daoLockDuration: number;
    claimResolvePeriod: number;
    withdrawDelay: number;
    morphoStrategyId: number;
    lpAmount: BigNumber;
    coverAmount: BigNumber;
    coverPremiums: BigNumber;
    claimAmount: BigNumber;
    lpIncreaseAmount: BigNumber;
    coverIncreaseAmount: BigNumber;
    coverIncreasePremiums: BigNumber;
  };
}

export function MorphoStrategyTest() {
  context("Morpho Strategy Test", function () {
    this.timeout(600_000);

    before(async function (this: Arguments) {
      console.log(": ");
      const chainId = await entityProviderChainId(this.signers.deployer);

      if (chainId !== 1) {
        console.warn("\n\nTest is disabled for non-mainnet network\n\n");
        this.skip();
      }

      const veContracts = await getConnectedProtocolContracts(
        getNetworkAddresses(),
        "ethereum-morpho",
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
        daoLockDuration: 365 * DAY_SECONDS,
        claimResolvePeriod: 186 * DAY_SECONDS,
        withdrawDelay: 10 * DAY_SECONDS,
        morphoStrategyId: 3,
        lpAmount: parseUnits("10", 18),
        lpIncreaseAmount: parseUnits("15", 18),
        coverAmount: parseUnits("10", 18),
        coverPremiums: parseUnits("10", 18),
        coverIncreaseAmount: parseUnits("4", 18),
        coverIncreasePremiums: parseUnits("4", 18),
        claimAmount: parseUnits("2", 18),
      };
    });

    it("can create pool with Morpho strategy", async function (this: Arguments) {
      const existingPools = (
        await this.customEnv.contracts.LiquidityManager.nextPoolId()
      ).toNumber();

      const { uOptimal, r0, rSlope1, rSlope2 } =
        this.protocolConfig.poolFormula;

      expect(
        await postTxHandler(
          this.customEnv.contracts.LiquidityManager.createPool(
            this.customEnv.contracts.CircleToken.address, // paymentAsset
            this.args.morphoStrategyId, // strategyId
            0, // feeRate
            uOptimal,
            r0,
            rSlope1,
            rSlope2,
            [], // compatiblePools
          ),
        ),
      ).to.not.throw;

      const poolInfo =
        await this.customEnv.contracts.LiquidityManager.poolInfo(existingPools);
      expect(poolInfo.strategyId).to.equal(this.args.morphoStrategyId);
    });

    it("accepts LP position", async function (this: Arguments) {
      expect(
        await this.customEnv.helpers.openPosition(
          this.signers.deployer,
          this.args.lpAmount,
          true,
          [0], // poolIds
        ),
      ).to.not.throw;

      const position =
        await this.customEnv.contracts.LiquidityManager.positionInfo(0);
      expect(position.supplied).to.equal(this.args.lpAmount);
    });

    it("accepts cover", async function (this: Arguments) {
      expect(
        await this.customEnv.helpers.openCover(
          this.signers.deployer,
          0,
          this.args.coverAmount,
          this.args.coverPremiums,
        ),
      ).to.not.throw;

      const cover =
        await this.customEnv.contracts.LiquidityManager.coverInfo(0);
      expect(cover.coverAmount).to.equal(this.args.coverAmount);
      expect(cover.isActive).to.be.true;
    });

    it("can take interests", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 2 });

      const positionBefore =
        await this.customEnv.contracts.LiquidityManager.positionInfo(0);
      expect(await this.customEnv.contracts.LiquidityManager.takeInterests(0))
        .to.not.throw;
      const positionAfter =
        await this.customEnv.contracts.LiquidityManager.positionInfo(0);

      expect(positionBefore.coverRewards[0]).to.not.equal(0);
    });

    it("can create and resolve claim", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 365 });

      expect(
        await this.customEnv.helpers.initiateClaim(
          this.signers.deployer,
          0,
          this.args.claimAmount,
        ),
      ).to.not.throw;

      const claim = await this.customEnv.contracts.ClaimManager.claims(0);
      expect(claim.status).to.equal(0);
      expect(claim.amount).to.equal(this.args.claimAmount);

      await setNextBlockTimestamp({ days: this.args.claimResolvePeriod });
      expect(
        await this.customEnv.helpers.withdrawCompensation(
          this.signers.deployer,
          0,
        ),
      ).to.not.throw;
    });

    it("can increase LP position", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 365 });

      await this.customEnv.helpers.addLiquidity(
        this.signers.deployer,
        0,
        this.args.lpIncreaseAmount,
        true,
      );

      const position =
        await this.customEnv.contracts.LiquidityManager.positionInfo(0);
      expect(position.newUserCapital).to.equal(
        this.args.lpIncreaseAmount
          .add(this.args.lpAmount)
          .sub(this.args.claimAmount),
      );
    });

    it("can update and close cover", async function (this: Arguments) {
      expect(
        await this.customEnv.helpers.updateCover(
          this.signers.deployer,
          0,
          this.args.coverIncreaseAmount,
          0,
          this.args.coverIncreasePremiums,
          0,
        ),
      ).to.not.throw;

      const uint256Max = BigNumber.from(2).pow(256).sub(1);

      expect(
        await this.customEnv.helpers.updateCover(
          this.signers.deployer,
          0,
          0,
          0,
          0,
          uint256Max,
        ),
      ).to.not.throw;

      const cover =
        await this.customEnv.contracts.LiquidityManager.coverInfo(0);
      expect(cover.premiumsLeft).to.equal(0);
    });

    it("can withdraw LP position", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: this.args.withdrawDelay });

      expect(
        await postTxHandler(
          this.customEnv.contracts.LiquidityManager.commitRemoveLiquidity(0),
        ),
      ).to.not.throw;

      await setNextBlockTimestamp({ days: this.args.withdrawDelay });

      const positionInfo =
        await this.customEnv.contracts.LiquidityManager.positionInfo(0);
      expect(
        await postTxHandler(
          this.customEnv.contracts.LiquidityManager.removeLiquidity(
            0,
            positionInfo.newUserCapital,
            true,
          ),
        ),
      ).to.not.throw;

      const finalPosition =
        await this.customEnv.contracts.LiquidityManager.positionInfo(0);
      expect(finalPosition.supplied).to.equal(0);
      expect(finalPosition.newUserCapital).to.equal(0);
    });

    describe("MetaMorpho Strategy View Functions", async function () {
      it("verifies reward index", async function (this: Arguments) {
        const rewardIndex =
          await this.customEnv.contracts.StrategyManager.getRewardIndex(
            this.args.morphoStrategyId,
          );
        expect(rewardIndex).to.be.gt(0);
      });

      it("verifies wrapped/underlying conversions", async function (this: Arguments) {
        const testAmount = parseUnits("1", 18);

        const underlyingAmount =
          await this.customEnv.contracts.StrategyManager.wrappedToUnderlying(
            this.args.morphoStrategyId,
            testAmount,
          );
        expect(underlyingAmount).to.be.gt(0);

        const wrappedAmount =
          await this.customEnv.contracts.StrategyManager.underlyingToWrapped(
            this.args.morphoStrategyId,
            testAmount,
          );
        expect(wrappedAmount).to.be.gt(0);
      });

      it("verifies compound status", async function (this: Arguments) {
        const compounds =
          await this.customEnv.contracts.StrategyManager.itCompounds(
            this.args.morphoStrategyId,
          );
        expect(compounds).to.be.false;
      });
    });
  });
}
