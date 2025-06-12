import { expect } from "chai";
import { ethers } from "ethers";
import { getNetworkAddresses } from "../../scripts/verificationData/addresses";
import {
  getConnectedProtocolContracts,
  EthereumConnectedProtocolContracts,
} from "../helpers/contracts-getters";
import {
  entityProviderChainId,
  postTxHandler,
  impersonateAccount,
} from "../helpers/hardhat";
import { makeIdArray } from "../helpers/miscUtils";
import { deployProtocolManager } from "../helpers/deployers";
import { ProtocolManager } from "../../typechain";

interface Arguments extends Mocha.Context {
  customEnv: {
    contracts: EthereumConnectedProtocolContracts;
    ProtocolManager: ProtocolManager;
  };
  args: {
    chainId: number;
    nbPools: number;
    poolIdStart: number;
  };
}

export function ProtocolManagerTest() {
  context("Protocol Manager Tests", function () {
    this.timeout(120_000);

    before(async function (this: Arguments) {
      const chainId = await entityProviderChainId(this.signers.deployer);

      if (chainId !== 1) {
        console.warn("\n\nTest is disabled for non-mainnet network\n\n");
        this.skip();
      }

      // Get deployed contract addresses instead of deploying new ones
      const contracts = await getConnectedProtocolContracts(
        getNetworkAddresses(),
        "ethereum",
      );

      this.customEnv = {
        contracts,
        ProtocolManager: null as any,
      };

      this.args = {
        chainId,
        nbPools: 3,
        poolIdStart: 0,
      };
    });

    it("deploys ProtocolManager correctly", async function (this: Arguments) {
      // Deploy the Protocol Manager with existing contract addresses
      const protocolManager = await deployProtocolManager(
        this.signers.deployer,
        [
          this.customEnv.contracts.AthenaPositionToken.address,
          this.customEnv.contracts.AthenaCoverToken.address,
          this.customEnv.contracts.LiquidityManager.address,
          this.customEnv.contracts.StrategyManager.address,
          this.customEnv.contracts.ClaimManager.address,
          this.signers.deployer.address, // EcclesiaDao address - using deployer for testing
          this.signers.deployer.address, // YieldRewarder address - using deployer for testing
          this.signers.buybackWallet.address,
          this.signers.deployer.address, // EvidenceGuardian address - using deployer for testing
        ],
      );

      this.customEnv.ProtocolManager = protocolManager;

      // Verify contract addresses were set correctly
      expect(
        (await this.customEnv.ProtocolManager.positionToken()).toLowerCase(),
      ).to.equal(
        this.customEnv.contracts.AthenaPositionToken.address.toLowerCase(),
      );

      expect(
        (await this.customEnv.ProtocolManager.coverToken()).toLowerCase(),
      ).to.equal(
        this.customEnv.contracts.AthenaCoverToken.address.toLowerCase(),
      );

      expect(
        (await this.customEnv.ProtocolManager.liquidityManager()).toLowerCase(),
      ).to.equal(
        this.customEnv.contracts.LiquidityManager.address.toLowerCase(),
      );

      expect(
        (await this.customEnv.ProtocolManager.strategyManager()).toLowerCase(),
      ).to.equal(
        this.customEnv.contracts.StrategyManager.address.toLowerCase(),
      );

      expect(
        (await this.customEnv.ProtocolManager.claimManager()).toLowerCase(),
      ).to.equal(this.customEnv.contracts.ClaimManager.address.toLowerCase());

      expect(
        (await this.customEnv.ProtocolManager.buybackWallet()).toLowerCase(),
      ).to.equal(this.signers.buybackWallet.address.toLowerCase());
    });

    it("transfers ownership of contracts to ProtocolManager", async function (this: Arguments) {
      const contractsToTransferOwnership = [
        this.customEnv.contracts.LiquidityManager,
        this.customEnv.contracts.StrategyManager,
        this.customEnv.contracts.ClaimManager,
      ];

      for (const contract of contractsToTransferOwnership) {
        const owner = await contract.owner();
        const ownerSigner = await impersonateAccount(owner);

        await postTxHandler(
          contract
            .connect(ownerSigner)
            .transferOwnership(this.customEnv.ProtocolManager.address),
        );

        expect(await contract.owner()).to.equal(
          this.customEnv.ProtocolManager.address,
        );
      }
    });

    it("batch pauses pools", async function (this: Arguments) {
      // Get the current pool count to make sure we don't try to pause non-existent pools
      const poolCount = (
        await this.customEnv.contracts.LiquidityManager.nextPoolId()
      ).toNumber();

      // Create array of pool IDs to pause
      const poolIds = makeIdArray(poolCount);

      // Pause pools
      expect(
        await postTxHandler(
          this.customEnv.ProtocolManager.batchPausePool(poolIds, true),
        ),
      ).to.not.throw;

      // Verify pools are paused
      const poolInfos =
        await this.customEnv.contracts.LiquidityManager.poolInfos(poolIds);
      for (let i = 0; i < poolCount; i++) {
        expect(poolInfos[i].isPaused).to.be.true;
      }

      // Unpause pools
      expect(
        await postTxHandler(
          this.customEnv.ProtocolManager.batchPausePool(poolIds, false),
        ),
      ).to.not.throw;

      // Verify pools are unpaused
      for (let i = 0; i < poolCount; i++) {
        const poolInfo =
          await this.customEnv.contracts.LiquidityManager.poolInfo(i);
        expect(poolInfo.isPaused).to.be.false;
      }
    });

    it("batch updates pool config", async function (this: Arguments) {
      // Get the current pool count
      const poolCount = (
        await this.customEnv.contracts.LiquidityManager.nextPoolId()
      ).toNumber();

      if (poolCount === 0) {
        console.warn(
          "\n\nSkipping pool config update test as there are no pools\n\n",
        );
        return;
      }

      // Store original pool configurations
      const originalConfigs = await Promise.all(
        makeIdArray(poolCount).map(async (id) => {
          const poolInfo =
            await this.customEnv.contracts.LiquidityManager.poolInfo(id);
          return {
            poolId: id,
            feeRate: poolInfo.feeRate,
            uOptimal: poolInfo.formula.uOptimal,
            r0: poolInfo.formula.r0,
            rSlope1: poolInfo.formula.rSlope1,
            rSlope2: poolInfo.formula.rSlope2,
          };
        }),
      );

      // Create new configurations (increment fee rate by 1%)
      const newConfigs = originalConfigs.map((config) => ({
        ...config,
        feeRate: config.feeRate.add(ethers.utils.parseUnits("0.01", 18)), // Add 1% to fee rate
      }));

      // Update pool configurations
      expect(
        await postTxHandler(
          this.customEnv.ProtocolManager.batchUpdatePoolConfig(newConfigs),
        ),
      ).to.not.throw;

      // Verify configurations were updated
      for (let i = 0; i < poolCount; i++) {
        const poolInfo =
          await this.customEnv.contracts.LiquidityManager.poolInfo(i);
        expect(poolInfo.feeRate).to.equal(
          originalConfigs[i].feeRate.add(ethers.utils.parseUnits("0.01", 18)),
        );
      }
    });

    it("updates LiquidityManager config", async function (this: Arguments) {
      // Get original config
      const [
        originalWithdrawDelay,
        originalMaxLeverage,
        originalLeverageFeePerPool,
      ] = await Promise.all([
        this.customEnv.contracts.LiquidityManager.withdrawDelay(),
        this.customEnv.contracts.LiquidityManager.maxLeverage(),
        this.customEnv.contracts.LiquidityManager.leverageFeePerPool(),
      ]);

      // New values
      const newWithdrawDelay = originalWithdrawDelay.add(1);
      const newMaxLeverage = originalMaxLeverage.add(1);
      const newLeverageFeePerPool = originalLeverageFeePerPool.add(1);

      // Update config
      expect(
        await postTxHandler(
          this.customEnv.ProtocolManager.updateLiquidityManagerConfig(
            newWithdrawDelay,
            newMaxLeverage,
            newLeverageFeePerPool,
          ),
        ),
      ).to.not.throw;

      // Verify config was updated
      const [
        updatedWithdrawDelay,
        updatedMaxLeverage,
        updatedLeverageFeePerPool,
      ] = await Promise.all([
        this.customEnv.contracts.LiquidityManager.withdrawDelay(),
        this.customEnv.contracts.LiquidityManager.maxLeverage(),
        this.customEnv.contracts.LiquidityManager.leverageFeePerPool(),
      ]);

      expect(updatedWithdrawDelay).to.equal(newWithdrawDelay);
      expect(updatedMaxLeverage).to.equal(newMaxLeverage);
      expect(updatedLeverageFeePerPool).to.equal(newLeverageFeePerPool);
    });

    it("updates StrategyManager configs", async function (this: Arguments) {
      // Get original values
      const originalFeeRate =
        await this.customEnv.contracts.StrategyManager.strategyFeeRate();
      const originalDeductibleRate =
        await this.customEnv.contracts.StrategyManager.payoutDeductibleRate();

      // New values (increase by 1%)
      const newFeeRate = originalFeeRate.add(
        ethers.utils.parseUnits("0.01", 18),
      );
      const newDeductibleRate = originalDeductibleRate.add(
        ethers.utils.parseUnits("0.01", 18),
      );

      // Update strategy fee rate
      expect(
        await postTxHandler(
          this.customEnv.ProtocolManager.updateStrategyFeeRate(newFeeRate),
        ),
      ).to.not.throw;

      // Verify strategy fee rate was updated
      expect(
        await this.customEnv.contracts.StrategyManager.strategyFeeRate(),
      ).to.equal(newFeeRate);

      // Update payout deductible rate
      expect(
        await postTxHandler(
          this.customEnv.ProtocolManager.updatePayoutDeductibleRate(
            newDeductibleRate,
          ),
        ),
      ).to.not.throw;

      // Verify payout deductible rate was updated
      expect(
        await this.customEnv.contracts.StrategyManager.payoutDeductibleRate(),
      ).to.equal(newDeductibleRate);
    });

    it("updates ClaimManager periods", async function (this: Arguments) {
      // Get original values
      const originalChallengePeriod =
        await this.customEnv.contracts.ClaimManager.challengePeriod();
      const originalOverrulePeriod =
        await this.customEnv.contracts.ClaimManager.overrulePeriod();
      const originalEvidenceUploadPeriod =
        await this.customEnv.contracts.ClaimManager.evidenceUploadPeriod();

      // New values (increase by 1 day)
      const newChallengePeriod = originalChallengePeriod.add(24 * 60 * 60);
      const newOverrulePeriod = originalOverrulePeriod.add(24 * 60 * 60);
      const newEvidenceUploadPeriod = originalEvidenceUploadPeriod.add(
        24 * 60 * 60,
      );

      // Update periods
      expect(
        await postTxHandler(
          this.customEnv.ProtocolManager.setPeriods(
            newChallengePeriod,
            newOverrulePeriod,
            newEvidenceUploadPeriod,
          ),
        ),
      ).to.not.throw;

      // Verify periods were updated
      expect(
        await this.customEnv.contracts.ClaimManager.challengePeriod(),
      ).to.equal(newChallengePeriod);
      expect(
        await this.customEnv.contracts.ClaimManager.overrulePeriod(),
      ).to.equal(newOverrulePeriod);
      expect(
        await this.customEnv.contracts.ClaimManager.evidenceUploadPeriod(),
      ).to.equal(newEvidenceUploadPeriod);
    });

    it("sets address updates with setAddresses", async function (this: Arguments) {
      // Store original addresses
      const originalYieldRewarder =
        await this.customEnv.ProtocolManager.yieldRewarder();
      const originalPositionToken =
        await this.customEnv.ProtocolManager.positionToken();

      // Set a new yield rewarder address
      const newYieldRewarder = this.signers.user1.address;

      expect(originalYieldRewarder).to.not.equal(newYieldRewarder);

      // Update only yieldRewarder, passing zeros for all other addresses to keep them the same
      expect(
        await postTxHandler(
          this.customEnv.ProtocolManager.setAddresses(
            ethers.constants.AddressZero, // positionToken - unchanged
            ethers.constants.AddressZero, // coverToken - unchanged
            ethers.constants.AddressZero, // liquidityManager - unchanged
            ethers.constants.AddressZero, // strategyManager - unchanged
            ethers.constants.AddressZero, // claimManager - unchanged
            ethers.constants.AddressZero, // ecclesiaDao - unchanged
            newYieldRewarder, // yieldRewarder - new
            ethers.constants.AddressZero, // buybackWallet - unchanged
            ethers.constants.AddressZero, // evidenceGuardian - unchanged
          ),
        ),
      ).to.not.throw;

      const updatedYieldRewarder =
        await this.customEnv.ProtocolManager.yieldRewarder();
      const updatedPositionToken =
        await this.customEnv.ProtocolManager.positionToken();

      // Verify only yieldRewarder was updated
      expect(updatedYieldRewarder).to.equal(newYieldRewarder);
      // Make sure other addresses remained unchanged
      expect(updatedPositionToken).to.equal(originalPositionToken);
    });

    it("can freeze and unfreeze the protocol", async function (this: Arguments) {
      // Get original frozen state
      expect(
        this.customEnv.contracts.LiquidityManager.openPosition(0, false, [0]),
      ).to.revertTransactionWith("0x701c25de");

      // Freeze protocol
      expect(
        await postTxHandler(
          this.customEnv.ProtocolManager.freezeProtocol(true),
        ),
      ).to.not.throw;

      // Verify protocol is frozen
      expect(
        this.customEnv.contracts.LiquidityManager.openPosition(0, false, [0]),
      ).to.revertTransactionWith("ProtocolIsFrozen");

      // Unfreeze protocol
      expect(
        await postTxHandler(
          this.customEnv.ProtocolManager.freezeProtocol(false),
        ),
      ).to.not.throw;

      // Verify protocol is unfrozen
      expect(
        this.customEnv.contracts.LiquidityManager.openPosition(0, false, [0]),
      ).to.revertTransactionWith("0x701c25de");
    });

    it("allows transferring ownership of multiple contracts at once", async function (this: Arguments) {
      const newOwner = this.signers.user1.address;
      const contractsToTransfer = [
        this.customEnv.contracts.LiquidityManager.address,
        this.customEnv.contracts.ClaimManager.address,
      ];

      // Transfer ownership
      expect(
        await postTxHandler(
          this.customEnv.ProtocolManager.transferContractOwnership(
            contractsToTransfer,
            newOwner,
          ),
        ),
      ).to.not.throw;

      // Verify ownership was transferred
      expect(await this.customEnv.contracts.LiquidityManager.owner()).to.equal(
        newOwner,
      );

      expect(await this.customEnv.contracts.ClaimManager.owner()).to.equal(
        newOwner,
      );

      // Return ownership back to the test administrator's address for cleanup
      await this.customEnv.contracts.LiquidityManager.connect(
        this.signers.user1,
      ).transferOwnership(this.signers.deployer.address);
      await this.customEnv.contracts.ClaimManager.connect(
        this.signers.user1,
      ).transferOwnership(this.signers.deployer.address);
    });
  });
}
