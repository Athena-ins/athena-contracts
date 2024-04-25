import { BigNumberish } from "ethers";
import hre, { ethers } from "hardhat";
import { getLiquidityManager } from "../test/helpers/contracts-getters";
import { postTxHandler } from "../test/helpers/hardhat";
import { getNetworkAddresses } from "./verificationData/addresses";

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

const poolParams: PoolParams[] = [
  {
    paymentAsset: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    strategyId: 0,
    feeRate: 0,
    uOptimal: 0,
    r0: 0,
    rSlope1: 0,
    rSlope2: 0,
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

    const liquidityManagerAddress = getNetworkAddresses().LiquidityManager;
    const LiquidityManager = (
      await getLiquidityManager(liquidityManagerAddress)
    ).connect(deployer);

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

      console.log(`==> Deployed pool ${i}/${poolParams.length}`);
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
