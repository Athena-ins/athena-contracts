import { BigNumber, Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import { getConnectedProtocolContracts } from "../test/helpers/contracts-getters";
import {
  deployStrategyManagerMorpho,
  ProtocolConfig,
} from "../test/helpers/deployers";
import { fromFork, entityProviderChainId } from "../test/helpers/hardhat";
import {
  aaveLendingPoolV3Address,
  usdcTokenAddress,
} from "../test/helpers/protocol";
import { getNetworkAddresses } from "./verificationData/addresses";
import { getDeployConfig } from "./verificationData/deployParams";

const { formatEther } = ethers.utils;

function formatConfigForLog(config: ProtocolConfig) {
  return Object.entries(config).reduce((acc, [key, value]) => {
    if ((config as any)[key]._isSigner) {
      acc[key] = (value as Wallet).address;
    } else if ((config as any)[key]._isBigNumber) {
      acc[key] = (value as BigNumber).toString();
    } else {
      acc[key] = value;
    }

    return acc;
  }, {} as any);
}

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
    // console.log("\n\nconfig: ", formatConfigForLog(config));

    //===============//
    //== CONTRACTS ==//
    //===============//
    const contracts = await getConnectedProtocolContracts(
      addresses,
      "ethereum-amphor",
    );

    const StrategyManagerMorpho = await deployStrategyManagerMorpho(deployer, [
      contracts.LiquidityManager.address,
      deployer.address, // EcclesiaDao
      aaveLendingPoolV3Address(chainId),
      usdcTokenAddress(chainId),
      config.buybackWallet.address,
      config.payoutDeductibleRate,
      config.strategyFeeRate,
      config.wstETH as string,
      config.amphrETH as string,
      config.amphrLRT as string,
      config.morphoMevVault as string,
    ]);

    console.log(
      "StrategyManagerMorpho.address: ",
      StrategyManagerMorpho.address,
    );
    await contracts.LiquidityManager.updateConfig(
      deployer.address, // ecclesiaDao
      StrategyManagerMorpho.address, // strategyManager
      contracts.ClaimManager.address, // claimManager
      deployer.address, // yieldRewarder
      config.withdrawDelay, // withdrawDelay
      config.maxLeverage, // maxLeverage
      config.leverageFeePerPool, // leverageFeePerPool
    );

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
