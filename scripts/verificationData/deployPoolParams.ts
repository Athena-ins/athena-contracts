import hre, { ethers } from "hardhat";
import { toRay } from "../../test/helpers/utils/poolRayMath";
import { fromFork } from "../../test/helpers/hardhat";
import { getNetworkAddresses } from "./addresses";
import { mainnetStrategyParams, liskStrategyParams } from "./deployParams";
// Types
import { BigNumberish, BigNumber } from "ethers";
import { NetworkName, NetworksOrFork } from "../../hardhat.config";

const addresses = getNetworkAddresses();

const formulaConfig: {
  [key: string]: {
    feeRate: BigNumber;
    uOptimal: BigNumber;
    r0: BigNumber;
    rSlope1: BigNumber;
    rSlope2: BigNumber;
  };
} = {
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
    feeRate: toRay(50), // 0%
    uOptimal: toRay(85),
    r0: toRay(0.26),
    rSlope1: toRay(0.69),
    rSlope2: toRay(2.02),
  },
  H: {
    feeRate: toRay(50), // 0%
    uOptimal: toRay(75),
    r0: toRay(0.42),
    rSlope1: toRay(0.78),
    rSlope2: toRay(1.91),
  },
  K: {
    feeRate: toRay(0),
    uOptimal: toRay(80),
    r0: toRay(0.9),
    rSlope1: toRay(1.2),
    rSlope2: toRay(2.5),
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
  "Across Bridge",
  "Oku LP",
  "Relay Bridge",
  //
  "Stake DAO USDT/crvUSD",
  "Stake DAO crvUSD/tBTC/wstETH",
  "Stake DAO crvUSD Leverage (WETH collat)",
  "Stake DAO crvUSD Leverage (wstETH collat)",
  "Stake DAO crvUSD Leverage (WBTC collat)",
  "Stake DAO crvUSD/WETH/CRV",
  "Stake DAO FRAX/crvUSD",
  "Stake DAO ETH/ETHx",
  "Stake DAO USDC/crvUSD",
  "Inception Symbiotic Restaked wstETH",
  "Stake DAO eUSD/USDC",
] as const;

