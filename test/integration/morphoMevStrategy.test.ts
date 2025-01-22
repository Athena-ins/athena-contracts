import { expect } from "chai";
import { BigNumber, utils } from "ethers";
import { getNetworkAddresses } from "../../scripts/verificationData/addresses";
import {
  AmphorStrategyParams,
  getDefaultProtocolConfig,
} from "../../scripts/verificationData/deployParams";
import { ProxyAdmin__factory } from "../../typechain";
import {
  getConnectedProtocolContracts,
  MorphoConnectedProtocolContracts,
} from "../helpers/contracts-getters";
import {
  deployStrategyManagerEthereum,
  ProtocolConfig,
} from "../helpers/deployers";
import {
  MorphoProtocolContracts,
  deployAllContractsAndInitializeProtocolMorpho,
} from "../helpers/deployersMorpho";
import {
  entityProviderChainId,
  getProxyAdmin,
  getProxyImplementation,
  postTxHandler,
  setNextBlockTimestamp,
} from "../helpers/hardhat";
import {
  aaveLendingPoolV3Address,
  makeTestHelpers,
  TestHelper,
  usdcTokenAddress,
} from "../helpers/protocol";

const { parseUnits } = utils;
const DAY_SECONDS = 24 * 60 * 60;

interface Arguments extends Mocha.Context {
  customEnv: {
    protocolConfig: ProtocolConfig & AmphorStrategyParams;
    contracts: MorphoProtocolContracts | MorphoConnectedProtocolContracts;
    helpers: TestHelper;
  };
  args: {
    chainId: number;
    morphoPoolId: number;
    inceptionPoolId: number;
    positionId: number;
    inceptionPositionId: number;
    coverId: number;
    inceptionCoverId: number;
    claimId: number;
    inceptionClaimId: number;
    daoLockDuration: number;
    claimResolvePeriod: number;
    withdrawDelay: number;
    morphoStrategyId: number;
    inceptionStrategyId: number;
    lpAmount: BigNumber;
    coverAmount: BigNumber;
    coverPremiums: BigNumber;
    claimAmount: BigNumber;
    lpIncreaseAmount: BigNumber;
    coverIncreaseAmount: BigNumber;
    coverIncreasePremiums: BigNumber;
  };
}

