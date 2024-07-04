import hre, { ethers } from "hardhat";
import { toRay } from "../../test/helpers/utils/poolRayMath";
import { getNetworkAddresses } from "./addresses";
import { BigNumberish } from "ethers";

const addresses = getNetworkAddresses();

function fromFork() {
  const forkTarget = process.env.HARDHAT_FORK_TARGET?.toLowerCase();

  if (!forkTarget || forkTarget !== "arbitrum") {
    throw Error("Missing or erroneous fork target");
  }

  return forkTarget === "arbitrum" ? "arbitrum" : "";
}

const formulaConfig = {
  A: {
    feeRate: toRay(0), // 10%
    uOptimal: toRay(80),
    r0: toRay(3.2),
    rSlope1: toRay(4.6),
    rSlope2: toRay(17.1),
  },
  B: {
    feeRate: toRay(0), // 10%
    uOptimal: toRay(80),
    r0: toRay(3.8),
    rSlope1: toRay(5.2),
    rSlope2: toRay(17.1),
  },
  C: {
    feeRate: toRay(0), // 10%
    uOptimal: toRay(80),
    r0: toRay(3.2),
    rSlope1: toRay(4.6),
    rSlope2: toRay(17.1),
  },
  D: {
    feeRate: toRay(0), // 10%
    uOptimal: toRay(90),
    r0: toRay(1.8),
    rSlope1: toRay(2.8),
    rSlope2: toRay(15),
  },
  E: {
    feeRate: toRay(0), // 10%
    uOptimal: toRay(95),
    r0: toRay(1.8),
    rSlope1: toRay(1.8),
    rSlope2: toRay(9),
  },
  F: {
    feeRate: toRay(0), // 10%
    uOptimal: toRay(95),
    r0: toRay(1.6),
    rSlope1: toRay(1.9),
    rSlope2: toRay(9),
  },
};

const protocolNames = [
  "Eigen layer",
  "Pendle",
  "Renzo",
  "Ether.fi",
  "Amphor",
  "Spectra",
  "Equilibria",
  "Kelp DAO",
  "Puffer Finance",
  "Karak",
  "Zircuit",
  "Mellow",
  "Symbiotic",
  "Curve",
  "Compound",
  "Balancer",
  //
  "Eigen + Ether.fi + Zircuit + Pendle",
  "Eigen + Ether.fi + Karak + Pendle",
  "Eigen + Kelp DAO + Zircuit + Pendle",
  "Eigen + Renzo + Zircuit + Pendle",
  //
  "Ethena USDe",
  "Dai",
  "AAVE GHO",
  "Liquity LUSD",
  "USDT",
  "Angle USDa",
] as const;

type ProtocolName = (typeof protocolNames)[number];

type PoolParams = {
  paymentAsset: string;
  strategyId: BigNumberish;
  incompatiblePools: ProtocolName[];
  feeRate: BigNumberish;
  uOptimal: BigNumberish;
  r0: BigNumberish;
  rSlope1: BigNumberish;
  rSlope2: BigNumberish;
};

