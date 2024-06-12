import { Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import { deployAllContractsAndInitializeProtocol } from "../test/helpers/deployers";
import { countdown } from "../test/helpers/miscUtils";
import { getDeployConfig } from "./verificationData/deployParams";

const { formatEther } = ethers.utils;

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
    console.log("\n\nconfig: ", config);

    await countdown(30);

    //===============//
    //== CONTRACTS ==//
    //===============//

    await deployAllContractsAndInitializeProtocol(deployer, config, true);
    console.log("\n==> Contracts OK");

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
