import hre, { ethers } from "hardhat";
import { ProtocolConfig } from "../../test/helpers/deployers";
import {
  buybackWallet,
  evidenceGuardianWallet,
  leverageRiskWallet,
  treasuryWallet,
} from "../../test/helpers/hardhat";
import { toRay } from "../../test/helpers/utils/poolRayMath";

const { parseEther, parseUnits } = ethers.utils;

function fromFork() {
  const forkTarget = process.env.HARDHAT_FORK_TARGET?.toLowerCase();

  if (!forkTarget || forkTarget !== "arbitrum") {
    throw Error("Missing or erroneous fork target");
  }

  return forkTarget === "arbitrum" ? "arbitrum" : "";
}

const DAY_SECONDS = 24 * 60 * 60;

const deployParams: {
  [key: string]: ProtocolConfig;
} = {
  arbitrum: {
    subcourtId: 2,
    nbOfJurors: 4,
    challengePeriod: 10 * DAY_SECONDS,
    overrulePeriod: 4 * DAY_SECONDS,
    claimCollateral: parseEther("0.05"),
    arbitrationCost: parseEther("0"), // in ETH for centralized AthenaArbitrator
    evidenceGuardian: evidenceGuardianWallet(),
    //
    buybackWallet: buybackWallet(),
    treasuryWallet: treasuryWallet(),
    leverageRiskWallet: leverageRiskWallet(),
    yieldRewarder: "0x0000000000000000000000000000000000000000", // to be replaced by farming
    //
    leverageFeePerPool: toRay(0.7), // base 100
    withdrawDelay: 10 * DAY_SECONDS, // 14 days
    maxLeverage: 16, // max pools per position
    payoutDeductibleRate: toRay(5), // base 100
    strategyFeeRate: toRay(0), // base 100
    //
    poolFormula: {
      feeRate: toRay(10), // base 100
      uOptimal: toRay(75), // base 100
      r0: toRay(1), // base 100
      rSlope1: toRay(5), // base 100
      rSlope2: toRay(24), // base 100
    },
    yieldBonuses: [
      { atenAmount: parseUnits("0", 18), yieldBonus: toRay(0.025) },
      { atenAmount: parseUnits("1000", 18), yieldBonus: toRay(0.02) },
      { atenAmount: parseUnits("100000", 18), yieldBonus: toRay(0.015) },
      { atenAmount: parseUnits("1000000", 18), yieldBonus: toRay(0.005) },
    ],
    farmingBlockStart: 0,
  },
};

export function getDeployConfig() {
  const networkName = hre.network.name;
  const config =
    networkName === "hardhat"
      ? deployParams[fromFork()]
      : deployParams[networkName];

  if (!config) throw Error(`Missing deploy config for network ${networkName}`);

  return config;
}
