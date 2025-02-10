import hre, { ethers } from "hardhat";
import { postTxHandler, fromFork } from "../test/helpers/hardhat";
import { getNetworkAddresses } from "./verificationData/addresses";
import { getDeployConfig } from "./verificationData/deployParams";
import { checkPoolCompatibility } from "./helpers/checkPoolCompatibility";
import { getDeployPoolConfig } from "./verificationData/deployPoolParams";
//
import { BigNumberish } from "ethers";
import { LiquidityManager__factory } from "../typechain";

const { formatEther } = ethers.utils;

const addresses = getNetworkAddresses();
const poolParams = getDeployPoolConfig();

async function main() {
  try {
    const networkName = hre.network.name.toUpperCase();
    const forkTarget = networkName === "HARDHAT" ? ` (${fromFork()})` : "";
    console.log(`\n== CREATE POOL ON ${networkName}${forkTarget} ==\n`);

    const deployer = (await ethers.getSigners())[0];
    console.log("deployer: ", deployer.address);

    const balance = await deployer.getBalance();
    console.log("balance: ", `${formatEther(balance)} ETH`);

    const LiquidityManager = LiquidityManager__factory.connect(
      addresses.LiquidityManager,
      deployer,
    );
    const nextPoolId = await LiquidityManager.nextPoolId();
    console.log("Next Pool Id: ", nextPoolId.toNumber());

    //================//
    //== OPEN POOLS ==//
    //================//

    const nbPools = poolParams.length;

    for (const [i, params] of poolParams.entries()) {
      // Skip already deployed pools
      if (i < nextPoolId.toNumber()) {
        console.log(
          `==> ⏭️  Skiped ${i}/${poolParams.length - 1}\n${params.name}`,
        );
        continue;
      }

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

      console.log(
        `==> ✅ Deploy ${i}/${poolParams.length - 1}\n${params.name}`,
      );
    }

    console.log("\n==> Checking pool compatibilities");
    const updates = await checkPoolCompatibility(LiquidityManager);

    if (updates.poolIds.length === 0) {
      console.log("==> ⏭️  All pool compatibilities are up to date");
    } else {
      console.log("==> ⚠️  Updates required for pools:", updates.poolIds);
    }

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
