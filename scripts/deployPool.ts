import hre, { ethers } from "hardhat";
import { postTxHandler } from "../test/helpers/hardhat";
import { getNetworkAddresses } from "./verificationData/addresses";
import { getDeployConfig } from "./verificationData/deployParams";
import { getDeployPoolConfig } from "./verificationData/deployPoolParams";
//
import { BigNumberish } from "ethers";
import { LiquidityManager__factory } from "../typechain";

const addresses = getNetworkAddresses();
const poolParams = getDeployPoolConfig();

async function main() {
  try {
    const networkName = hre.network.name.toUpperCase();
    const forkTarget =
      networkName === "HARDHAT"
        ? ` (${process.env.HARDHAT_FORK_TARGET?.toLowerCase()})`
        : "";
    console.log(`\n== CREATE POOL ON ${networkName}${forkTarget} ==\n`);

    const deployer = (await ethers.getSigners())[0];
    console.log("deployer: ", deployer.address);

    const LiquidityManager = LiquidityManager__factory.connect(
      addresses.LiquidityManager,
      deployer,
    );

    //================//
    //== OPEN POOLS ==//
    //================//

    const nbPools = poolParams.length;

    for (const [i, params] of poolParams.entries()) {
      await postTxHandler(
        LiquidityManager.createPool(
          params.paymentAsset,
          params.strategyId,
          params.feeRate,
          params.uOptimal,
          params.r0,
          params.rSlope1,
          params.rSlope2,
          params.compatiblePools,
        ),
      );

      console.log(`==> Deployed pool ${params.name} - ${i + 1}/${nbPools}`);
    }
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
