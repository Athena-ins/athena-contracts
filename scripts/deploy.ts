import { Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import { deployAllContractsAndInitializeProtocol } from "../test/helpers/deployers";
import { countdown } from "../test/helpers/miscUtils";
import { getDeployParams } from "./verificationData/deployParams";

async function main() {
  try {
    console.log(`\n== DEPLOY ON ${hre.network.name.toUpperCase()} ==\n`);

    const deployer = (await ethers.getSigners())[0] as unknown as Wallet;
    console.log("deployer: ", deployer.address);

    const params = getDeployParams();
    console.log("\n\nparams: ", params);

    await countdown(60);

    //===============//
    //== CONTRACTS ==//
    //===============//

    await deployAllContractsAndInitializeProtocol(deployer, params, true);
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
