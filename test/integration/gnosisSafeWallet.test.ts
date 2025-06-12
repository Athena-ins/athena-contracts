import { expect } from "chai";
import { ethers } from "ethers";
// Helpers
import { getNetworkAddresses } from "../../scripts/verificationData/addresses";
import {
  getAthenaMultisig,
  getConnectedProtocolContracts,
  EthereumConnectedProtocolContracts,
} from "../helpers/contracts-getters";
import { deployProtocolManager, deploySafeProxy } from "../helpers/deployers";
import {
  entityProviderChainId,
  postTxHandler,
  impersonateAccount,
} from "../helpers/hardhat";
// Types
import { MetaTransactionData } from "@safe-global/types-kit";
import { IGnosisSafeWallet, ProtocolManager } from "../../typechain";

interface Arguments extends Mocha.Context {
  customEnv: {
    contracts: EthereumConnectedProtocolContracts;
    ProtocolManager: ProtocolManager;
    AthenaMultisig: IGnosisSafeWallet;
    formatAndExecTx: (
      transactions: MetaTransactionData,
    ) => Promise<ethers.ContractTransaction>;
  };
  args: {
    chainId: number;
    safeOwners: string[];
    //
    yieldRewarder: string;
    buybackWallet: string;
    evidenceGuardian: string;
  };
}

async function formatAndExecTx(
  signer: ethers.Wallet,
  contract: IGnosisSafeWallet,
  transaction: MetaTransactionData,
): Promise<ethers.ContractTransaction> {
  const { to, value, data } = transaction;
  const nonce = await contract.nonce();

  // Get the chainId
  const chainId = await contract.getChainId();

  // Create EIP-712 domain and message
  const domain = {
    chainId: chainId.toNumber(),
    verifyingContract: contract.address,
  };

  const types = {
    SafeTx: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "nonce", type: "uint256" },
    ],
  };

  const message = {
    to,
    value,
    data,
    operation: 0,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: ethers.constants.AddressZero,
    refundReceiver: ethers.constants.AddressZero,
    nonce: nonce.toNumber(),
  };

  // Sign with EIP-712
  const signature = await signer._signTypedData(domain, types, message);

  // Execute transaction with explicit gas limit
  return contract.execTransaction(
    to,
    ethers.BigNumber.from(value),
    data,
    0, // operation (call)
    0, // safeTxGas
    0, // baseGas
    0, // gasPrice
    ethers.constants.AddressZero, // gasToken
    ethers.constants.AddressZero, // refundReceiver
    signature,
    { gasLimit: 1000000 },
  );
}