export function EthereumStrategyTest() {
  context("Ethereum Strategy Test", function () {
    this.timeout(120_000);

    before(async function (this: Arguments) {
      const chainId = await entityProviderChainId(this.signers.deployer);

      if (chainId !== 1) {
        console.warn("\n\nTest is disabled for non-mainnet network\n\n");
        this.skip();
      }

      const protocolConfig = getDefaultProtocolConfig("mainnet");
      const contracts = await getConnectedProtocolContracts(
        getNetworkAddresses(),
        "ethereum-morpho",
      );
      // const contracts = await deployAllContractsAndInitializeProtocolMorpho(
      //   this.signers.deployer,
      //   this.customEnv.protocolConfig,
      // );
      const helpers = await makeTestHelpers(this.signers.deployer, contracts);

      this.customEnv = {
        protocolConfig,
        contracts,
        helpers,
      };

      this.args = {
        chainId,
        morphoPoolId: 0,
        inceptionPoolId: 0,
        positionId: 0,
        inceptionPositionId: 0,
        coverId: 0,
        inceptionCoverId: 0,
        claimId: 0,
        inceptionClaimId: 0,
        daoLockDuration: 365 * DAY_SECONDS,
        claimResolvePeriod: 186,
        withdrawDelay: 15,
        morphoStrategyId: 3,
        inceptionStrategyId: 4,
        lpAmount: parseUnits("4", 18),
        lpIncreaseAmount: parseUnits("2", 18),
        coverAmount: parseUnits("2", 18),
        coverPremiums: parseUnits("2", 18),
        coverIncreaseAmount: parseUnits("3", 18),
        coverIncreasePremiums: parseUnits("3", 18),
        claimAmount: parseUnits("1.5", 18),
      };
    });

    it("deploys new implementation and upgrades proxy", async function (this: Arguments) {
      const strategyManagerProxy =
        this.customEnv.contracts.ProxyStrategyManager;

      if (!strategyManagerProxy)
        throw Error("ProxyStrategyManager address is missing");

      const proxyAdminAddress = await getProxyAdmin(strategyManagerProxy);
      const oldImplementationAddress =
        await getProxyImplementation(strategyManagerProxy);

      // Deploy new implementation
      const newImplementation = await deployStrategyManagerEthereum(
        this.signers.deployer,
        [
          this.customEnv.contracts.LiquidityManager.address,
          this.signers.deployer.address, // EcclesiaDao
          aaveLendingPoolV3Address(this.args.chainId),
          usdcTokenAddress(this.args.chainId),
          this.customEnv.protocolConfig.buybackWallet.address,
          this.customEnv.protocolConfig.payoutDeductibleRate,
          this.customEnv.protocolConfig.strategyFeeRate,
          this.customEnv.protocolConfig.wstETH,
          this.customEnv.protocolConfig.amphrETH,
          this.customEnv.protocolConfig.amphrLRT,
          this.customEnv.protocolConfig.morphoMevVault,
          this.customEnv.protocolConfig.inceptionVault,
        ],
      );

      const proxyAdmin = ProxyAdmin__factory.connect(
        proxyAdminAddress,
        this.signers.deployer,
      );

      expect(
        await postTxHandler(
          proxyAdmin.upgradeAndCall(
            strategyManagerProxy.address,
            newImplementation.address,
            "0x",
          ),
        ),
      ).to.not.throw;

      // Verify implementation was changed
      const currentImplementation =
        await getProxyImplementation(strategyManagerProxy);
      expect(currentImplementation).to.equal(newImplementation.address);
      expect(currentImplementation).to.not.equal(oldImplementationAddress);

      // Update environment for subsequent tests
      this.customEnv.contracts.StrategyManager = newImplementation;
    });

    describe("Morpho MEV Strategy Tests", function () {
      it("can create pool with Morpho strategy", async function (this: Arguments) {
        const poolId = (
          await this.customEnv.contracts.LiquidityManager.nextPoolId()
        ).toNumber();
        this.args.morphoPoolId = poolId;

        const { uOptimal, r0, rSlope1, rSlope2 } =
          this.customEnv.protocolConfig.poolFormula;

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

        const claim =
          await this.customEnv.contracts.ClaimManager.claims(claimId);
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
    });

    describe("Inception Strategy Tests", function () {
      it("can create pool with Inception strategy", async function (this: Arguments) {
        const poolId = (
          await this.customEnv.contracts.LiquidityManager.nextPoolId()
        ).toNumber();
        this.args.inceptionPoolId = poolId;

        const { uOptimal, r0, rSlope1, rSlope2 } =
          this.customEnv.protocolConfig.poolFormula;

        expect(
          await postTxHandler(
            this.customEnv.contracts.LiquidityManager.createPool(
              this.customEnv.contracts.WethToken.address,
              this.args.inceptionStrategyId,
              0,
              uOptimal,
              r0,
              rSlope1,
              rSlope2,
              [],
            ),
          ),
        ).to.not.throw;

        const poolInfo =
          await this.customEnv.contracts.LiquidityManager.poolInfo(poolId);
        expect(poolInfo.strategyId).to.equal(this.args.inceptionStrategyId);
      });

      it("accepts LP position", async function (this: Arguments) {
        const positionId = (
          await this.customEnv.contracts.AthenaPositionToken.nextPositionId()
        ).toNumber();
        this.args.inceptionPositionId = positionId;

        expect(
          await this.customEnv.helpers.openPosition(
            this.signers.deployer,
            this.args.lpAmount,
            false,
            [this.args.inceptionPoolId], // poolIds
          ),
        ).to.not.throw;

        const position =
          await this.customEnv.contracts.LiquidityManager.positionInfo(
            positionId,
          );

        expect(position.supplied).to.equal(this.args.lpAmount);
        expect(position.poolIds.length).to.equal(1);
        expect(position.poolIds[0]).to.equal(this.args.inceptionPoolId);
      });

      it("accepts cover", async function (this: Arguments) {
        const coverId = (
          await this.customEnv.contracts.AthenaCoverToken.nextCoverId()
        ).toNumber();
        this.args.inceptionCoverId = coverId;

        expect(
          await this.customEnv.helpers.openCover(
            this.signers.deployer,
            this.args.inceptionPoolId,
            this.args.coverAmount,
            this.args.coverPremiums,
          ),
        ).to.not.throw;

        const cover =
          await this.customEnv.contracts.LiquidityManager.coverInfo(coverId);

        expect(cover.poolId).to.equal(this.args.inceptionPoolId);
        expect(cover.coverAmount).to.equal(this.args.coverAmount);
        expect(cover.isActive).to.be.true;
      });

      it("can take interests", async function (this: Arguments) {
        await setNextBlockTimestamp({ days: 2 });

        const positionBefore =
          await this.customEnv.contracts.LiquidityManager.positionInfo(
            this.args.inceptionPositionId,
          );

        expect(
          await postTxHandler(
            this.customEnv.contracts.LiquidityManager.takeInterests(
              this.args.inceptionPositionId,
            ),
          ),
        ).to.not.throw;

        const positionAfter =
          await this.customEnv.contracts.LiquidityManager.positionInfo(
            this.args.inceptionPositionId,
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
            this.args.inceptionCoverId,
            this.args.claimAmount,
          ),
        ).to.not.throw;

        const claim =
          await this.customEnv.contracts.ClaimManager.claims(claimId);
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
          this.args.inceptionPositionId,
          this.args.lpIncreaseAmount,
          false,
        );

        const position =
          await this.customEnv.contracts.LiquidityManager.positionInfo(
            this.args.inceptionPositionId,
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
            this.args.inceptionCoverId,
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
            this.args.inceptionCoverId,
            0,
            0,
            0,
            uint256Max,
          ),
        ).to.not.throw;

        const cover = await this.customEnv.contracts.LiquidityManager.coverInfo(
          this.args.inceptionCoverId,
        );
        expect(cover.premiumsLeft).to.equal(0);
      });

      it("can withdraw LP position", async function (this: Arguments) {
        await setNextBlockTimestamp({ days: this.args.withdrawDelay });

        expect(
          await postTxHandler(
            this.customEnv.contracts.LiquidityManager.commitRemoveLiquidity(
              this.args.inceptionPositionId,
            ),
          ),
        ).to.not.throw;

        await setNextBlockTimestamp({ days: this.args.withdrawDelay });

        const positionInfo =
          await this.customEnv.contracts.LiquidityManager.positionInfo(
            this.args.inceptionPositionId,
          );
        expect(
          await postTxHandler(
            this.customEnv.contracts.LiquidityManager.removeLiquidity(
              this.args.inceptionPositionId,
              positionInfo.newUserCapital,
              true,
            ),
          ),
        ).to.not.throw;

        const finalPosition =
          await this.customEnv.contracts.LiquidityManager.positionInfo(
            this.args.inceptionPositionId,
          );
        expect(finalPosition.supplied).to.equal(0);
        expect(finalPosition.newUserCapital).to.equal(0);
      });
    });

    describe("Strategy View Functions", async function () {
      describe("MetaMorpho Strategy", function () {
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

      describe("Inception Strategy", function () {
        it("verifies reward index", async function (this: Arguments) {
          const rewardIndex =
            await this.customEnv.contracts.StrategyManager.getRewardIndex(
              this.args.inceptionStrategyId,
            );
          expect(rewardIndex).to.be.gt(0);
        });

        it("verifies wrapped/underlying conversions", async function (this: Arguments) {
          const testAmount = parseUnits("1", 18);

          const underlyingAmount =
            await this.customEnv.contracts.StrategyManager.wrappedToUnderlying(
              this.args.inceptionStrategyId,
              testAmount,
            );
          expect(underlyingAmount).to.be.gt(0);

          const wrappedAmount =
            await this.customEnv.contracts.StrategyManager.underlyingToWrapped(
              this.args.inceptionStrategyId,
              testAmount,
            );
          expect(wrappedAmount).to.be.gt(0);
        });

        it("verifies compound status", async function (this: Arguments) {
          const compounds =
            await this.customEnv.contracts.StrategyManager.itCompounds(
              this.args.inceptionStrategyId,
            );
          expect(compounds).to.be.false;
        });

        it("verifies asset addresses", async function (this: Arguments) {
          const [underlying, wrapped] =
            await this.customEnv.contracts.StrategyManager.assets(
              this.args.inceptionStrategyId,
            );

          const inwstETHs =
            await this.customEnv.contracts.StrategyManager.inwstETHs();

          expect(underlying.toLowerCase()).to.equal(
            this.customEnv.protocolConfig.wstETH,
          );
          expect(wrapped.toLowerCase()).to.equal(inwstETHs.toLowerCase());
        });
      });
    });
  });
}
