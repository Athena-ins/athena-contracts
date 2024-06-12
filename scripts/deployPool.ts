import hre, { ethers } from "hardhat";
import { getLiquidityManager } from "../test/helpers/contracts-getters";
import { postTxHandler } from "../test/helpers/hardhat";
import { getNetworkAddresses } from "./verificationData/addresses";
import { getDeployConfig } from "./verificationData/deployParams";
//
import { BigNumberish } from "ethers";
import { LiquidityManager__factory } from "../typechain";

type PoolParams = {
  paymentAsset: string;
  strategyId: BigNumberish;
  feeRate: BigNumberish;
  uOptimal: BigNumberish;
  r0: BigNumberish;
  rSlope1: BigNumberish;
  rSlope2: BigNumberish;
  compatiblePools: BigNumberish[];
};

const addresses = getNetworkAddresses();
const config = getDeployConfig();

const poolParams: PoolParams[] = [
  {
    paymentAsset: addresses.CircleToken,
    strategyId: 0,
    feeRate: config.poolFormula.feeRate,
    uOptimal: config.poolFormula.uOptimal,
    r0: config.poolFormula.r0,
    rSlope1: config.poolFormula.rSlope1,
    rSlope2: config.poolFormula.rSlope2,
    compatiblePools: [],
  },
];

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

    for (const [i, params] of poolParams.entries()) {
      postTxHandler(
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

      console.log(`==> Deployed pool ${i + 1}/${poolParams.length}`);
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