export function GnosisSafeWalletTest() {
  context("Gnosis Safe Integration Tests", function () {
    before(async function (this: Arguments) {
      const chainId = await entityProviderChainId(this.signers.deployer);

      if (chainId !== 1) {
        throw Error("\n\nTest is disabled for non-mainnet network\n\n");
        this.skip();
      }

      // Get deployed contract addresses
      const contracts = await getConnectedProtocolContracts(
        getNetworkAddresses(),
        "ethereum",
      );

      this.args = {
        chainId,
        safeOwners: [this.signers.deployer.address],
        //
        yieldRewarder: "0x1000000000000000000000000000000000000000",
        buybackWallet: "0x2000000000000000000000000000000000000000",
        evidenceGuardian: "0x3000000000000000000000000000000000000000",
      };

      if (!process.env.MAINNET_RPC_URL)
        throw Error("MAINNET_RPC_URL is not set in .env file");

      // Store Safe contract
      this.customEnv = {
        contracts,
        ProtocolManager: null as any, // Set after deployment
        AthenaMultisig: null as any, // Set after deployment
        formatAndExecTx: null as any,
      };
    });

    it("deploys a Gnosis Safe proxy", async function (this: Arguments) {
      const safeWalletImplentation =
        this.customEnv.contracts.GnosisSafeWallet?.address;

      expect(safeWalletImplentation).to.not.be.undefined;
      expect(safeWalletImplentation).to.not.equal(ethers.constants.AddressZero);

      // Deploy a new Safe proxy for testing using the deployer
      const safeProxy = await deploySafeProxy(this.signers.deployer, [
        safeWalletImplentation as string,
      ]);
      const AthenaMultisig = await getAthenaMultisig(safeProxy.address);

      await postTxHandler(
        AthenaMultisig.setup(
          this.args.safeOwners, // owners
          1, // threshold
          ethers.constants.AddressZero, // to
          "0x", // data
          ethers.constants.AddressZero, // fallbackHandler
          ethers.constants.AddressZero, // paymentToken
          0, // payment
          ethers.constants.AddressZero, // paymentReceiver
        ),
      );

      expect(
        await AthenaMultisig.isOwner(this.signers.deployer.address),
      ).to.equal(true);

      this.customEnv.AthenaMultisig = AthenaMultisig;
      this.customEnv.formatAndExecTx = async (transactions) =>
        formatAndExecTx(
          this.signers.deployer,
          this.customEnv.AthenaMultisig,
          transactions,
        );
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
          this.customEnv.AthenaMultisig.address, // Use the new Safe proxy
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
      ).to.equal(this.customEnv.AthenaMultisig.address.toLowerCase());
    });

    it("transfers ownership of contracts to Gnosis Safe", async function (this: Arguments) {
      // Get current owners
      const contractsToMigrate = [
        this.customEnv.contracts.LiquidityManager,
        this.customEnv.contracts.StrategyManager,
        this.customEnv.contracts.ClaimManager,
        this.customEnv.ProtocolManager,
      ];

      for (const contract of contractsToMigrate) {
        const owner = await contract.owner();
        const ownerSigner = await impersonateAccount(owner);

        await postTxHandler(
          contract
            .connect(ownerSigner)
            .transferOwnership(this.customEnv.AthenaMultisig.address),
        );
        expect(await contract.owner()).to.equal(
          this.customEnv.AthenaMultisig.address,
        );
      }
    });

    it("transfers ownership of contracts to ProtocolManager using Gnosis Safe", async function (this: Arguments) {
      // Store current owners for later
      const contractsToTest = [
        this.customEnv.contracts.LiquidityManager,
        this.customEnv.contracts.StrategyManager,
        this.customEnv.contracts.ClaimManager,
      ];

      for (const contract of contractsToTest) {
        // Prepare the transaction for transferring ownership to the ProtocolManager
        const transferTransaction: MetaTransactionData = {
          to: contract.address,
          value: "0",
          data: contract.interface.encodeFunctionData("transferOwnership", [
            this.customEnv.ProtocolManager.address,
          ]),
        };

        // Execute the transaction
        expect(await this.customEnv.formatAndExecTx(transferTransaction)).to.not
          .throw;
        // Verify ownership was transferred
        expect(await contract.owner()).to.equal(
          this.customEnv.ProtocolManager.address,
        );
      }
    });

    it("updates config via ProtocolManager", async function (this: Arguments) {
      const liquidityManager = this.customEnv.contracts.LiquidityManager;

      // Confirm the contract is owned by ProtocolManager before proceeding
      expect(await liquidityManager.owner()).to.equal(
        this.customEnv.ProtocolManager.address,
      );

      // Get original config values
      const [
        originalWithdrawDelay,
        originalMaxLeverage,
        originalLeverageFeePerPool,
      ] = await Promise.all([
        liquidityManager.withdrawDelay(),
        liquidityManager.maxLeverage(),
        liquidityManager.leverageFeePerPool(),
      ]);

      // Set new values (increment by 1)
      const newWithdrawDelay = originalWithdrawDelay.add(1);
      const newMaxLeverage = originalMaxLeverage.add(1);
      const newLeverageFeePerPool = originalLeverageFeePerPool.add(1);

      // Create transaction to update config
      const updateConfigTransaction: MetaTransactionData = {
        to: this.customEnv.ProtocolManager.address,
        value: "0",
        data: this.customEnv.ProtocolManager.interface.encodeFunctionData(
          "updateLiquidityManagerConfig",
          [newWithdrawDelay, newMaxLeverage, newLeverageFeePerPool],
        ),
      };

      // Execute the transaction
      await this.customEnv.formatAndExecTx(updateConfigTransaction);

      // Verify config was updated
      const [
        updatedWithdrawDelay,
        updatedMaxLeverage,
        updatedLeverageFeePerPool,
      ] = await Promise.all([
        liquidityManager.withdrawDelay(),
        liquidityManager.maxLeverage(),
        liquidityManager.leverageFeePerPool(),
      ]);

      expect(updatedWithdrawDelay).to.equal(newWithdrawDelay);
      expect(updatedMaxLeverage).to.equal(newMaxLeverage);
      expect(updatedLeverageFeePerPool).to.equal(newLeverageFeePerPool);
    });

    it("manages pool pause state via ProtocolManager", async function (this: Arguments) {
      const liquidityManager = this.customEnv.contracts.LiquidityManager;

      const poolId = 0;

      // Get current pause state
      const currentPoolInfo = await liquidityManager.poolInfo(poolId);
      const currentPauseState = currentPoolInfo.isPaused;

      // Create transaction to toggle pause state
      const togglePauseTransaction: MetaTransactionData = {
        to: this.customEnv.ProtocolManager.address,
        value: "0",
        data: this.customEnv.ProtocolManager.interface.encodeFunctionData(
          "batchPausePool",
          [[poolId], !currentPauseState],
        ),
      };

      // Execute the transaction
      const tx = await this.customEnv.formatAndExecTx(togglePauseTransaction);

      // Verify pause state was toggled
      const updatedPoolInfo = await liquidityManager.poolInfo(poolId);
      expect(updatedPoolInfo.isPaused).to.equal(!currentPauseState);
    });

    it("transfers ownership back from ProtocolManager to Safe", async function (this: Arguments) {
      const liquidityManager = this.customEnv.contracts.LiquidityManager;

      // Confirm current ownership
      expect(await liquidityManager.owner()).to.equal(
        this.customEnv.ProtocolManager.address,
      );

      // Create transaction to transfer ownership back to Safe
      const transferBackTransaction: MetaTransactionData = {
        to: this.customEnv.ProtocolManager.address,
        value: "0",
        data: this.customEnv.ProtocolManager.interface.encodeFunctionData(
          "transferContractOwnership",
          [[liquidityManager.address], this.customEnv.AthenaMultisig.address],
        ),
      };

      // Execute the transaction
      const tx = await this.customEnv.formatAndExecTx(transferBackTransaction);

      // Verify ownership was transferred back
      expect(await liquidityManager.owner()).to.equal(
        this.customEnv.AthenaMultisig.address,
      );
    });
  });
}
