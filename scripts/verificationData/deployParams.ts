import hre, { ethers } from "hardhat";
import {
  buybackWallet,
  evidenceGuardianWallet,
  leverageRiskWallet,
  treasuryWallet,
  fromFork,
} from "../../test/helpers/hardhat";
import { toRay } from "../../test/helpers/utils/poolRayMath";
// Types
import { ProtocolConfig } from "../../test/helpers/deployers";
import { NetworkName, NetworksOrFork } from "../../hardhat.config";

const { parseEther, parseUnits } = ethers.utils;

const DAY_SECONDS = 24 * 60 * 60;

type AmphorStrategyParams = {
  wstETH: string;
  amphrETH: string;
  amphrLRT: string;
  weth: string;
  morphoMevVault: string;
};

type LiskStrategyParams = {
  usdt: string;
  lsk: string;
};

type CoreDaoStrategyParams = {
  colendLendingPool: string;
  USDC: string;
  sUSDC: string;
  wCORE: string;
  stCORE: string;
};

export const amphorStrategyParams: AmphorStrategyParams = {
  // Lido LST Token
  wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0".toLowerCase(),
  // (((Strategy 1))) - Amphor Restaked ETH
  amphrETH: "0x5fD13359Ba15A84B76f7F87568309040176167cd".toLowerCase(),
  // (((Strategy 2))) - Amphor Symbiotic LRT
  amphrLRT: "0x06824c27c8a0dbde5f72f770ec82e3c0fd4dcec3".toLowerCase(),
  // (((Strategy 3))) - Morpho MEV Vault
  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  morphoMevVault: "0x9a8bC3B04b7f3D87cfC09ba407dCED575f2d61D8",
};

export const liskStrategyParams: LiskStrategyParams = {
  // Premiums tokens
  usdt: "0x2d7382d9d020532a937bd2231376bbcd99168393".toLowerCase(),
  // (((Strategy 1))) - Collateral
  lsk: "0x7ea5687DDA47947468Ced48503626a05E42FFee4".toLowerCase(),
};

export const coreDaoStrategyParams: CoreDaoStrategyParams = {
  // (((Strategy 0))) - Colend Lending Pool USDC
  colendLendingPool: "0x0CEa9F0F49F30d376390e480ba32f903B43B19C5".toLowerCase(),
  USDC: "0xa4151B2B3e269645181dCcF2D426cE75fcbDeca9".toLowerCase(),
  sUSDC: "0x8f9d6649C4ac1d894BB8A26c3eed8f1C9C5f82Dd".toLowerCase(),
  // (((Strategy 1))) - Core Liquid Staking
  wCORE: "0x40375C92d9FAf44d2f9db9Bd9ba41a3317a2404f".toLowerCase(),
  stCORE: "0xb3a8f0f0da9ffc65318aa39e55079796093029ad".toLowerCase(),
};

/**
 * This configuration in ONLY to be used in the test suite
 */
const defaultProtocolConfig: ProtocolConfig = {
  //==== Liquidity Manager Config ====//
  maxLeverage: 12, // max pools per position
  withdrawDelay: 14 * DAY_SECONDS, // 14 days
  leverageFeePerPool: toRay(0.7), // base 100
  poolFormula: {
    feeRate: toRay(10), // 10%
    uOptimal: toRay(75),
    r0: toRay(1),
    rSlope1: toRay(5),
    rSlope2: toRay(10),
  },
  //==== Strategy Manager Config ====//
  payoutDeductibleRate: toRay(10), // 10%
  strategyFeeRate: toRay(50), // 50%
  //==== Claim Manager Config ====//
  subcourtId: 2,
  nbOfJurors: 4,
  challengePeriod: 10 * DAY_SECONDS, // days seconds
  overrulePeriod: 4 * DAY_SECONDS, // days seconds
  evidenceUploadPeriod: 2 * DAY_SECONDS, // days seconds
  baseMetaEvidenceURI: "https://api.athenains.io/metaevidence",
  claimCollateral: parseEther("0.0002"), // in ETH
  arbitrationCost: parseEther("0.00012"), // in ETH
  //==== Rewards Manager Config ====//
  farmingBlockStart: 0, // leave 0 for dynamic
  yieldBonuses: [
    { atenAmount: parseUnits("0", 18), yieldBonus: toRay(0.025) },
    { atenAmount: parseUnits("1000", 18), yieldBonus: toRay(0.02) },
    { atenAmount: parseUnits("100000", 18), yieldBonus: toRay(0.015) },
    { atenAmount: parseUnits("1000000", 18), yieldBonus: toRay(0.005) },
  ],
  //==== Wallets ====//
  evidenceGuardian: evidenceGuardianWallet(),
  buybackWallet: buybackWallet(),
  treasuryWallet: treasuryWallet(),
  leverageRiskWallet: leverageRiskWallet(),
  yieldRewarder: "0x0000000000000000000000000000000000000000",
};

const deployParams: {
  [key in NetworkName]?: ProtocolConfig;
} & {
  mainnet?: ProtocolConfig & AmphorStrategyParams;
  lisk_sepolia?: ProtocolConfig & LiskStrategyParams;
  core_dao?: ProtocolConfig & CoreDaoStrategyParams;
  core_dao_testnet?: ProtocolConfig & CoreDaoStrategyParams;
} = {
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

  lisk_sepolia: getDefaultProtocolConfig("lisk", {
    claimCollateral: parseEther("0.0002"),
    arbitrationCost: parseEther("0.00012"),
    strategyFeeRate: toRay(0),
  }),
  core_dao: getDefaultProtocolConfig("core_dao", {
    claimCollateral: parseEther("0.0002"),
    arbitrationCost: parseEther("0.00012"),
  }),
};

export function getDeployConfig() {
  const networkName = hre.network.name as NetworksOrFork;
  const forkedNetworkName = networkName === "hardhat" ? fromFork() : "";
  const config =
    networkName === "hardhat"
      ? deployParams[fromFork() as NetworkName]
      : deployParams[networkName];

  if (!config)
    throw Error(
      `Missing deploy config for network ${forkedNetworkName || networkName}`,
    );

  return config;
}

export function getDefaultProtocolConfig(
  extraParams?: undefined,
  overrides?: Partial<ProtocolConfig>,
): ProtocolConfig;
export function getDefaultProtocolConfig(
  extraParams: "lisk",
  overrides?: Partial<ProtocolConfig>,
): ProtocolConfig & LiskStrategyParams;
export function getDefaultProtocolConfig(
  extraParams: "amphor",
  overrides?: Partial<ProtocolConfig>,
): ProtocolConfig & AmphorStrategyParams;
export function getDefaultProtocolConfig(
  extraParams: "core_dao",
  overrides?: Partial<ProtocolConfig>,
): ProtocolConfig & CoreDaoStrategyParams;

export function getDefaultProtocolConfig(
  extraParams?: "amphor" | "lisk" | "core_dao",
  overrides: Partial<ProtocolConfig> = {},
) {
  let extraChainParams = {};

  if (extraParams === "amphor") {
    extraChainParams = amphorStrategyParams;
  }
  if (extraParams === "lisk") {
    extraChainParams = liskStrategyParams;
  }
  if (extraParams === "core_dao") {
    extraChainParams = coreDaoStrategyParams;
  }

  return {
    ...defaultProtocolConfig,
    ...extraChainParams,
    ...overrides,
  };
}
