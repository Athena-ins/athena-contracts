import { exec } from "child_process";
import fs from "fs";
import hre from "hardhat";
import { promisify } from "util";
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

type HardhatVerifyParams = {
  address: string;
  libraries: string | undefined;
  constructorArgs: string;
  relatedSources: boolean;
  contract: string | undefined;
};

export async function verifyEtherscanContract<
  T extends {
    deploy: (...args: any[]) => any;
  },
>(
  address: string,
  constructorArguments: Parameters<T["deploy"]>,
  libraries?: string,
  contractPath?: string,
) {
  try {
    const msDelay = 3000;
    const times = 1;

    await delay(msDelay);

    let path = "";
    if (constructorArguments.length) {
      path = `temp/verify-params.js`;

      if (!fs.existsSync("temp")) fs.mkdirSync("temp");

      fs.writeFileSync(
        path,
        `module.exports = ${JSON.stringify([...constructorArguments])};`,
      );
    }

    function cleanup() {
      if (path && fs.existsSync(path)) fs.unlinkSync(path);
    }

    const params: HardhatVerifyParams = {
      address: address,
      libraries,
      constructorArgs: path,
      relatedSources: true,
      contract: contractPath,
    };
    await runTaskWithRetry("verify", params, times, msDelay, cleanup);
  } catch (error) {
    console.log("error: ", error);
  }
}

export async function runTaskWithRetry(
  task: string,
  params: HardhatVerifyParams,
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
  const contract = params.contract ? ` --contract ${params.contract}` : "";

  try {
    if (times >= 1) {
      await execPromise(
        `npx hardhat verify ${params.address}${contract}${libs}${args} --network ${networkName}`,
      );
      cleanup();
    } else {
      cleanup();
      console.error(
        "Errors after all the retries, check the logs for more information.",
      );
    }
  } catch (error: any) {
    console.log("error: ", error);
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
      params.relatedSources = false;
    }
    await runTaskWithRetry(task, params, counter, msDelay, cleanup);
  }
}