// Either with strategy ID or only cover name
export type ProtocolName =
  | (typeof protocolNames)[number]
  | `${number} - ${(typeof protocolNames)[number]}`;

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
  [key in NetworkName]?: {
    [coverName in ProtocolName]?: PoolParams;
  };
} = {
  mainnet: {
    "Amphor Restaked ETH": {
      paymentAsset: mainnetStrategyParams.amphrETH,
      strategyId: 1,
      incompatiblePools: [
        "Amphor Symbiotic LRT Vault",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Stake DAO USDT/crvUSD",
        "4 - Stake DAO crvUSD/tBTC/wstETH",
        "4 - Stake DAO crvUSD Leverage (WETH collat)",
        "4 - Stake DAO crvUSD Leverage (wstETH collat)",
        "4 - Stake DAO crvUSD Leverage (WBTC collat)",
        "4 - Stake DAO crvUSD/WETH/CRV",
        "4 - Stake DAO FRAX/crvUSD",
        "4 - Stake DAO ETH/ETHx",
        "4 - Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
        "4 - Stake DAO eUSD/USDC",
      ],
      ...formulaConfig.G,
    },
    "Amphor Symbiotic LRT Vault": {
      paymentAsset: mainnetStrategyParams.amphrLRT,
      strategyId: 2,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Stake DAO USDT/crvUSD",
        "4 - Stake DAO crvUSD/tBTC/wstETH",
        "4 - Stake DAO crvUSD Leverage (WETH collat)",
        "4 - Stake DAO crvUSD Leverage (wstETH collat)",
        "4 - Stake DAO crvUSD Leverage (WBTC collat)",
        "4 - Stake DAO crvUSD/WETH/CRV",
        "4 - Stake DAO FRAX/crvUSD",
        "4 - Stake DAO ETH/ETHx",
        "4 - Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
        "4 - Stake DAO eUSD/USDC",
      ],
      ...formulaConfig.H,
    },
    //=== K ===//
    "Stake DAO USDT/crvUSD": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 3,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "4 - Stake DAO USDT/crvUSD",
        "4 - Stake DAO crvUSD/tBTC/wstETH",
        "4 - Stake DAO crvUSD Leverage (WETH collat)",
        "4 - Stake DAO crvUSD Leverage (wstETH collat)",
        "4 - Stake DAO crvUSD Leverage (WBTC collat)",
        "4 - Stake DAO crvUSD/WETH/CRV",
        "4 - Stake DAO FRAX/crvUSD",
        "4 - Stake DAO ETH/ETHx",
        "4 - Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
        "4 - Stake DAO eUSD/USDC",
      ],
      ...formulaConfig.K,
    },
    "Stake DAO crvUSD/tBTC/wstETH": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 3,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "4 - Stake DAO USDT/crvUSD",
        "4 - Stake DAO crvUSD/tBTC/wstETH",
        "4 - Stake DAO crvUSD Leverage (WETH collat)",
        "4 - Stake DAO crvUSD Leverage (wstETH collat)",
        "4 - Stake DAO crvUSD Leverage (WBTC collat)",
        "4 - Stake DAO crvUSD/WETH/CRV",
        "4 - Stake DAO FRAX/crvUSD",
        "4 - Stake DAO ETH/ETHx",
        "4 - Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
        "4 - Stake DAO eUSD/USDC",
      ],
      ...formulaConfig.K,
    },
    "Stake DAO crvUSD Leverage (WETH collat)": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 3,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "4 - Stake DAO USDT/crvUSD",
        "4 - Stake DAO crvUSD/tBTC/wstETH",
        "4 - Stake DAO crvUSD Leverage (WETH collat)",
        "4 - Stake DAO crvUSD Leverage (wstETH collat)",
        "4 - Stake DAO crvUSD Leverage (WBTC collat)",
        "4 - Stake DAO crvUSD/WETH/CRV",
        "4 - Stake DAO FRAX/crvUSD",
        "4 - Stake DAO ETH/ETHx",
        "4 - Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
        "4 - Stake DAO eUSD/USDC",
      ],
      ...formulaConfig.K,
    },
    "Stake DAO crvUSD Leverage (wstETH collat)": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 3,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "4 - Stake DAO USDT/crvUSD",
        "4 - Stake DAO crvUSD/tBTC/wstETH",
        "4 - Stake DAO crvUSD Leverage (WETH collat)",
        "4 - Stake DAO crvUSD Leverage (wstETH collat)",
        "4 - Stake DAO crvUSD Leverage (WBTC collat)",
        "4 - Stake DAO crvUSD/WETH/CRV",
        "4 - Stake DAO FRAX/crvUSD",
        "4 - Stake DAO ETH/ETHx",
        "4 - Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
        "4 - Stake DAO eUSD/USDC",
      ],
      ...formulaConfig.K,
    },
    "Stake DAO crvUSD Leverage (WBTC collat)": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 3,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "4 - Stake DAO USDT/crvUSD",
        "4 - Stake DAO crvUSD/tBTC/wstETH",
        "4 - Stake DAO crvUSD Leverage (WETH collat)",
        "4 - Stake DAO crvUSD Leverage (wstETH collat)",
        "4 - Stake DAO crvUSD Leverage (WBTC collat)",
        "4 - Stake DAO crvUSD/WETH/CRV",
        "4 - Stake DAO FRAX/crvUSD",
        "4 - Stake DAO ETH/ETHx",
        "4 - Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
        "4 - Stake DAO eUSD/USDC",
      ],
      ...formulaConfig.K,
    },
    "Stake DAO crvUSD/WETH/CRV": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 3,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "4 - Stake DAO USDT/crvUSD",
        "4 - Stake DAO crvUSD/tBTC/wstETH",
        "4 - Stake DAO crvUSD Leverage (WETH collat)",
        "4 - Stake DAO crvUSD Leverage (wstETH collat)",
        "4 - Stake DAO crvUSD Leverage (WBTC collat)",
        "4 - Stake DAO crvUSD/WETH/CRV",
        "4 - Stake DAO FRAX/crvUSD",
        "4 - Stake DAO ETH/ETHx",
        "4 - Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
        "4 - Stake DAO eUSD/USDC",
      ],
      ...formulaConfig.K,
    },
    "Stake DAO FRAX/crvUSD": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 3,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "4 - Stake DAO USDT/crvUSD",
        "4 - Stake DAO crvUSD/tBTC/wstETH",
        "4 - Stake DAO crvUSD Leverage (WETH collat)",
        "4 - Stake DAO crvUSD Leverage (wstETH collat)",
        "4 - Stake DAO crvUSD Leverage (WBTC collat)",
        "4 - Stake DAO crvUSD/WETH/CRV",
        "4 - Stake DAO FRAX/crvUSD",
        "4 - Stake DAO ETH/ETHx",
        "4 - Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
        "4 - Stake DAO eUSD/USDC",
      ],
      ...formulaConfig.K,
    },
    "Stake DAO ETH/ETHx": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 3,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "4 - Stake DAO USDT/crvUSD",
        "4 - Stake DAO crvUSD/tBTC/wstETH",
        "4 - Stake DAO crvUSD Leverage (WETH collat)",
        "4 - Stake DAO crvUSD Leverage (wstETH collat)",
        "4 - Stake DAO crvUSD Leverage (WBTC collat)",
        "4 - Stake DAO crvUSD/WETH/CRV",
        "4 - Stake DAO FRAX/crvUSD",
        "4 - Stake DAO ETH/ETHx",
        "4 - Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
        "4 - Stake DAO eUSD/USDC",
      ],
      ...formulaConfig.K,
    },
    "Stake DAO USDC/crvUSD": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 3,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "4 - Stake DAO USDT/crvUSD",
        "4 - Stake DAO crvUSD/tBTC/wstETH",
        "4 - Stake DAO crvUSD Leverage (WETH collat)",
        "4 - Stake DAO crvUSD Leverage (wstETH collat)",
        "4 - Stake DAO crvUSD Leverage (WBTC collat)",
        "4 - Stake DAO crvUSD/WETH/CRV",
        "4 - Stake DAO FRAX/crvUSD",
        "4 - Stake DAO ETH/ETHx",
        "4 - Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
        "4 - Stake DAO eUSD/USDC",
      ],
      ...formulaConfig.K,
    },
    // ======= STRATEGY 4 REDEPLOYMENT ====== //
    "4 - Stake DAO USDT/crvUSD": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 4,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
      ],
      ...formulaConfig.K,
    },
    "4 - Stake DAO crvUSD/tBTC/wstETH": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 4,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
      ],
      ...formulaConfig.K,
    },
    "4 - Stake DAO crvUSD Leverage (WETH collat)": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 4,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
      ],
      ...formulaConfig.K,
    },
    "4 - Stake DAO crvUSD Leverage (wstETH collat)": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 4,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
      ],
      ...formulaConfig.K,
    },
    "4 - Stake DAO crvUSD Leverage (WBTC collat)": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 4,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
      ],
      ...formulaConfig.K,
    },
    "4 - Stake DAO crvUSD/WETH/CRV": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 4,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
      ],
      ...formulaConfig.K,
    },
    "4 - Stake DAO FRAX/crvUSD": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 4,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
      ],
      ...formulaConfig.K,
    },
    "4 - Stake DAO ETH/ETHx": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 4,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
      ],
      ...formulaConfig.K,
    },
    "4 - Stake DAO USDC/crvUSD": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 4,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
      ],
      ...formulaConfig.K,
    },
    "4 - Inception Symbiotic Restaked wstETH": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 4,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Stake DAO USDT/crvUSD",
        "4 - Stake DAO crvUSD/tBTC/wstETH",
        "4 - Stake DAO crvUSD Leverage (WETH collat)",
        "4 - Stake DAO crvUSD Leverage (wstETH collat)",
        "4 - Stake DAO crvUSD Leverage (WBTC collat)",
        "4 - Stake DAO crvUSD/WETH/CRV",
        "4 - Stake DAO FRAX/crvUSD",
        "4 - Stake DAO ETH/ETHx",
        "4 - Stake DAO USDC/crvUSD",
        "4 - Stake DAO eUSD/USDC",
      ],
      ...formulaConfig.K,
    },
    "4 - Stake DAO eUSD/USDC": {
      paymentAsset: mainnetStrategyParams.weth,
      strategyId: 4,
      incompatiblePools: [
        "Amphor Restaked ETH",
        "Amphor Symbiotic LRT Vault",
        "Stake DAO USDT/crvUSD",
        "Stake DAO crvUSD/tBTC/wstETH",
        "Stake DAO crvUSD Leverage (WETH collat)",
        "Stake DAO crvUSD Leverage (wstETH collat)",
        "Stake DAO crvUSD Leverage (WBTC collat)",
        "Stake DAO crvUSD/WETH/CRV",
        "Stake DAO FRAX/crvUSD",
        "Stake DAO ETH/ETHx",
        "Stake DAO USDC/crvUSD",
        "4 - Inception Symbiotic Restaked wstETH",
      ],
      ...formulaConfig.K,
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
  lisk_sepolia: {
    "Across Bridge": {
      paymentAsset: liskStrategyParams.usdt,
      strategyId: 1,
      incompatiblePools: ["Oku LP"],
      ...formulaConfig.G,
    },
    "Oku LP": {
      paymentAsset: liskStrategyParams.usdt,
      strategyId: 1,
      incompatiblePools: ["Across Bridge"],
      ...formulaConfig.H,
    },
    "Relay Bridge": {
      paymentAsset: liskStrategyParams.usdt,
      strategyId: 1,
      incompatiblePools: [],
      ...formulaConfig.A,
    },
  },
};

