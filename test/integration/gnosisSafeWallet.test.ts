import { expect } from "chai";
import { ethers } from "ethers";
import { getNetworkAddresses } from "../../scripts/verificationData/addresses";
import {
  getConnectedProtocolContracts,
  MorphoConnectedProtocolContracts,
} from "../helpers/contracts-getters";
import { entityProviderChainId, postTxHandler } from "../helpers/hardhat";
import { deployProtocolManager, deploySafeProxy } from "../helpers/deployers";
import { ProtocolManager } from "../../typechain";
import Safe from "@safe-global/protocol-kit";
import { MetaTransactionData } from "@safe-global/types-kit";

// Define owners array instead of individual addresses
const SAFE_OWNERS = [
  "0x...", // Replace with actual address 1
  "0x...", // Replace with actual address 2
  "0x...", // Replace with actual address 3
];

interface Arguments extends Mocha.Context {
  customEnv: {
    contracts: MorphoConnectedProtocolContracts;
    ProtocolManager: ProtocolManager;
    safeWalletContract: ethers.Contract;
    safeSDK: Safe;
  };
  args: {
    chainId: number;
    safeAddress: string;
    safeOwners: string[];
    //
    yieldRewarder: string;
    buybackWallet: string;
    evidenceGuardian: string;
  };
}

