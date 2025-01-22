import { Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import { getConnectedProtocolContracts } from "../../test/helpers/contracts-getters";
import { deployPoolManager } from "../../test/helpers/deployers";
import { entityProviderChainId, fromFork } from "../../test/helpers/hardhat";
import { getNetworkAddresses } from "../verificationData/addresses";
import { getDeployConfig } from "../verificationData/deployParams";
import { PoolManager__factory } from "../../typechain";
import { verifyEtherscanContract } from "../helpers/verify";

const { formatEther } = ethers.utils;

// npx hardhat run scripts/actions/deployPoolManager.ts --network hardhat

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

    const poolManager = await deployPoolManager(deployer, [
      contracts.LiquidityManager.address,
    ]);
    console.log("poolManager: ", poolManager.address);

    if (!forkTarget) {
      await poolManager.deployTransaction.wait(2);

      await verifyEtherscanContract<PoolManager__factory>(poolManager.address, [
        contracts.LiquidityManager.address,
      ]);
      console.log("==> Verification processed for PoolManager");
    }

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
