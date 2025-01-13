import { BigNumber, Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import { getConnectedProtocolContracts } from "../test/helpers/contracts-getters";
import { deployBasicProxy, ProtocolConfig } from "../test/helpers/deployers";
import { fromFork, entityProviderChainId } from "../test/helpers/hardhat";
import { getNetworkAddresses } from "./verificationData/addresses";
import { getDeployConfig } from "./verificationData/deployParams";
import { StrategyManagerMorpho__factory, ERC20__factory } from "../typechain";

const { formatEther } = ethers.utils;

// npx hardhat run scripts/singleContract.ts --network hardhat

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

    //===============//
    //== CONTRACTS ==//
    //===============//
    const contracts = await getConnectedProtocolContracts(
      addresses,
      "ethereum-morpho",
    );

    const strategyManager = StrategyManagerMorpho__factory.connect(
      addresses.ProxyStrategyManager,
      deployer,
    );

    // Initialize state using existing setters
    await strategyManager
      .updateAddressList(
        contracts.LiquidityManager.address,
        deployer.address, // EcclesiaDao
        deployer.address, // buybackWallet
      )
      .then((tx) => tx.wait());
    await strategyManager
      .updateStrategyFeeRate(config.strategyFeeRate)
      .then((tx) => tx.wait());
    await strategyManager
      .updatePayoutDeductibleRate(config.payoutDeductibleRate)
      .then((tx) => tx.wait());

    // Retransfer previously held funds to new strategy manager
    console.log(
      "contracts.StrategyManager.address: ",
      contracts.StrategyManager.address,
    );
    const strategyManagerOld = StrategyManagerMorpho__factory.connect(
      contracts.StrategyManager.address,
      deployer,
    );

    await strategyManagerOld
      .rescueTokens(
        "0x06824C27C8a0DbDe5F72f770eC82e3c0FD4DcEc3",
        addresses.ProxyStrategyManager,
        "60000000000000000",
      )
      .then((tx) => tx.wait());

    await contracts.LiquidityManager.updateConfig(
      deployer.address, // ecclesiaDao
      addresses.ProxyStrategyManager, // strategyManager
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
