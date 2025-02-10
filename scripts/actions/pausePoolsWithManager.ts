import hre, { ethers } from "hardhat";
import { constants, BigNumberish } from "ethers";
import { postTxHandler, fromFork } from "../../test/helpers/hardhat";
import { getNetworkAddresses } from "../verificationData/addresses";
import { getDeployConfig } from "../verificationData/deployParams";
import { getDeployPoolConfig } from "../verificationData/deployPoolParams";
import { getPoolManager } from "../../test/helpers/contracts-getters";
import { makeIdArray } from "../../test/helpers/miscUtils";
//
import { LiquidityManager__factory } from "../../typechain";

const { formatEther } = ethers.utils;

const addresses = getNetworkAddresses();
const poolParams = getDeployPoolConfig();

// npx hardhat run scripts/actions/pausePoolsWithManager.ts --network hardhat

const POOLS_TO_PAUSE = makeIdArray(9, 2);
const IS_PAUSED = true;

async function main() {
  try {
    const networkName = hre.network.name.toUpperCase();
    const forkTarget = networkName === "HARDHAT" ? ` (${fromFork()})` : "";
    console.log(`\n== PAUSE POOLS ON ${networkName}${forkTarget} ==\n`);

    const deployer = (await ethers.getSigners())[0];
    console.log("deployer: ", deployer.address);

    const balance = await deployer.getBalance();
    console.log("balance: ", `${formatEther(balance)} ETH`);

    //================//
    //== OPEN POOLS ==//
    //================//

    // ============ MANAGER PRE ============ //
    const LiquidityManager = LiquidityManager__factory.connect(
      addresses.LiquidityManager,
      deployer,
    );
    const nextPoolId = await LiquidityManager.nextPoolId();
    console.log("Next Pool Id: ", nextPoolId.toNumber());

    if (
      !addresses.PoolManager ||
      addresses.PoolManager === constants.AddressZero
    )
      throw Error("PoolManager address is missing");

    await postTxHandler(
      LiquidityManager.transferOwnership(addresses.PoolManager),
    );

    // ===================================== //

    console.log("\nPOOLS_TO_PAUSE: ", POOLS_TO_PAUSE);
    console.log("IS_PAUSED: ", IS_PAUSED);

    const PoolManager = await getPoolManager(addresses.PoolManager);

    await postTxHandler(PoolManager.batchPausePool(POOLS_TO_PAUSE, IS_PAUSED));

    // ============ MANAGER POST ============ //

    await postTxHandler(
      PoolManager.transferLiquidityManagerOwnership(deployer.address),
    );

    const liquidityManagerOwner = await LiquidityManager.owner();
    if (
      liquidityManagerOwner.toLowerCase() !== deployer.address.toLowerCase()
    ) {
      throw Error("LiquidityManager ownership transfer failed");
    }

    // ===================================== //

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
