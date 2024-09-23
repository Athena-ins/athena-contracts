import hre, { ethers } from "hardhat";
import { toRay } from "../../test/helpers/utils/poolRayMath";
import { getNetworkAddresses } from "./addresses";
import { BigNumberish } from "ethers";
import { amphorStrategyParams } from "./deployParams";

const addresses = getNetworkAddresses();

function fromFork() {
  const forkTarget = process.env.HARDHAT_FORK_TARGET?.toLowerCase();

  if (!forkTarget) {
    throw Error("Missing or erroneous fork target");
  }

  return forkTarget;
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
  // Mainnet
  G: {
    feeRate: toRay(0), // 0%
    uOptimal: toRay(85),
    r0: toRay(0.26),
    rSlope1: toRay(0.69),
    rSlope2: toRay(2.02),
  },
  H: {
    feeRate: toRay(0), // 0%
    uOptimal: toRay(75),
    r0: toRay(0.42),
    rSlope1: toRay(0.78),
    rSlope2: toRay(1.91),
  },
};

const protocolNames = [
  "Eigen layer", // Restaking layer
  "Pendle", // Liquid yield
  "Renzo", // LRT
  "Ether.fi", // LRT
  "Amphor", // Asset manager
  "Kelp DAO", // LRT
  "Puffer Finance", // LRT
  "Karak", // Restaking operator with any token
  "Zircuit", // L2 + LRT boost on bridge
  "Mellow", // LRT creation + manage operator & AVS users of LRT
  "Symbiotic", // Restaking Operator Source
  "Curve", // AMM for tokens with similar value
  "Compound", // Lending
  "Balancer", // AMM for multi token pools
  //
  "Eigen + Pendle + Ether.fi + Zircuit",
  "Eigen + Pendle + Ether.fi + Karak",
  "Eigen + Pendle + Kelp DAO + Zircuit",
  "Eigen + Pendle + Renzo + Zircuit",
  //
  "Ethena USDe", // ETH backed stablecoin
  "Liquity LUSD", // ETH backed stablecoin
  "crvUSD", // Token backed stablecoin
  "USDT", // RWA backed stablecoin
  "Angle USDa", // DeFi backed stablecoin
  //
  "Amphor Restaked ETH",
  "Amphor Symbiotic LRT Vault",
  //
  // "Spectra", // Bitcoin L2
  // "Equilibria", // Pendle wrapper/booster
  // "Dai", // Token backed stablecoin
  // "AAVE GHO", // AAVE backed stablecoin
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
  [chainName: string]: { [coverName in ProtocolName]?: PoolParams };
} = {
  mainnet: {
    "Amphor Restaked ETH": {
      paymentAsset: amphorStrategyParams.amphrETH,
      strategyId: 1,
      incompatiblePools: ["Amphor Symbiotic LRT Vault"],
      ...formulaConfig.G,
    },
    "Amphor Symbiotic LRT Vault": {
      paymentAsset: amphorStrategyParams.amphrLRT,
      strategyId: 2,
      incompatiblePools: ["Amphor Restaked ETH"],
      ...formulaConfig.H,
    },
  },
  arbitrum: {
    //=========//
    //=== A ===//
    //=========//
    "Eigen layer": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Eigen + Pendle + Ether.fi + Zircuit",
        "Eigen + Pendle + Ether.fi + Karak",
        "Eigen + Pendle + Kelp DAO + Zircuit",
        "Eigen + Pendle + Renzo + Zircuit",
      ],
      ...formulaConfig.A,
    },
    "Pendle": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Eigen + Pendle + Kelp DAO + Zircuit",
        "Eigen + Pendle + Renzo + Zircuit",
        "Eigen + Pendle + Ether.fi + Zircuit",
        "Eigen + Pendle + Ether.fi + Karak",
      ],
      ...formulaConfig.A,
    },
    "Renzo": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: ["Eigen + Pendle + Renzo + Zircuit"],
      ...formulaConfig.A,
    },
    "Ether.fi": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Eigen + Pendle + Ether.fi + Zircuit",
        "Eigen + Pendle + Ether.fi + Karak",
      ],
      ...formulaConfig.A,
    },
    "Amphor": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.A,
    },
    // "Spectra": {
    //   paymentAsset: addresses.CircleToken,
    //   strategyId: 0,
    //   incompatiblePools: [],
    //   ...formulaConfig.A,
    // },
    // "Equilibria": {
    //   paymentAsset: addresses.CircleToken,
    //   strategyId: 0,
    //   incompatiblePools: [],
    //   ...formulaConfig.A,
    // },
    "Kelp DAO": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: ["Eigen + Pendle + Kelp DAO + Zircuit"],
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
      incompatiblePools: ["Eigen + Pendle + Ether.fi + Karak"],
      ...formulaConfig.A,
    },
    "Zircuit": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Eigen + Pendle + Kelp DAO + Zircuit",
        "Eigen + Pendle + Renzo + Zircuit",
        "Eigen + Pendle + Ether.fi + Zircuit",
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
    //=========//
    //=== B ===//
    //=========//
    "Eigen + Pendle + Ether.fi + Zircuit": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Eigen layer",
        "Ether.fi",
        "Zircuit",
        "Pendle",
        "Eigen + Pendle + Ether.fi + Karak",
        "Eigen + Pendle + Kelp DAO + Zircuit",
        "Eigen + Pendle + Renzo + Zircuit",
      ],
      ...formulaConfig.B,
    },
    "Eigen + Pendle + Ether.fi + Karak": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Eigen layer",
        "Ether.fi",
        "Karak",
        "Pendle",
        "Eigen + Pendle + Ether.fi + Zircuit",
        "Eigen + Pendle + Kelp DAO + Zircuit",
        "Eigen + Pendle + Renzo + Zircuit",
      ],
      ...formulaConfig.B,
    },
    "Eigen + Pendle + Kelp DAO + Zircuit": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Eigen layer",
        "Kelp DAO",
        "Zircuit",
        "Pendle",
        "Eigen + Pendle + Ether.fi + Zircuit",
        "Eigen + Pendle + Ether.fi + Karak",
        "Eigen + Pendle + Renzo + Zircuit",
      ],
      ...formulaConfig.B,
    },
    "Eigen + Pendle + Renzo + Zircuit": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [
        "Eigen layer",
        "Renzo",
        "Zircuit",
        "Pendle",
        "Eigen + Pendle + Ether.fi + Zircuit",
        "Eigen + Pendle + Ether.fi + Karak",
        "Eigen + Pendle + Kelp DAO + Zircuit",
      ],
      ...formulaConfig.B,
    },
    //=========//
    //=== C ===//
    //=========//
    "Ethena USDe": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.C,
    },
    // "Dai": {
    //   paymentAsset: addresses.CircleToken,
    //   strategyId: 0,
    //   incompatiblePools: ["USDT"],
    //   ...formulaConfig.C,
    // },
    //=========//
    //=== D ===//
    //=========//
    // "AAVE GHO": {
    //   paymentAsset: addresses.CircleToken,
    //   strategyId: 0,
    //   incompatiblePools: [],
    //   ...formulaConfig.D,
    // },
    "Liquity LUSD": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.D,
    },
    "crvUSD": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: ["Curve"],
      ...formulaConfig.D,
    },
    //=========//
    //=== E ===//
    //=========//
    "USDT": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.E,
    },
    "Angle USDa": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: [],
      ...formulaConfig.E,
    },
    //=========//
    //=== F ===//
    //=========//
    "Curve": {
      paymentAsset: addresses.CircleToken,
      strategyId: 0,
      incompatiblePools: ["crvUSD"],
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
  name: ProtocolName;
  compatiblePools: number[];
};

function formatCompatiblePools(networkPools: {
  [coverName in ProtocolName]?: PoolParams;
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
      const hasMirror = networkPools?.[
        incompatiblePool
      ]?.incompatiblePools.includes(poolNames[i]);

      // If push to throw once all incompatible pools have been checked
      if (!hasMirror) {
        errors.push(
          `\n>> Pool ${poolNames[i]} is missing in incompatible pool list of ${incompatiblePool}`,
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
      name: poolNames[i],
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
