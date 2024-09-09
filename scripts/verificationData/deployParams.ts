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
    challengePeriod: 182 * DAY_SECONDS,
    overrulePeriod: 4 * DAY_SECONDS,
    evidenceUploadPeriod: 2 * DAY_SECONDS,
    claimCollateral: parseEther("0.0002"),
    arbitrationCost: parseEther("0.00012"), // in ETH for centralized AthenaArbitrator
    evidenceGuardian: evidenceGuardianWallet(),
    baseMetaEvidenceURI: "https://api.athenains.io/metaevidence",
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

/**
 * This configuration in ONLY to be used in the test suite
 */
export const defaultProtocolConfig: ProtocolConfig = {
  subcourtId: 2,
  nbOfJurors: 4,
  challengePeriod: 10 * DAY_SECONDS, // 10 days
  overrulePeriod: 4 * DAY_SECONDS, // 4 days
  evidenceUploadPeriod: 2 * DAY_SECONDS, // 2 days
  baseMetaEvidenceURI: "process.env.ATHENA_API_URL",
  claimCollateral: parseEther("0.05"), // in ETH
  arbitrationCost: parseEther("0"), // in ETH
  evidenceGuardian: evidenceGuardianWallet(),
  buybackWallet: buybackWallet(),
  treasuryWallet: treasuryWallet(),
  leverageRiskWallet: leverageRiskWallet(),
  yieldRewarder: "0x0000000000000000000000000000000000000000",
  leverageFeePerPool: toRay(1.5), // 1.5% base 100
  poolFormula: {
    feeRate: toRay(10), // 10%
    uOptimal: toRay(75),
    r0: toRay(1),
    rSlope1: toRay(5),
    rSlope2: toRay(10),
  },
  yieldBonuses: [
    { atenAmount: parseUnits("0", 18), yieldBonus: toRay(0.025) },
    { atenAmount: parseUnits("1000", 18), yieldBonus: toRay(0.02) },
    { atenAmount: parseUnits("100000", 18), yieldBonus: toRay(0.015) },
    { atenAmount: parseUnits("1000000", 18), yieldBonus: toRay(0.005) },
  ],
  withdrawDelay: 14 * DAY_SECONDS, // 14 days
  maxLeverage: 12, // max pools per position
  payoutDeductibleRate: toRay(10), // 10%
  strategyFeeRate: toRay(50), // 50%
  farmingBlockStart: 0, // leave 0 for dynamic
};
