import { BigNumber, Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import {
  getConnectedProtocolContracts,
  getStrategyManagerEthereum,
} from "../../test/helpers/contracts-getters";
import {
  deployBasicProxy,
  deployWrappedTokenGateway,
  deployStrategyManagerEthereum,
  deployPoolManager,
} from "../../test/helpers/deployers";
import {
  fromFork,
  entityProviderChainId,
  postTxHandler,
  getProxyAdmin,
  getProxyImplementation,
} from "../../test/helpers/hardhat";
import {
  aaveLendingPoolV3Address,
  makeTestHelpers,
  TestHelper,
  usdcTokenAddress,
} from "../../test/helpers/protocol";
import { getNetworkAddresses } from "../verificationData/addresses";
import { getDeployConfig } from "../verificationData/deployParams";
import { verifyEtherscanContract } from "../helpers/verify";
import {
  StrategyManagerEthereum__factory,
  ProxyAdmin__factory,
} from "../../typechain";

const { formatEther } = ethers.utils;

// npx hardhat run scripts/actions/deployStrategyManagerAndUpdate.ts --network hardhat

async function main() {
  try {
    const networkName = hre.network.name.toUpperCase();
    const forkTarget = networkName === "HARDHAT" ? ` (${fromFork()})` : "";
    console.log(`\n== DEPLOY ON ${networkName}${forkTarget} ==\n`);

    const deployer = (await ethers.getSigners())[0] as unknown as Wallet;
    console.log("deployer: ", deployer.address);

    const balance = await deployer.getBalance();
    console.log("balance: ", `${formatEther(balance)} ETH`);

    if (balance.eq(0)) throw new Error("Zero balance in deployer wallet");

    const chainId = await entityProviderChainId(deployer);
    const addresses = getNetworkAddresses();
    const config = getDeployConfig();

    if (!addresses.ProxyStrategyManager)
      throw Error("ProxyStrategyManager address is missing");

    const contracts = await getConnectedProtocolContracts(
      addresses,
      "ethereum-morpho",
    );

    //=============//
    //== ACTIONS ==//
    //=============//

    const strategyManagerProxy = contracts.ProxyStrategyManager;

    if (!strategyManagerProxy)
      throw Error("ProxyStrategyManager address is missing");

    const proxyAdminAddress = await getProxyAdmin(strategyManagerProxy);

    if (
      !config.wstETH ||
      !config.amphrETH ||
      !config.amphrLRT ||
      !config.morphoMevVault ||
      !config.inceptionVault
    )
      throw Error("Missing config");

    // Deploy new implementation
    const newImplementation = await deployStrategyManagerEthereum(deployer, [
      contracts.LiquidityManager.address,
      deployer.address, // EcclesiaDao
      aaveLendingPoolV3Address(chainId),
      usdcTokenAddress(chainId),
      config.buybackWallet.address,
      config.payoutDeductibleRate,
      config.strategyFeeRate,
      config.wstETH,
      config.amphrETH,
      config.amphrLRT,
      config.morphoMevVault,
      config.inceptionVault,
    ]);
    console.log("newImplementation: ", newImplementation.address);

    if (!forkTarget) {
      await newImplementation.deployTransaction.wait(2);

      await verifyEtherscanContract<StrategyManagerEthereum__factory>(
        newImplementation.address,
        [
          contracts.LiquidityManager.address,
          deployer.address, // EcclesiaDao
          aaveLendingPoolV3Address(chainId),
          usdcTokenAddress(chainId),
          config.buybackWallet.address,
          config.payoutDeductibleRate,
          config.strategyFeeRate,
          config.wstETH,
          config.amphrETH,
          config.amphrLRT,
          config.morphoMevVault,
          config.inceptionVault,
        ],
      );
      console.log("==> Verification processed for StrategyManagerEthereum");
    }

    const proxyAdmin = ProxyAdmin__factory.connect(proxyAdminAddress, deployer);

    await postTxHandler(
      proxyAdmin.upgradeAndCall(
        strategyManagerProxy.address,
        newImplementation.address,
        "0x",
      ),
    );

    // Verify implementation was changed
    const currentImplementation =
      await getProxyImplementation(strategyManagerProxy);
    console.log("currentImplementation: ", currentImplementation);

    // ============================== //
    // ============================== //

    console.log("\n==> Contracts OK");

    const [balanceAfter, gasPrice] = await Promise.all([
      deployer.getBalance(),
      hre.ethers.provider.getGasPrice(),
    ]);

    console.log(
      "\ncost: ",
      `${formatEther(balance.sub(balanceAfter))} ETH / ${ethers.utils.formatUnits(
        gasPrice,
        9,
      )} GWEI`,
    );

    console.log("\n==> Contract deployed & setup");
  } catch (err: any) {
    console.log(err);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
