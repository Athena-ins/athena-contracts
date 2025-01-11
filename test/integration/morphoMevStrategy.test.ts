import { expect } from "chai";
import { utils } from "ethers";
import { getNetworkAddresses } from "../../scripts/verificationData/addresses";
import {
  getConnectedProtocolContracts,
  MorphoConnectedProtocolContracts,
} from "../helpers/contracts-getters";
import { getDefaultProtocolConfig } from "../../scripts/verificationData/deployParams";
import {
  deployAllContractsAndInitializeProtocolMorpho,
  MorphoProtocolContracts,
} from "../helpers/deployersMorpho";
import { deployStrategyManagerMorpho } from "../helpers/deployers";
import {
  aaveLendingPoolV3Address,
  usdcTokenAddress,
  usdtTokenAddress,
  wethTokenAddress,
} from "../helpers/protocol";
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
    morphoPoolId: number;
    positionId: number;
    coverId: number;
    claimId: number;
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
    this.timeout(120_000);

    before(async function (this: Arguments) {
      this.protocolConfig = getDefaultProtocolConfig("amphor");
      const chainId = await entityProviderChainId(this.signers.deployer);

      if (chainId !== 1) {
        console.warn("\n\nTest is disabled for non-mainnet network\n\n");
        this.skip();
      }

      const contracts = await getConnectedProtocolContracts(
        getNetworkAddresses(),
        "ethereum-morpho",
      );
      // const contracts = await deployAllContractsAndInitializeProtocolMorpho(
      //   this.signers.deployer,
      //   this.protocolConfig,
      // );

      const strategyManagerMorpho = await deployStrategyManagerMorpho(
        this.signers.deployer,
        [
          contracts.LiquidityManager.address,
          this.signers.deployer.address, // EcclesiaDao
          aaveLendingPoolV3Address(chainId),
          usdcTokenAddress(chainId),
          this.protocolConfig.buybackWallet.address,
          this.protocolConfig.payoutDeductibleRate,
          this.protocolConfig.strategyFeeRate,
          this.protocolConfig.wstETH as string,
          this.protocolConfig.amphrETH as string,
          this.protocolConfig.amphrLRT as string,
          this.protocolConfig.morphoMevVault as string,
        ],
      );

      const upgradedContracts = {
        ...contracts,
        StrategyManager: strategyManagerMorpho,
      };
      // const upgradedContracts =  contracts

      const veHelpers = await makeTestHelpers(
        this.signers.deployer,
        upgradedContracts,
      );

      this.customEnv = {
        contracts: upgradedContracts,
        helpers: veHelpers,
      };

      this.args = {
        morphoPoolId: 0,
        positionId: 0,
        coverId: 0,
        claimId: 0,
        //
        daoLockDuration: 365 * DAY_SECONDS,
        claimResolvePeriod: 186,
        withdrawDelay: 15,
        morphoStrategyId: 3,
        lpAmount: parseUnits("4", 18),
        lpIncreaseAmount: parseUnits("2", 18),
        coverAmount: parseUnits("2", 18),
        coverPremiums: parseUnits("2", 18),
        coverIncreaseAmount: parseUnits("3", 18),
        coverIncreasePremiums: parseUnits("3", 18),
        claimAmount: parseUnits("1.5", 18),
      };
    });

    it("can set the new strategy manager", async function (this: Arguments) {
      expect(
        await postTxHandler(
          this.customEnv.contracts.LiquidityManager.updateConfig(
            this.signers.deployer.address, // ecclesiaDao
            this.customEnv.contracts.StrategyManager.address, // strategyManager
            this.customEnv.contracts.ClaimManager.address, // claimManager
            this.signers.deployer.address, // yieldRewarder
            this.protocolConfig.withdrawDelay, // withdrawDelay
            this.protocolConfig.maxLeverage, // maxLeverage
            this.protocolConfig.leverageFeePerPool, // leverageFeePerPool
          ),
        ),
      ).to.not.throw;
    });

    it("can create pool with Morpho strategy", async function (this: Arguments) {
      const poolId = (
        await this.customEnv.contracts.LiquidityManager.nextPoolId()
      ).toNumber();
      this.args.morphoPoolId = poolId;

      const { uOptimal, r0, rSlope1, rSlope2 } =
        this.protocolConfig.poolFormula;

      expect(
        await postTxHandler(
          this.customEnv.contracts.LiquidityManager.createPool(
            this.customEnv.contracts.WethToken.address, // paymentAsset
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
        await this.customEnv.contracts.LiquidityManager.poolInfo(poolId);
      expect(poolInfo.strategyId).to.equal(this.args.morphoStrategyId);
    });

    it("accepts LP position", async function (this: Arguments) {
      const positionId = (
        await this.customEnv.contracts.AthenaPositionToken.nextPositionId()
      ).toNumber();
      this.args.positionId = positionId;

      expect(
        await this.customEnv.helpers.openPosition(
          this.signers.deployer,
          this.args.lpAmount,
          false,
          [this.args.morphoPoolId], // poolIds
        ),
      ).to.not.throw;

      const position =
        await this.customEnv.contracts.LiquidityManager.positionInfo(
          positionId,
        );

      expect(position.supplied).to.equal(this.args.lpAmount);
      expect(position.poolIds.length).to.equal(1);
      expect(position.poolIds[0]).to.equal(this.args.morphoPoolId);
    });

    it("accepts cover", async function (this: Arguments) {
      const coverId = (
        await this.customEnv.contracts.AthenaCoverToken.nextCoverId()
      ).toNumber();
      this.args.coverId = coverId;

      expect(
        await this.customEnv.helpers.openCover(
          this.signers.deployer,
          this.args.morphoPoolId,
          this.args.coverAmount,
          this.args.coverPremiums,
        ),
      ).to.not.throw;

      const cover =
        await this.customEnv.contracts.LiquidityManager.coverInfo(coverId);

      expect(cover.poolId).to.equal(this.args.morphoPoolId);
      expect(cover.coverAmount).to.equal(this.args.coverAmount);
      expect(cover.isActive).to.be.true;
    });

    it("can take interests", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 2 });

      const positionBefore =
        await this.customEnv.contracts.LiquidityManager.positionInfo(
          this.args.positionId,
        );

      expect(
        await postTxHandler(
          this.customEnv.contracts.LiquidityManager.takeInterests(
          this.args.positionId,
          ),
        ),
      ).to.not.throw;

      const positionAfter =
        await this.customEnv.contracts.LiquidityManager.positionInfo(
          this.args.positionId,
        );

      expect(positionBefore.coverRewards[0]).to.not.equal(0);
      expect(positionAfter.coverRewards[0]).to.equal(0);
    });

    it("can create and resolve claim", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 365 });

      const claimId = (
        await this.customEnv.contracts.ClaimManager.nextClaimId()
      ).toNumber();
      this.args.claimId = claimId;

      expect(
        await this.customEnv.helpers.initiateClaim(
          this.signers.deployer,
          this.args.coverId,
          this.args.claimAmount,
        ),
      ).to.not.throw;

      const claim = await this.customEnv.contracts.ClaimManager.claims(claimId);
      expect(claim.status).to.equal(0);
      expect(claim.amount).to.equal(this.args.claimAmount);

      await setNextBlockTimestamp({ days: this.args.claimResolvePeriod });

      expect(
        await postTxHandler(
          this.customEnv.contracts.ClaimManager.withdrawCompensation(claimId),
        ),
      ).to.not.throw;
    });

    it("can increase LP position", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: 365 });

      await this.customEnv.helpers.addLiquidity(
        this.signers.deployer,
        this.args.positionId,
        this.args.lpIncreaseAmount,
        false,
      );

      const position =
        await this.customEnv.contracts.LiquidityManager.positionInfo(
          this.args.positionId,
        );

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
          this.args.coverId,
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
          this.args.coverId,
          0,
          0,
          0,
          uint256Max,
        ),
      ).to.not.throw;

      const cover = await this.customEnv.contracts.LiquidityManager.coverInfo(
        this.args.coverId,
      );
      expect(cover.premiumsLeft).to.equal(0);
    });

    it("can withdraw LP position", async function (this: Arguments) {
      await setNextBlockTimestamp({ days: this.args.withdrawDelay });

      expect(
        await postTxHandler(
          this.customEnv.contracts.LiquidityManager.commitRemoveLiquidity(
            this.args.positionId,
          ),
        ),
      ).to.not.throw;

      await setNextBlockTimestamp({ days: this.args.withdrawDelay });

      const positionInfo =
        await this.customEnv.contracts.LiquidityManager.positionInfo(
          this.args.positionId,
        );
      expect(
        await postTxHandler(
          this.customEnv.contracts.LiquidityManager.removeLiquidity(
            this.args.positionId,
            positionInfo.newUserCapital,
            true,
          ),
        ),
      ).to.not.throw;

      const finalPosition =
        await this.customEnv.contracts.LiquidityManager.positionInfo(
          this.args.positionId,
        );
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
