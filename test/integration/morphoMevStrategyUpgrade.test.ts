import { expect } from "chai";
import { ethers, utils } from "ethers";
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
import {
  deployStrategyManagerMorpho,
  deployStrategyManagerVE,
  deployBasicProxy,
} from "../helpers/deployers";
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
  getProxyAdmin,
  getProxyImplementation,
} from "../helpers/hardhat";
import { makeTestHelpers, TestHelper } from "../helpers/protocol";
import { getCoverRewards } from "../helpers/utils/poolRayMath";
import { BigNumber } from "ethers";
import {
  ERC20Basic__factory,
  BasicProxy,
  BasicProxy__factory,
  ProxyAdmin__factory,
  StrategyManagerMorpho__factory,
  StrategyManagerVE__factory,
} from "../../typechain";

const { parseUnits } = utils;
const DAY_SECONDS = 24 * 60 * 60;

interface Arguments extends Mocha.Context {
  customEnv: {
    contracts: MorphoProtocolContracts | MorphoConnectedProtocolContracts;
    helpers: TestHelper;
  };
  args: {
    ProxyContract: BasicProxy;
    chainId: number;
    morphoPoolId: number;
    positionId: number;
    coverId: number;
    claimId: number;
    nbPools: number;
    assets: string[];
    daoLockDuration: number;
    claimResolvePeriod: number;
    withdrawDelay: number;
    aaveStrategyId: number;
    morphoStrategyId: number;
    //
    lpAmount: BigNumber;
    coverAmount: BigNumber;
    coverPremiums: BigNumber;
    claimAmount: BigNumber;
    lpIncreaseAmount: BigNumber;
    coverIncreaseAmount: BigNumber;
    coverIncreasePremiums: BigNumber;
    //
    lpAmountUsd: BigNumber;
    lpIncreaseAmountUsd: BigNumber;
    coverAmountUsd: BigNumber;
    coverPremiumsUsd: BigNumber;
    coverIncreaseAmountUsd: BigNumber;
    coverIncreasePremiumsUsd: BigNumber;
    claimAmountUsd: BigNumber;
  };
}

