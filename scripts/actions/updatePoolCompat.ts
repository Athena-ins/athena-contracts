import { Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import { getConnectedProtocolContracts } from "../../test/helpers/contracts-getters";
import { fromFork } from "../../test/helpers/hardhat";
import { getNetworkAddresses } from "../verificationData/addresses";

const { formatEther } = ethers.utils;

async function main() {
  try {
    const networkName = hre.network.name.toUpperCase();
    const forkTarget = networkName === "HARDHAT" ? ` (${fromFork()})` : "";
    console.log(`\n== UPDATE POOLS ON ${networkName}${forkTarget} ==\n`);

    const deployer = (await ethers.getSigners())[0] as unknown as Wallet;
    console.log("deployer: ", deployer.address);

    const balance = await deployer.getBalance();
    console.log("balance: ", `${formatEther(balance)} ETH`);

    if (balance.eq(0)) throw new Error("Zero balance in deployer wallet");

    // Used to setup in case of partial deploys
    const addresses = getNetworkAddresses();

    //===============//
    //== CONTRACTS ==//
    //===============//

    const { LiquidityManager } = await getConnectedProtocolContracts(
      addresses,
      "lisk",
    );

    console.log("\n==> Contracts OK");

    // 0 - Across Bridge
    // 1 - Oku LP
    // 2 - Relay Bridge

    /**
     * Important!
     *
     * Pool IDs must be in ASCENDING order and poolId A (first array)
     * must always be smaller than poolIds B (second array).
     * This avoid redundant records.
     */

    await LiquidityManager.updatePoolCompatibility(
      [0, 1],
      [[1, 2], [2]],
      [[true, false], [true]],
    ).then((tx) => tx.wait());

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

    console.log("\n==> Pools setup");
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
