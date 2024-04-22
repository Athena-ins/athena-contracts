import hre from "hardhat";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { getNetworkAddresses } from "./verificationData/addresses";
// import { getMarketParams } from "./verificationData/marketParams";
//
import dotenv from "dotenv";
dotenv.config();

const execPromise = promisify(exec);

const fatalErrors = [
  `The address provided as argument contains a contract, but its bytecode`,
  `Daily limit of 100 source code submissions reached`,
  `has no bytecode. Is the contract deployed to this network`,
  `The constructor for`,
];
const okErrors = [`Contract source code already verified`, "Already Verified"];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function verifyEtherscanContract(
  address: string,
  constructorArguments: (string | string[])[],
  libraries?: string,
) {
  if (!process.env.ETHERSCAN_API_KEY) {
    throw Error("Missing process.env.ETHERSCAN_API_KEY.");
  }

  try {
    const msDelay = 3000;
    const times = 4;

    await delay(msDelay);

    let path = "";
    if (constructorArguments.length) {
      path = `temp/verify-params.js`;

      fs.writeFileSync(
        path,
        `module.exports = ${JSON.stringify([...constructorArguments])};`,
      );
    }

    function cleanup() {
      if (path && fs.existsSync(path)) fs.unlinkSync(path);
    }

    const params = {
      address: address,
      libraries,
      constructorArgs: path,
      relatedSources: true,
    };
    await runTaskWithRetry("verify", params, times, msDelay, cleanup);
  } catch (error) {
    console.log("error: ", error);
  }
}

export async function runTaskWithRetry(
  task: string,
  params: any,
  times: number,
  msDelay: number,
  cleanup: () => void,
) {
  let counter = times;
  await delay(msDelay);

  const networkName = hre.network.name.toLowerCase();

  const libs = params.libraries ? ` --libraries ${params.libraries}` : "";
  const args = params.constructorArgs
    ? ` --constructor-args ${params.constructorArgs}`
    : "";

  try {
    if (times >= 1) {
      await execPromise(
        `npx hardhat verify ${params.address}${libs}${args} --network ${networkName}`,
      );
      cleanup();
    } else {
      cleanup();
      console.error(
        "Errors after all the retries, check the logs for more information.",
      );
    }
  } catch (error: any) {
    counter--;

    if (okErrors.some((okReason) => error.message.includes(okReason))) {
      console.info("Skipping due OK response: ", error.message);
      return;
    }

    if (fatalErrors.some((fatalError) => error.message.includes(fatalError))) {
      console.error(
        "Fatal error detected, skip retries and resume deployment.",
        error.message,
      );
      return;
    }
    console.error(error.message);

    console.info(`Retrying attemps: ${counter}.`);
    if (error.message.includes("Fail - Unable to verify")) {
      console.log("Trying to verify via uploading all sources.");
      delete params.relatedSources;
    }
    await runTaskWithRetry(task, params, counter, msDelay, cleanup);
  }
}

async function main() {
  const networkName = hre.network.name.toUpperCase();
  console.log(`\n== VERIFYING ON ${networkName} ==\n`);

  // const params = getMarketParams();
  // const contracts = getNetworkAddresses();

  // await verifyEtherscanContract(
  //   contracts.LendingPool,
  //   [contracts.LendingPoolAddressesProvider], // args
  //   "scripts/verificationData/LendingPoolLibs.js", // libs
  // );
  // console.log("=> Verified LendingPool");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