export function MorphoStrategyUpgradeTest() {
  context("Morpho Strategy Test", function () {
    this.timeout(120_000);

    before(async function (this: Arguments) {
      this.protocolConfig = getDefaultProtocolConfig("amphor");
      const chainId = await entityProviderChainId(this.signers.deployer);

      if (chainId !== 1) {
        console.warn("\n\nTest is disabled for non-mainnet network\n\n");
        this.skip();
      }
      if (!this.protocolConfig.amphrETH || !this.protocolConfig.amphrLRT) {
        throw new Error("amphrETH or amphrLRT not set in protocol config");
      }

      const contracts = await getConnectedProtocolContracts(
        getNetworkAddresses(),
        "ethereum-morpho",
      );

      const veHelpers = await makeTestHelpers(this.signers.deployer, contracts);

      this.customEnv = {
        contracts: contracts,
        helpers: veHelpers,
      };

      const emptyProxy = BasicProxy__factory.connect(
        ethers.constants.AddressZero,
        this.signers.deployer,
      );

      this.args = {
        chainId,
        ProxyContract: emptyProxy,
        morphoPoolId: 0,
        positionId: 0,
        coverId: 0,
        claimId: 0,
        //
        daoLockDuration: 365 * DAY_SECONDS,
        claimResolvePeriod: 186,
        withdrawDelay: 15,
        nbPools: 3,
        assets: [
          this.protocolConfig.amphrETH,
          this.protocolConfig.amphrLRT,
          usdcTokenAddress(chainId),
        ],
        aaveStrategyId: 0,
        morphoStrategyId: 3,
        //
        lpAmount: parseUnits("4", 18),
        lpIncreaseAmount: parseUnits("2", 18),
        coverAmount: parseUnits("2", 18),
        coverPremiums: parseUnits("2", 18),
        coverIncreaseAmount: parseUnits("3", 18),
        coverIncreasePremiums: parseUnits("3", 18),
        claimAmount: parseUnits("1.5", 18),
        //
        lpAmountUsd: parseUnits("1000", 6),
        lpIncreaseAmountUsd: parseUnits("1500", 6),
        coverAmountUsd: parseUnits("1000", 6),
        coverPremiumsUsd: parseUnits("1000", 6),
        coverIncreaseAmountUsd: parseUnits("400", 6),
        coverIncreasePremiumsUsd: parseUnits("50", 6),
        claimAmountUsd: parseUnits("200", 6),
      };
    });

    describe("setup proxy contract", async function () {
      it("can deploy basic proxy", async function (this: Arguments) {
        const proxy = await deployBasicProxy(this.signers.deployer, [
          this.customEnv.contracts.StrategyManager.address, // implementation
          this.signers.deployer.address, // owner
        ]);
        expect(proxy).to.not.be.undefined;

        this.args.ProxyContract = proxy;
      });

      it("can call setter functions through proxy", async function (this: Arguments) {
        const proxy = this.args.ProxyContract;

        if (proxy.address === ethers.constants.AddressZero)
          throw Error("Proxy contract not initialized");

        const strategyManager = StrategyManagerMorpho__factory.connect(
          proxy.address,
          this.signers.deployer,
        );

        // Initialize state using existing setters
        await strategyManager
          .updateAddressList(
            this.customEnv.contracts.LiquidityManager.address,
            this.customEnv.contracts.EcclesiaDao.address,
            this.signers.buybackWallet.address,
          )
          .then((tx) => tx.wait());
        await strategyManager
          .updateStrategyFeeRate(this.protocolConfig.strategyFeeRate)
          .then((tx) => tx.wait());
        await strategyManager
          .updatePayoutDeductibleRate(this.protocolConfig.payoutDeductibleRate)
          .then((tx) => tx.wait());

        // Verify state was updated
        const [
          liquidityManager,
          ecclesiaDao,
          buybackWallet,
          strategyFeeRate,
          payoutDeductibleRate,
        ] = await Promise.all([
          strategyManager.liquidityManager(),
          strategyManager.ecclesiaDao(),
          strategyManager.buybackWallet(),
          strategyManager.strategyFeeRate(),
          strategyManager.payoutDeductibleRate(),
        ]);

        expect(liquidityManager.toLowerCase()).to.equal(
          this.customEnv.contracts.LiquidityManager.address.toLowerCase(),
        );
        expect(ecclesiaDao.toLowerCase()).to.equal(
          this.customEnv.contracts.EcclesiaDao.address.toLowerCase(),
        );
        expect(buybackWallet.toLowerCase()).to.equal(
          this.signers.buybackWallet.address.toLowerCase(),
        );
        expect(strategyFeeRate).to.equal(this.protocolConfig.strategyFeeRate);
        expect(payoutDeductibleRate).to.equal(
          this.protocolConfig.payoutDeductibleRate,
        );
      });

      it("can set the new strategy manager", async function (this: Arguments) {
        expect(
          await postTxHandler(
            this.customEnv.contracts.LiquidityManager.updateConfig(
              this.signers.deployer.address, // ecclesiaDao
              this.args.ProxyContract.address, // strategyManager
              this.customEnv.contracts.ClaimManager.address, // claimManager
              this.signers.deployer.address, // yieldRewarder
              this.protocolConfig.withdrawDelay, // withdrawDelay
              this.protocolConfig.maxLeverage, // maxLeverage
              this.protocolConfig.leverageFeePerPool, // leverageFeePerPool
            ),
          ),
        ).to.not.throw;

        const strategyManager =
          await this.customEnv.contracts.LiquidityManager.strategyManager();
        expect(strategyManager).to.equal(this.args.ProxyContract?.address);
      });
    });

    describe("test protocol with proxy", async function () {
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
          await this.customEnv.contracts.LiquidityManager.takeInterests(
            this.args.positionId,
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
          await this.customEnv.contracts.ClaimManager.withdrawCompensation(
            claimId,
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

    describe("perform proxy implementation upgrade", async function () {
      it("deploys new implementation and upgrades proxy", async function (this: Arguments) {
        const proxyAdminAddress = await getProxyAdmin(this.args.ProxyContract);
        const oldImplementationAddress = await getProxyImplementation(
          this.args.ProxyContract,
        );

        // Deploy new implementation
        const newImplementation = await deployStrategyManagerVE(
          this.signers.deployer,
          [
            this.customEnv.contracts.LiquidityManager.address,
            this.signers.deployer.address,
            aaveLendingPoolV3Address(this.args.chainId),
            usdcTokenAddress(this.args.chainId),
            this.protocolConfig.buybackWallet.address,
            this.protocolConfig.payoutDeductibleRate,
            this.protocolConfig.strategyFeeRate,
            this.protocolConfig.wstETH as string,
            this.protocolConfig.amphrETH as string,
            this.protocolConfig.amphrLRT as string,
          ],
        );

        const proxyAdmin = ProxyAdmin__factory.connect(
          proxyAdminAddress,
          this.signers.deployer,
        );

        // Upgrade through proxy admin
        await proxyAdmin.upgradeAndCall(
          this.args.ProxyContract.address,
          newImplementation.address,
          "",
        );

        // Verify implementation was changed
        const currentImplementation = await getProxyImplementation(
          this.args.ProxyContract,
        );
        expect(currentImplementation).to.equal(newImplementation.address);
        expect(currentImplementation).to.not.equal(oldImplementationAddress);
      });

      it("preserves state after upgrade", async function (this: Arguments) {
        const liquidityManager =
          await this.customEnv.contracts.StrategyManager.liquidityManager();
        expect(liquidityManager).to.equal(
          this.customEnv.contracts.LiquidityManager.address,
        );

        const ecclesiaDao =
          await this.customEnv.contracts.StrategyManager.ecclesiaDao();
        expect(ecclesiaDao).to.equal(this.signers.deployer.address);

        const usdc = await this.customEnv.contracts.StrategyManager.USDC();
        expect(usdc).to.equal(usdcTokenAddress(this.args.chainId));
      });

      it("verifies new implementation changes", async function (this: Arguments) {
        const proxy = this.args.ProxyContract;

        if (proxy.address === ethers.constants.AddressZero)
          throw Error("Proxy contract not initialized");

        const strategyManager = StrategyManagerVE__factory.connect(
          proxy.address,
          this.signers.deployer,
        );

        // Verify new functionality exists
        expect(await strategyManager.isWhitelistEnabled()).to.equal(false);

        // Verify old functions are removed
        await expect(
          strategyManager.wrappedToUnderlying(3, 0),
        ).to.revertTransactionWith("NotAValidStrategy");
      });

      it("only admin can upgrade implementation", async function (this: Arguments) {
        const proxyAdminAddress = await getProxyAdmin(this.args.ProxyContract);

        const proxyAdmin = ProxyAdmin__factory.connect(
          proxyAdminAddress,
          this.signers.user1,
        );

        // Should revert when non-admin tries to upgrade
        await expect(
          proxyAdmin.upgradeAndCall(
            this.args.ProxyContract.address,
            this.customEnv.contracts.StrategyManager.address,
            "",
          ),
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("test protocol after proxy upgrade", async function () {
      it("can create pools", async function (this: Arguments) {
        const existingPools = (
          await this.customEnv.contracts.LiquidityManager.nextPoolId()
        ).toNumber();

        for (let i = existingPools; i < this.args.nbPools; i++) {
          const poolId = i;

          const { uOptimal, r0, rSlope1, rSlope2 } =
            this.protocolConfig.poolFormula;

          const strategy = i === this.args.aaveStrategyId ? 0 : i;

          // Create a pool
          expect(
            await postTxHandler(
              this.customEnv.contracts.LiquidityManager.createPool(
                this.args.assets[i], // paymentAsset
                strategy, // strategyId
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
            i === this.args.aaveStrategyId
              ? this.customEnv.contracts.CircleToken.address
              : this.protocolConfig.wstETH,
          );
          expect(poolInfo.strategyId).to.equal(0);
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
          const lpAmount =
            i === this.args.aaveStrategyId
              ? this.args.lpAmountUsd
              : this.args.lpAmount;

          expect(
            await this.customEnv.helpers.openPosition(
              this.signers.deployer,
              lpAmount,
              i === this.args.aaveStrategyId ? false : true,
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
            i === this.args.aaveStrategyId
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
            i === this.args.aaveStrategyId
              ? this.args.coverAmountUsd
              : this.args.coverAmount;

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

          expect(
            await this.customEnv.contracts.LiquidityManager.takeInterests(i),
          ).to.not.throw;

          const position =
            await this.customEnv.contracts.LiquidityManager.positionInfo(i);

          expect(positionBefore.coverRewards[0]).to.not.equal(0);
        }
      });

      it("can create claims", async function (this: Arguments) {
        await setNextBlockTimestamp({ days: 365 });

        for (let i = 0; i < this.args.nbPools; i++) {
          const claimAmount =
            i === this.args.aaveStrategyId
              ? this.args.claimAmountUsd
              : this.args.claimAmount;

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
        await setNextBlockTimestamp({ days: this.args.claimResolvePeriod });

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
            i === this.args.aaveStrategyId
              ? this.args.lpIncreaseAmountUsd
              : this.args.lpIncreaseAmount;

          await this.customEnv.helpers.addLiquidity(
            this.signers.deployer,
            i,
            lpIncreaseAmount,
            i === this.args.aaveStrategyId ? false : true,
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
            i === this.args.aaveStrategyId
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
            i === this.args.aaveStrategyId ? "350682" : "3506823988457635",
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
            i === this.args.aaveStrategyId
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
        await setNextBlockTimestamp({ days: this.args.withdrawDelay });

        const expectedTimestamp = await getCurrentTime();

        for (let i = 0; i < this.args.nbPools; i++) {
          expect(
            await postTxHandler(
              this.customEnv.contracts.LiquidityManager.commitRemoveLiquidity(
                i,
              ),
            ),
          ).to.not.throw;

          const position =
            await this.customEnv.contracts.LiquidityManager.positionInfo(i);

          expect(position.commitWithdrawalTimestamp.div(100)).to.almostEqual(
            Math.floor(expectedTimestamp / 100),
          );
        }
      });

      it("can withdraw LPs", async function (this: Arguments) {
        // Wait for unlock delay to pass
        await setNextBlockTimestamp({ days: this.args.withdrawDelay });

        for (let i = 0; i < this.args.nbPools; i++) {
          const positionInfo =
            await this.customEnv.contracts.LiquidityManager.positionInfo(i);

          expect(
            await postTxHandler(
              this.customEnv.contracts.LiquidityManager.removeLiquidity(
                i,
                positionInfo.newUserCapital,
                i === this.args.aaveStrategyId ? false : true,
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
    });
  });
}
