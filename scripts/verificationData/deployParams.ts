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

const deployParams: {
  [key: string]: ProtocolConfig;
} = {
  arbitrum: {
    subcourtId: 2,
    nbOfJurors: 4,
    arbitrationCollateral: parseEther("0.05"), // in ETH
    evidenceGuardian: evidenceGuardianWallet(),
    buybackWallet: buybackWallet(),
    treasuryWallet: treasuryWallet(),
    leverageRiskWallet: leverageRiskWallet(),
    yieldRewarder: "0x0000000000000000000000000000000000000000", // to be replaced by farming
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
    withdrawDelay: 14 * 24 * 60 * 60, // 14 days
    maxLeverage: 12, // max pools per position
    payoutDeductibleRate: toRay(10), // 10%
    performanceFeeRate: toRay(50), // 50%
    farmingBlockStart: 0,
  },
};

export function getDeployConfig() {
  const networkName = hre.network.name.toUpperCase();
  const contracts =
    networkName === "HARDHAT"
      ? deployParams[fromFork()]
      : deployParams[networkName];

  if (!contracts) throw Error(`Missing addresses for network ${networkName}`);

  return contracts;
}
