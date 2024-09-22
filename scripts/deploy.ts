import { Wallet, BigNumber } from "ethers";
import hre, { ethers } from "hardhat";
import {
  deployAllContractsAndInitializeProtocol,
  ProtocolConfig,
} from "../test/helpers/deployers";
import { deployAllContractsAndInitializeProtocolV0 } from "../test/helpers/deployersV0";
import { deployAllContractsAndInitializeProtocolVE } from "../test/helpers/deployersVE";
import { countdown } from "../test/helpers/miscUtils";
import { getDeployConfig } from "./verificationData/deployParams";
import { getNetworkAddresses } from "./verificationData/addresses";

const ALLOW_PARTIAL_DEPLOY = false;

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
    const forkTarget =
      networkName === "HARDHAT"
        ? ` (${process.env.HARDHAT_FORK_TARGET?.toLowerCase()})`
        : "";
    console.log(`\n== DEPLOY ON ${networkName}${forkTarget} ==\n`);

    const deployer = (await ethers.getSigners())[0] as unknown as Wallet;
    console.log("deployer: ", deployer.address);

    const balance = await deployer.getBalance();
    console.log("balance: ", `${formatEther(balance)} ETH`);

    const config = getDeployConfig();
    console.log("\n\nconfig: ", formatConfigForLog(config));

    // Used to setup in case of partial deploys
    const addresses = ALLOW_PARTIAL_DEPLOY ? getNetworkAddresses() : {};

    //===============//
    //== CONTRACTS ==//
    //===============//

    await deployAllContractsAndInitializeProtocolV0(
      deployer,
      config,
      addresses,
      true,
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

    console.log("\n==> Protocol deployed & setup");
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