type FormattedPoolParams = PoolParams & {
  name: ProtocolName;
  compatiblePools: number[];
};

function formatCompatiblePools(networkPools: {
  [key in ProtocolName]?: PoolParams;
}): FormattedPoolParams[] {
  const networkPoolEntries = Object.entries(networkPools) as [
    ProtocolName,
    PoolParams,
  ][];

  const nbPools = networkPoolEntries.length;
  const allPoolIds = Array.from({ length: nbPools }, (_, i) => i);

  const errors = [];
  // For each pool
  for (const poolEntry of networkPoolEntries) {
    const name = poolEntry[0];
    const pool = poolEntry[1];

    // Check each incompatible pool
    for (const incompatiblePool of pool.incompatiblePools) {
      // If there is no entry for the incompatible pool then it can be skipped
      if (!networkPools[incompatiblePool]) {
        console.log(
          `\n>> WARN Must update pool "${incompatiblePool}" with new incompatible pool "${name}"`,
        );
        continue;
      }

      // To see if the other pool has the current pool as incompatible
      const hasMirror =
        networkPools?.[incompatiblePool]?.incompatiblePools.includes(name);

      // If push to throw once all incompatible pools have been checked
      if (!hasMirror) {
        errors.push(
          `\n>> Pool "${name}" is missing in incompatible pool list of "${incompatiblePool}"`,
        );
      }
    }
  }

  if (errors.length) throw new Error(errors.join("\n"));

  return networkPoolEntries.map((poolEntry, i) => {
    const name = poolEntry[0];
    const pool = poolEntry[1];

    const compatiblePools = allPoolIds
      // Remove own pool
      .filter((id) => id !== i)
      // Remove incompatible pools
      .filter((id) => {
        const incompatiblePoolName = networkPoolEntries[id][0];
        return !pool.incompatiblePools.includes(incompatiblePoolName);
      })
      // Remove any ID greater than the current on to avoid redundant registration
      .filter((id) => id < i);

    return {
      ...pool,
      name,
      compatiblePools,
    };
  });
}

export function getDeployPoolConfig(): FormattedPoolParams[] {
  const networkName = hre.network.name as NetworksOrFork;
  const forkedNetworkName = networkName === "hardhat" ? fromFork() : "";
  const config =
    networkName === "hardhat"
      ? deployParams[fromFork() as NetworkName]
      : deployParams[networkName];

  if (!config)
    throw Error(
      `Missing pool config for network ${forkedNetworkName || networkName}`,
    );

  return formatCompatiblePools(config);
}
