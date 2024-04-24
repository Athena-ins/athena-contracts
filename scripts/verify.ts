import hre from "hardhat";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { getNetworkAddresses } from "./verificationData/addresses";
import { getDeployConfig } from "./verificationData/deployParams";
//
import {
  AthenaCoverToken__factory,
  AthenaPositionToken__factory,
  AthenaToken__factory,
  PoolMath__factory,
  VirtualPool__factory,
  AthenaDataProvider__factory,
  ClaimManager__factory,
  StrategyManager__factory,
  LiquidityManager__factory,
  RewardManager__factory,
  EcclesiaDao__factory,
  MockArbitrator__factory,
} from "../typechain";
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

export async function verifyEtherscanContract<
  T extends {
    deploy: (...args: any[]) => any;
  },
>(
  address: string,
  constructorArguments: Parameters<T["deploy"]>,
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

  const config = getDeployConfig();
  const deployedAt = getNetworkAddresses();

  // ======= Tokens ======= //

  verifyEtherscanContract<AthenaCoverToken__factory>(
    deployedAt.AthenaCoverToken,
    [deployedAt.LiquidityManager],
  );
  console.log("==> Verification processed for AthenaCoverToken");

  verifyEtherscanContract<AthenaPositionToken__factory>(
    deployedAt.AthenaPositionToken,
    [deployedAt.LiquidityManager],
  );
  console.log("==> Verification processed for AthenaPositionToken");

  verifyEtherscanContract<AthenaToken__factory>(deployedAt.AthenaToken, [
    [deployedAt.EcclesiaDao, deployedAt.Staking],
  ]);
  console.log("==> Verification processed for AthenaToken");

  // ======= Libs ======= //

  verifyEtherscanContract<PoolMath__factory>(deployedAt.PoolMath, []);
  console.log("==> Verification processed for PoolMath");

  verifyEtherscanContract<VirtualPool__factory>(
    deployedAt.VirtualPool,
    [],
    "scripts/verificationData/libsVirtualPool.js",
  );
  console.log("==> Verification processed for VirtualPool");

  verifyEtherscanContract<AthenaDataProvider__factory>(
    deployedAt.AthenaDataProvider,
    [],
    "scripts/verificationData/libsAthenaDataProvider.js",
  );
  console.log("==> Verification processed for AthenaDataProvider");

  // ======= Managers ======= //

  verifyEtherscanContract<ClaimManager__factory>(deployedAt.ClaimManager, [
    deployedAt.AthenaCoverToken, // IAthenaCoverToken coverToken_
    deployedAt.LiquidityManager, // ILiquidityManager liquidityManager_
    deployedAt.MockArbitrator, // IArbitrator arbitrator_
    config.evidenceGuardian.address, // address metaEvidenceGuardian_
    config.leverageRiskWallet.address, // address leverageRiskWallet_
    config.subcourtId, // uint256 subcourtId_
    config.nbOfJurors, // uint256 nbOfJurors_
  ]);
  console.log("==> Verification processed for ClaimManager");

  verifyEtherscanContract<StrategyManager__factory>(
    deployedAt.StrategyManager,
    [
      deployedAt.LiquidityManager,
      deployedAt.EcclesiaDao,
      config.buybackWallet.address,
      config.payoutDeductibleRate, // payoutDeductibleRate
      config.performanceFee, // performanceFee
    ],
  );
  console.log("==> Verification processed for StrategyManager");

  verifyEtherscanContract<LiquidityManager__factory>(
    deployedAt.LiquidityManager,
    [
      deployedAt.AthenaPositionToken,
      deployedAt.AthenaCoverToken,
      deployedAt.EcclesiaDao,
      deployedAt.StrategyManager,
      deployedAt.ClaimManager,
      config.yieldRewarder,
      config.withdrawDelay,
      config.maxLeverage,
      config.leverageFeePerPool,
    ],
    "scripts/verificationData/libsLiquidityManager.js",
  );
  console.log("==> Verification processed for LiquidityManager");

  verifyEtherscanContract<RewardManager__factory>(deployedAt.RewardManager, [
    deployedAt.LiquidityManager,
    deployedAt.EcclesiaDao,
    deployedAt.AthenaPositionToken,
    deployedAt.AthenaCoverToken,
    deployedAt.AthenaToken,
    config.farmingBlockStart,
    config.yieldBonuses,
  ]);
  console.log("==> Verification processed for RewardManager");

  // ======= DAO ======= //

  verifyEtherscanContract<EcclesiaDao__factory>(deployedAt.EcclesiaDao, [
    deployedAt.AthenaToken,
    deployedAt.Staking,
    deployedAt.LiquidityManager,
    deployedAt.StrategyManager,
    config.treasuryWallet.address,
    config.leverageRiskWallet.address,
  ]);
  console.log("==> Verification processed for EcclesiaDao");

  // ======= Claims ======= //

  verifyEtherscanContract<MockArbitrator__factory>(deployedAt.MockArbitrator, [
    config.arbitrationCollateral,
  ]);
  console.log("==> Verification processed for MockArbitrator");

  // await verifyEtherscanContract(
  //   deployedAt.AthenaCoverToken,
  //   [deployedAt.LiquidityManager], // args
  //   "scripts/verificationData/LendingPoolLibs.js", // libs
  // );
  // console.log("=> Verified AthenaCoverToken");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
