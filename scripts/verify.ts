import { exec } from "child_process";
import fs from "fs";
import hre, { ethers } from "hardhat";
import { promisify } from "util";
import { entityProviderChainId } from "../test/helpers/hardhat";
import {
  aaveLendingPoolV3Address,
  usdcTokenAddress,
} from "../test/helpers/protocol";
import { getNetworkAddresses } from "./verificationData/addresses";
import { getDeployConfig } from "./verificationData/deployParams";
//
import { Wallet } from "ethers";
import {
  AthenaCoverToken__factory,
  AthenaDataProvider__factory,
  AthenaPositionToken__factory,
  AthenaToken__factory,
  ClaimManager__factory,
  EcclesiaDao__factory,
  LiquidityManager__factory,
  MockArbitrator__factory,
  PoolMath__factory,
  RewardManager__factory,
  FarmingRange__factory,
  Staking__factory,
  StrategyManager__factory,
  VirtualPool__factory,
} from "../typechain";
//
import dotenv from "dotenv";
dotenv.config();

const execPromise = promisify(exec);

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

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
  try {
    const msDelay = 3000;
    const times = 4;

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
      delete params.relatedSources;
    }
    await runTaskWithRetry(task, params, counter, msDelay, cleanup);
  }
}

async function main() {
  const networkName = hre.network.name.toUpperCase();
  console.log(`\n== VERIFYING ON ${networkName} ==\n`);

  const deployer = (await ethers.getSigners())[0] as unknown as Wallet;
  console.log("deployer: ", deployer.address);

  const chainId = await entityProviderChainId(deployer);
  if (!chainId) throw Error("No chainId found for deployment signer");

  const config = getDeployConfig();
  const deployedAt = getNetworkAddresses();

  const {
    AthenaCoverToken: AthenaCoverToken,
    AthenaPositionToken: AthenaPositionToken,
    AthenaToken: AthenaToken,
    EcclesiaDao: EcclesiaDao,
    MockArbitrator: MockArbitrator,
    ClaimManager: ClaimManager,
    LiquidityManager: LiquidityManager,
    StrategyManager: StrategyManager,
    RewardManager: RewardManager,
    FarmingRange: FarmingRange,
    Staking: Staking,
    PoolMath: PoolMath,
    VirtualPool: VirtualPool,
    AthenaDataProvider: AthenaDataProvider,
  } = deployedAt;

  // ======= Tokens ======= //

  if (AthenaCoverToken !== ADDRESS_ZERO) {
    await verifyEtherscanContract<AthenaCoverToken__factory>(AthenaCoverToken, [
      LiquidityManager,
    ]);
    console.log("==> Verification processed for AthenaCoverToken");
  }

  if (AthenaPositionToken !== ADDRESS_ZERO) {
    await verifyEtherscanContract<AthenaPositionToken__factory>(
      AthenaPositionToken,
      [LiquidityManager],
    );
    console.log("==> Verification processed for AthenaPositionToken");
  }

  if (AthenaToken !== ADDRESS_ZERO) {
    await verifyEtherscanContract<AthenaToken__factory>(AthenaToken, [
      [EcclesiaDao, Staking],
    ]);
    console.log("==> Verification processed for AthenaToken");
  }

  // ======= Libs ======= //

  if (PoolMath !== ADDRESS_ZERO) {
    await verifyEtherscanContract<PoolMath__factory>(PoolMath, []);
    console.log("==> Verification processed for PoolMath");
  }

  if (VirtualPool !== ADDRESS_ZERO) {
    await verifyEtherscanContract<VirtualPool__factory>(
      VirtualPool,
      [],
      "scripts/verificationData/libsVirtualPool.js",
    );
    console.log("==> Verification processed for VirtualPool");
  }

  if (AthenaDataProvider !== ADDRESS_ZERO) {
    await verifyEtherscanContract<AthenaDataProvider__factory>(
      AthenaDataProvider,
      [],
      "scripts/verificationData/libsAthenaDataProvider.js",
    );
    console.log("==> Verification processed for AthenaDataProvider");
  }

  // ======= Managers ======= //

  if (ClaimManager !== ADDRESS_ZERO) {
    await verifyEtherscanContract<ClaimManager__factory>(ClaimManager, [
      AthenaCoverToken, // IAthenaCoverToken coverToken_
      LiquidityManager, // ILiquidityManager liquidityManager_
      MockArbitrator, // IArbitrator arbitrator_
      config.evidenceGuardian.address, // address metaEvidenceGuardian_
      config.leverageRiskWallet.address, // address leverageRiskWallet_
      config.subcourtId, // uint256 subcourtId_
      config.nbOfJurors, // uint256 nbOfJurors_
    ]);
    console.log("==> Verification processed for ClaimManager");
  }

  if (StrategyManager !== ADDRESS_ZERO) {
    await verifyEtherscanContract<StrategyManager__factory>(StrategyManager, [
      LiquidityManager,
      EcclesiaDao,
      aaveLendingPoolV3Address(chainId),
      usdcTokenAddress(chainId),
      config.buybackWallet.address,
      config.payoutDeductibleRate, // payoutDeductibleRate
      config.performanceFeeRate, // performanceFee
    ]);
    console.log("==> Verification processed for StrategyManager");
  }

  if (LiquidityManager !== ADDRESS_ZERO) {
    await verifyEtherscanContract<LiquidityManager__factory>(
      LiquidityManager,
      [
        AthenaPositionToken,
        AthenaCoverToken,
        EcclesiaDao,
        StrategyManager,
        ClaimManager,
        config.yieldRewarder,
        config.withdrawDelay,
        config.maxLeverage,
        config.leverageFeePerPool,
      ],
      "scripts/verificationData/libsLiquidityManager.js",
    );
    console.log("==> Verification processed for LiquidityManager");
  }

  // ======= Rewards ======= //

  if (RewardManager !== ADDRESS_ZERO) {
    await verifyEtherscanContract<RewardManager__factory>(RewardManager, [
      LiquidityManager,
      EcclesiaDao,
      AthenaPositionToken,
      AthenaCoverToken,
      AthenaToken,
      config.farmingBlockStart,
      config.yieldBonuses,
    ]);
    console.log("==> Verification processed for RewardManager");
  }

  if (FarmingRange !== ADDRESS_ZERO) {
    await verifyEtherscanContract<FarmingRange__factory>(
      FarmingRange,
      [RewardManager, LiquidityManager, AthenaPositionToken, AthenaCoverToken], // args
    );
    console.log("=> Verified FarmingRange");
  }

  if (Staking !== ADDRESS_ZERO) {
    await verifyEtherscanContract<Staking__factory>(
      Staking,
      [AthenaToken, FarmingRange, LiquidityManager, EcclesiaDao], // args
    );
    console.log("=> Verified Staking");
  }

  // ======= DAO ======= //

  if (EcclesiaDao !== ADDRESS_ZERO) {
    await verifyEtherscanContract<EcclesiaDao__factory>(EcclesiaDao, [
      AthenaToken,
      Staking,
      LiquidityManager,
      StrategyManager,
      config.treasuryWallet.address,
      config.leverageRiskWallet.address,
    ]);
    console.log("==> Verification processed for EcclesiaDao");
  }

  // ======= Claims ======= //

  if (MockArbitrator !== ADDRESS_ZERO) {
    await verifyEtherscanContract<MockArbitrator__factory>(MockArbitrator, [
      config.arbitrationCollateral,
    ]);
    console.log("==> Verification processed for MockArbitrator");
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