export function GnosisSafeWalletTest() {
  context("Gnosis Safe Integration Tests", function () {
    before(async function (this: Arguments) {
      const chainId = await entityProviderChainId(this.signers.deployer);

      if (chainId !== 1) {
        console.warn("\n\nTest is disabled for non-mainnet network\n\n");
        this.skip();
      }

      // Get deployed contract addresses
      const contracts = await getConnectedProtocolContracts(
        getNetworkAddresses(),
        "ethereum-morpho",
      );

      if (!contracts.GnosisSafeWallet?.address)
        throw Error("GnosisSafeWallet address not found");

      // Deploy a new Safe proxy for testing using the deployer
      const safeProxy = await deploySafeProxy(this.signers.deployer, [
        contracts.GnosisSafeWallet.address,
      ]);

      // Store Safe addresses
      this.args = {
        chainId,
        safeAddress: safeProxy.address,
        safeOwners: SAFE_OWNERS,
        //
        yieldRewarder: "0x1000000000000000000000000000000000000000",
        buybackWallet: "0x2000000000000000000000000000000000000000",
        evidenceGuardian: "0x3000000000000000000000000000000000000000",
      };

      // Store Safe contract
      this.customEnv = {
        contracts,
        ProtocolManager: null as any, // Will be set after deployment
        safeWalletContract: safeProxy, // Use the newly deployed proxy
        safeSDK: null as any, // Will be set after initialization
      };

      if (!process.env.MAINNET_RPC_URL)
        throw Error("Missing MAINNET_RPC_URL env variable");

      // Initialize the Safe SDK with the deployer as signer
      this.customEnv.safeSDK = await Safe.init({
        provider: process.env.MAINNET_RPC_URL,
        signer: this.signers.deployer.privateKey,
        safeAddress: this.args.safeAddress,
      });
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
          this.customEnv.safeWalletContract.address, // Use the new Safe proxy
          this.args.yieldRewarder,
          this.args.buybackWallet,
          this.args.evidenceGuardian,
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
        (await this.customEnv.ProtocolManager.ecclesiaDao()).toLowerCase(),
      ).to.equal(this.customEnv.safeWalletContract.address.toLowerCase());
    });

    it("transfers ownership of contracts to ProtocolManager using Gnosis Safe", async function (this: Arguments) {
      // No need to impersonate accounts - using the deployer

      // Store current owners for later
      const contractsToTest = [
        this.customEnv.contracts.LiquidityManager,
        this.customEnv.contracts.StrategyManager,
        this.customEnv.contracts.ClaimManager,
      ];

      // Array to store the original owners
      const originalOwners = [];

      // Transfer ownership of contracts to the Safe first
      for (const contract of contractsToTest) {
        const currentOwner = await contract.owner();
        originalOwners.push(currentOwner);

        // Transfer ownership to our Safe if not already owned by it
        if (
          currentOwner.toLowerCase() !==
          this.customEnv.safeWalletContract.address.toLowerCase()
        ) {
          // Check if the deployer owns it
          if (
            currentOwner.toLowerCase() ===
            this.signers.deployer.address.toLowerCase()
          ) {
            await postTxHandler(
              contract.transferOwnership(
                this.customEnv.safeWalletContract.address,
              ),
            );
          } else {
            console.warn(
              `Contract ${contract.address} not owned by deployer, skipping ownership transfer`,
            );
            continue;
          }
        }
      }

      // Check if we have any contracts owned by the Safe to proceed with
      const safeOwnedContracts = [];
      for (const contract of contractsToTest) {
        const currentOwner = await contract.owner();
        if (
          currentOwner.toLowerCase() ===
          this.customEnv.safeWalletContract.address.toLowerCase()
        ) {
          safeOwnedContracts.push(contract);
        }
      }

      if (safeOwnedContracts.length === 0) {
        console.warn("\n\nNo contracts owned by Safe, skipping test\n\n");
        return;
      }

      // For the first contract owned by Safe, transfer to ProtocolManager
      const testContract = safeOwnedContracts[0];

      // Prepare the transaction for transferring ownership to the ProtocolManager
      const transferTransaction: MetaTransactionData = {
        to: testContract.address,
        value: "0",
        data: testContract.interface.encodeFunctionData("transferOwnership", [
          this.customEnv.ProtocolManager.address,
        ]),
      };

      // Create a transaction using the SDK
      const safeTransaction = await this.customEnv.safeSDK.createTransaction({
        transactions: [transferTransaction],
      });

      // Sign the transaction with the deployer
      const signedSafeTx =
        await this.customEnv.safeSDK.signTransaction(safeTransaction);

      // Execute the transaction
      const executeTxResponse =
        await this.customEnv.safeSDK.executeTransaction(signedSafeTx);
      // No need to wait for transaction completion as mentioned

      // Verify ownership was transferred
      expect(await testContract.owner()).to.equal(
        this.customEnv.ProtocolManager.address,
      );

      // After tests, transfer ownership back to Safe using ProtocolManager
      // Prepare transaction for ProtocolManager to transfer ownership back
      const transferBackTransaction: MetaTransactionData = {
        to: this.customEnv.ProtocolManager.address,
        value: "0",
        data: this.customEnv.ProtocolManager.interface.encodeFunctionData(
          "transferContractOwnership",
          [[testContract.address], this.customEnv.safeWalletContract.address],
        ),
      };

      // Create and execute the transaction
      const transferBackSafeTx = await this.customEnv.safeSDK.createTransaction(
        {
          transactions: [transferBackTransaction],
        },
      );

      const signedTransferBackTx =
        await this.customEnv.safeSDK.signTransaction(transferBackSafeTx);
      await this.customEnv.safeSDK.executeTransaction(signedTransferBackTx);

      // Verify ownership was transferred back
      expect(await testContract.owner()).to.equal(
        this.customEnv.safeWalletContract.address,
      );

      // Restore original owners if needed
      for (let i = 0; i < contractsToTest.length; i++) {
        const contract = contractsToTest[i];
        const currentOwner = await contract.owner();

        if (
          currentOwner.toLowerCase() ===
            this.customEnv.safeWalletContract.address.toLowerCase() &&
          originalOwners[i].toLowerCase() !==
            this.customEnv.safeWalletContract.address.toLowerCase()
        ) {
          // Transfer back to original owner through safe
          const restoreTransaction: MetaTransactionData = {
            to: contract.address,
            value: "0",
            data: contract.interface.encodeFunctionData("transferOwnership", [
              originalOwners[i],
            ]),
          };

          const restoreTx = await this.customEnv.safeSDK.createTransaction({
            transactions: [restoreTransaction],
          });

          const signedRestoreTx =
            await this.customEnv.safeSDK.signTransaction(restoreTx);
          await this.customEnv.safeSDK.executeTransaction(signedRestoreTx);
        }
      }
    });

    it("performs protocol updates through Gnosis Safe", async function (this: Arguments) {
      // No need to impersonate accounts - using the deployer

      // Ensure the LiquidityManager is owned by the Safe
      const lmOwner = await this.customEnv.contracts.LiquidityManager.owner();
      if (
        lmOwner.toLowerCase() !==
        this.customEnv.safeWalletContract.address.toLowerCase()
      ) {
        // Transfer ownership if needed
        if (
          lmOwner.toLowerCase() === this.signers.deployer.address.toLowerCase()
        ) {
          await postTxHandler(
            this.customEnv.contracts.LiquidityManager.transferOwnership(
              this.customEnv.safeWalletContract.address,
            ),
          );
        } else {
          console.warn(
            "\n\nLiquidityManager not owned by deployer, skipping test\n\n",
          );
          return;
        }
      }

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

      // Transfer ownership to ProtocolManager first
      const transferToManagerTransaction: MetaTransactionData = {
        to: this.customEnv.contracts.LiquidityManager.address,
        value: "0",
        data: this.customEnv.contracts.LiquidityManager.interface.encodeFunctionData(
          "transferOwnership",
          [this.customEnv.ProtocolManager.address],
        ),
      };

      let safeTx = await this.customEnv.safeSDK.createTransaction({
        transactions: [transferToManagerTransaction],
      });

      let signedTx = await this.customEnv.safeSDK.signTransaction(safeTx);
      await this.customEnv.safeSDK.executeTransaction(signedTx);

      // Prepare transaction data for updating config
      const updateConfigTransaction: MetaTransactionData = {
        to: this.customEnv.ProtocolManager.address,
        value: "0",
        data: this.customEnv.ProtocolManager.interface.encodeFunctionData(
          "updateLiquidityManagerConfig",
          [newWithdrawDelay, newMaxLeverage, newLeverageFeePerPool],
        ),
      };

      // Create and execute the transaction
      safeTx = await this.customEnv.safeSDK.createTransaction({
        transactions: [updateConfigTransaction],
      });

      signedTx = await this.customEnv.safeSDK.signTransaction(safeTx);
      await this.customEnv.safeSDK.executeTransaction(signedTx);

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

      // Scenario 2: Gnosis Safe calls ProtocolManager to batch pause a pool
      // Get the current pool count to make sure we don't try to pause non-existent pools
      const poolCount =
        await this.customEnv.contracts.LiquidityManager.nextPoolId();
      if (poolCount.toNumber() > 0) {
        const poolIds = [0]; // Pause the first pool

        // Get initial paused state
        const initialPausedState = (
          await this.customEnv.contracts.LiquidityManager.poolInfo(0)
        ).isPaused;

        // Prepare transaction data for pausing pool
        const pausePoolTransaction: MetaTransactionData = {
          to: this.customEnv.ProtocolManager.address,
          value: "0",
          data: this.customEnv.ProtocolManager.interface.encodeFunctionData(
            "batchPausePool",
            [
              poolIds,
              !initialPausedState, // Toggle the state
            ],
          ),
        };

        // Create and execute the transaction
        const pausePoolTx = await this.customEnv.safeSDK.createTransaction({
          transactions: [pausePoolTransaction],
        });

        const signedPauseTx =
          await this.customEnv.safeSDK.signTransaction(pausePoolTx);
        await this.customEnv.safeSDK.executeTransaction(signedPauseTx);

        // Verify pool state was toggled
        const pausedState = (
          await this.customEnv.contracts.LiquidityManager.poolInfo(0)
        ).isPaused;
        expect(pausedState).to.equal(!initialPausedState);

        // Return pool to original state
        const unpausePoolTransaction: MetaTransactionData = {
          to: this.customEnv.ProtocolManager.address,
          value: "0",
          data: this.customEnv.ProtocolManager.interface.encodeFunctionData(
            "batchPausePool",
            [poolIds, initialPausedState],
          ),
        };

        const unpausePoolTx = await this.customEnv.safeSDK.createTransaction({
          transactions: [unpausePoolTransaction],
        });

        const signedUnpauseTx =
          await this.customEnv.safeSDK.signTransaction(unpausePoolTx);
        await this.customEnv.safeSDK.executeTransaction(signedUnpauseTx);
      }

      // Restore original config values
      const restoreConfigTransaction: MetaTransactionData = {
        to: this.customEnv.ProtocolManager.address,
        value: "0",
        data: this.customEnv.ProtocolManager.interface.encodeFunctionData(
          "updateLiquidityManagerConfig",
          [
            originalWithdrawDelay,
            originalMaxLeverage,
            originalLeverageFeePerPool,
          ],
        ),
      };

      const restoreConfigTx = await this.customEnv.safeSDK.createTransaction({
        transactions: [restoreConfigTransaction],
      });

      const signedRestoreTx =
        await this.customEnv.safeSDK.signTransaction(restoreConfigTx);
      await this.customEnv.safeSDK.executeTransaction(signedRestoreTx);

      // Transfer back ownership to Safe
      const transferBackToSafeTransaction: MetaTransactionData = {
        to: this.customEnv.ProtocolManager.address,
        value: "0",
        data: this.customEnv.ProtocolManager.interface.encodeFunctionData(
          "transferContractOwnership",
          [
            [this.customEnv.contracts.LiquidityManager.address],
            this.customEnv.safeWalletContract.address,
          ],
        ),
      };

      const transferBackTx = await this.customEnv.safeSDK.createTransaction({
        transactions: [transferBackToSafeTransaction],
      });

      const signedTransferBackTx =
        await this.customEnv.safeSDK.signTransaction(transferBackTx);
      await this.customEnv.safeSDK.executeTransaction(signedTransferBackTx);
    });

    it("simulates a complete migration flow from direct ownership to Safe through ProtocolManager", async function (this: Arguments) {
      // Deploy a test Protocol Manager
      const testProtocolManager = await deployProtocolManager(
        this.signers.deployer,
        [
          this.customEnv.contracts.AthenaPositionToken.address,
          this.customEnv.contracts.AthenaCoverToken.address,
          this.customEnv.contracts.LiquidityManager.address,
          this.customEnv.contracts.StrategyManager.address,
          this.customEnv.contracts.ClaimManager.address,
          this.customEnv.safeWalletContract.address,
          this.args.yieldRewarder,
          this.args.buybackWallet,
          this.args.evidenceGuardian,
        ],
      );

      // Get current owners
      const contractsToMigrate = [
        this.customEnv.contracts.LiquidityManager,
        this.customEnv.contracts.StrategyManager,
        this.customEnv.contracts.ClaimManager,
      ];

      // Array to store the original owners
      const originalOwners = [];
      const migrateableContracts = [];

      // Check which contracts can be migrated (owned by deployer)
      for (const contract of contractsToMigrate) {
        const currentOwner = await contract.owner();
        originalOwners.push(currentOwner);

        if (
          currentOwner.toLowerCase() ===
          this.signers.deployer.address.toLowerCase()
        ) {
          migrateableContracts.push(contract);
        }
      }

      if (migrateableContracts.length === 0) {
        console.warn(
          "\n\nSkipping migration flow test as none of the contracts are owned by the deployer\n\n",
        );
        return;
      }

      // Step 1: First transfer ownership from deployer to Protocol Manager
      for (const contract of migrateableContracts) {
        await postTxHandler(
          contract.transferOwnership(testProtocolManager.address),
        );
        expect(await contract.owner()).to.equal(testProtocolManager.address);
      }

      // Step 2: Use Protocol Manager to transfer ownership to the Safe
      const contractAddresses = migrateableContracts.map((c) => c.address);

      await postTxHandler(
        testProtocolManager.transferContractOwnership(
          contractAddresses,
          this.customEnv.safeWalletContract.address,
        ),
      );

      // Step 3: Verify Safe ownership
      for (const contract of migrateableContracts) {
        expect(await contract.owner()).to.equal(
          this.customEnv.safeWalletContract.address,
        );
      }

      // Step 4: Use Safe to transfer ownership back to deployer
      for (const contract of migrateableContracts) {
        const transferBackTransaction: MetaTransactionData = {
          to: contract.address,
          value: "0",
          data: contract.interface.encodeFunctionData("transferOwnership", [
            this.signers.deployer.address,
          ]),
        };

        const transferBackTx = await this.customEnv.safeSDK.createTransaction({
          transactions: [transferBackTransaction],
        });

        const signedTransferBackTx =
          await this.customEnv.safeSDK.signTransaction(transferBackTx);
        await this.customEnv.safeSDK.executeTransaction(signedTransferBackTx);
      }

      // Verify ownership is back to deployer
      for (const contract of migrateableContracts) {
        expect(await contract.owner()).to.equal(this.signers.deployer.address);
      }
    });
  });
}
