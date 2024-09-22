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

  if (!forkTarget) {
    throw Error("Missing or erroneous fork target");
  }

  return forkTarget;
}

const DAY_SECONDS = 24 * 60 * 60;

type AmphorStrategyParams = {
  wstETH: string;
  amphrETH: string;
  amphrLRT: string;
};

export const amphorStrategyParams = {
  // Lido LST Token
  wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0".toLowerCase(),
  // (((Strategy 1))) - Amphor Restaked ETH
  amphrETH: "0x5fD13359Ba15A84B76f7F87568309040176167cd".toLowerCase(),
  // (((Strategy 2))) - Amphor Symbiotic LRT
  amphrLRT: "0x06824c27c8a0dbde5f72f770ec82e3c0fd4dcec3".toLowerCase(),
};

const deployParams: {
  [key: string]: ProtocolConfig;
} & {
  mainnet?: ProtocolConfig & AmphorStrategyParams;
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
  mainnet: {
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
    ...amphorStrategyParams,
  },
};

export function getDeployConfig() {
  const networkName = hre.network.name;
  const forkedNetworkName = networkName === "hardhat" ? fromFork() : "";
  const config =
    networkName === "hardhat"
      ? deployParams[forkedNetworkName]
      : deployParams[networkName];

  if (!config)
    throw Error(
      `Missing deploy config for network ${forkedNetworkName || networkName}`,
    );

  return config;
}

/**
 * This configuration in ONLY to be used in the test suite
 */
export const defaultProtocolConfig: ProtocolConfig & AmphorStrategyParams = {
  subcourtId: 2,
  nbOfJurors: 4,
  challengePeriod: 10 * DAY_SECONDS, // 10 days
  overrulePeriod: 4 * DAY_SECONDS, // 4 days
  evidenceUploadPeriod: 2 * DAY_SECONDS, // 2 days
  baseMetaEvidenceURI: "https://api.athenains.io/metaevidence",
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
  ...amphorStrategyParams,
};