const deployParams: {
  [chainName: string]: { [coverName in ProtocolName]: PoolParams };
} = {
  arbitrum: {
    //=== A ===//
    "Eigen layer": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Eigen + Ether.fi + Zircuit + Pendle",
        "Eigen + Ether.fi + Karak + Pendle",
        "Eigen + Kelp DAO + Zircuit + Pendle",
        "Eigen + Renzo + Zircuit + Pendle",
      ],
      ...formulaConfig.A,
    },
    "Pendle": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Eigen + Kelp DAO + Zircuit + Pendle",
        "Eigen + Renzo + Zircuit + Pendle",
        "Eigen + Ether.fi + Zircuit + Pendle",
        "Eigen + Ether.fi + Karak + Pendle",
      ],
      ...formulaConfig.A,
    },
    "Renzo": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: ["Eigen + Renzo + Zircuit + Pendle"],
      ...formulaConfig.A,
    },
    "Ether.fi": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Eigen + Ether.fi + Zircuit + Pendle",
        "Eigen + Ether.fi + Karak + Pendle",
      ],
      ...formulaConfig.A,
    },
    "Amphor": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.A,
    },
    "Spectra": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.A,
    },
    "Equilibria": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.A,
    },
    "Kelp DAO": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: ["Eigen + Kelp DAO + Zircuit + Pendle"],
      ...formulaConfig.A,
    },
    "Puffer Finance": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.A,
    },
    "Karak": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: ["Pendle", "Eigen layer", "Ether.fi", "Karak"],
      ...formulaConfig.A,
    },
    "Zircuit": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Eigen + Kelp DAO + Zircuit + Pendle",
        "Eigen + Renzo + Zircuit + Pendle",
        "Eigen + Ether.fi + Zircuit + Pendle",
      ],
      ...formulaConfig.A,
    },
    "Mellow": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.A,
    },
    "Symbiotic": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.A,
    },
    //=== B ===//
    "Eigen + Ether.fi + Zircuit + Pendle": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Pendle",
        "Eigen layer",
        "Ether.fi",
        "Zircuit",
        "Eigen + Ether.fi + Karak + Pendle",
        "Eigen + Kelp DAO + Zircuit + Pendle",
        "Eigen + Renzo + Zircuit + Pendle",
      ],
      ...formulaConfig.B,
    },
    "Eigen + Ether.fi + Karak + Pendle": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Pendle",
        "Eigen layer",
        "Ether.fi",
        "Karak",
        "Eigen + Ether.fi + Zircuit + Pendle",
        "Eigen + Kelp DAO + Zircuit + Pendle",
        "Eigen + Renzo + Zircuit + Pendle",
      ],
      ...formulaConfig.B,
    },
    "Eigen + Kelp DAO + Zircuit + Pendle": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Pendle",
        "Eigen layer",
        "Kelp DAO",
        "Zircuit",
        "Eigen + Ether.fi + Zircuit + Pendle",
        "Eigen + Ether.fi + Karak + Pendle",
        "Eigen + Renzo + Zircuit + Pendle",
      ],
      ...formulaConfig.B,
    },
    "Eigen + Renzo + Zircuit + Pendle": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Pendle",
        "Eigen layer",
        "Renzo",
        "Zircuit",
        "Eigen + Ether.fi + Zircuit + Pendle",
        "Eigen + Ether.fi + Karak + Pendle",
        "Eigen + Kelp DAO + Zircuit + Pendle",
      ],
      ...formulaConfig.B,
    },
    //=== C ===//
    "Ethena USDe": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.C,
    },
    "Dai": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: ["USDT"],
      ...formulaConfig.C,
    },
    //=== D ===//
    "AAVE GHO": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.D,
    },
    "Liquity LUSD": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.D,
    },
    //=== E ===//
    "USDT": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: ["Dai"],
      ...formulaConfig.E,
    },
    "Angle USDa": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.E,
    },
    //=== F ===//
    "Curve": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.F,
    },
    "Compound": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.F,
    },
    "Balancer": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.F,
    },
  },
};

type FormattedPoolParams = PoolParams & {
  compatiblePools: number[];
};

function formatCompatiblePools(networkPools: {
  [coverName in ProtocolName]: PoolParams;
}): FormattedPoolParams[] {
  const poolNames = Object.keys(networkPools) as ProtocolName[];
  const poolParams = Object.values(networkPools);

  const nbPools = poolNames.length;
  const allPoolIds = Array.from({ length: nbPools }, (_, i) => i);

  const errors = [];
  // For each pool
  for (const [i, pool] of poolParams.entries()) {
    // Check each incompatible pool
    for (const incompatiblePool of pool.incompatiblePools) {
      // To see if the other pool has the current pool as incompatible
      const hasMirror = networkPools[
        incompatiblePool
      ].incompatiblePools.includes(poolNames[i]);

      // If push to throw once all incompatible pools have been checked
      if (!hasMirror) {
        errors.push(
          `Pool ${incompatiblePool} is missing ${poolNames[i]} in its incompatible pools`,
        );
      }
    }
  }

  if (errors.length) throw new Error(errors.join("\n"));

  return poolParams.map((params, i) => {
    const compatiblePools = allPoolIds
      // Remove own pool
      .filter((id) => id !== i)
      // Remove incompatible pools
      .filter((id) => !params.incompatiblePools.includes(poolNames[id]))
      // Remove any ID greater than the current on to avoid redundant registration
      .filter((id) => id < i);

    return {
      ...params,
      compatiblePools,
    };
  });
}

export function getDeployPoolConfig(): FormattedPoolParams[] {
  const networkName = hre.network.name;
  const config =
    networkName === "hardhat"
      ? deployParams[fromFork()]
      : deployParams[networkName];

  if (!config) throw Error(`Missing deploy config for network ${networkName}`);

  return formatCompatiblePools(config);
}
