import { BigNumberish } from "ethers";
import fs from "fs";
import { toRay } from "../../test/helpers/utils/poolRayMath";

type PoolName = (typeof protocolList)[number];

const mevPools: PoolName[] = [
  "Stake DAO USDT/crvUSD",
  "Stake DAO crvUSD/tBTC/wstETH", // index 15
  "Stake DAO crvUSD Leverage (WETH collat)",
  "Stake DAO crvUSD Leverage (wstETH collat)",
  "Stake DAO crvUSD Leverage (WBTC collat)", // index 20
  "Stake DAO crvUSD/WETH/CRV",
  "Stake DAO FRAX/crvUSD",
  "Stake DAO ETH/ETHx",
  "Stake DAO USDC/crvUSD",
];

const firstWave: PoolName[] = [
  "Stake DAO MIM/DAI/USDC/USDT",
  "Stake DAO CRV/sdCRV",
  "Stake DAO WETH/pxETH",
  "Stake DAO STG/USDC",
  "Stake DAO CRV/cvxCRV",
  "Stake DAO WETH/SDT",
  "Stake DAO DOLA/FRAX/PYUSD",
  "Stake DAO USR/RLP",
  "Stake DAO pxETH/stETH",
  "Stake DAO eUSD/USDC",
  "Stake DAO USDT/crvUSD",
  "Stake DAO crvUSD/tBTC/wstETH",
  "Stake DAO crvUSD Leverage (WETH collat)",
  "Stake DAO crvUSD Leverage (wstETH collat)",
  "Stake DAO alETH/pxETH",
  "Stake DAO crvUSD Leverage (WBTC collat)",
  "Stake DAO crvUSD/WETH/CRV",
  "Stake DAO FRAX/crvUSD",
  "Stake DAO ETH/ETHx",
  "Stake DAO Passive Aave USD",
  "Stake DAO CRV/vsdCRV/asdCRV v2.1",
  "Stake DAO USDC/crvUSD",
  "Stake DAO XAI/FRAX/USDC",
  "Stake DAO USDT/aUSD₮",
];

const protocolList = [
  "Stake DAO MIM/DAI/USDC/USDT", // index 0
  "Stake DAO uniBTC (Pendle)",
  "Stake DAO CRV/sdCRV",
  "Stake DAO WETH/pxETH",
  "Stake DAO wstETH (Pendle)",
  "Stake DAO STG/USDC", // index 5
  "Stake DAO CRV/cvxCRV",
  "Stake DAO WETH/SDT",
  "Stake DAO DOLA/FRAX/PYUSD",
  "Stake DAO USR/RLP",
  "Stake DAO pxETH/stETH", // index 10
  "Stake DAO WETH (Yearn)",
  "Stake DAO syrupUSDC (Pendle)",
  "Stake DAO eUSD/USDC",
  "Stake DAO USDT/crvUSD",
  "Stake DAO crvUSD/tBTC/wstETH", // index 15
  "Stake DAO crvUSD Leverage (WETH collat)",
  "Stake DAO CRV/yCRV (Yearn)",
  "Stake DAO crvUSD Leverage (wstETH collat)",
  "Stake DAO alETH/pxETH",
  "Stake DAO crvUSD Leverage (WBTC collat)", // index 20
  "Stake DAO crvUSD/WETH/CRV",
  "Stake DAO veSDT (vsdCRV) (StakeDAO)",
  "Stake DAO YFI/sdYFI (Yearn)",
  "Stake DAO FRAX/crvUSD",
  "Stake DAO slisBNB/WBNB (Pancake)", // index 25
  "Stake DAO ETH/ETHx",
  "Stake DAO Passive Aave USD",
  "Stake DAO CRV/vsdCRV/asdCRV v2.1",
  "Stake DAO USDC/crvUSD",
  "Stake DAO crvUSD (tBTC collat)", // index 30
  "Stake DAO USDS (pendle)",
  "Stake DAO XAI/FRAX/USDC",
  "Stake DAO USDT/aUSD₮",
  "Stake DAO crvUSD Leverage (USDe collat)",
  "Stake DAO weETH (pendle)", // index 35
  "Stake DAO WETH/YFI (Yearn)",
  "Stake DAO WETH/yETH (Yearn)",
  "Stake DAO eBTC (pendle)",
  "Stake DAO USDe/USDx",
  "Stake DAO Passive sEUR", // index 40
  "Stake DAO rETH/WETH v3 (Pancake)",
  "Stake DAO thUSD/crvUSD",
  "Stake DAO zunETH/pxETH",
  "Stake DAO pxETH/WETH v3 (Pancake)",
  "Stake DAO alUSD/FRAX/USDC", // index 45
  "Stake DAO sfrxETH (pendle)",
  "Stake DAO SDT/cvgSDT",
  "Stake DAO crvUSD Leverage (sUSDe collat)",
  "Stake DAO lisUSD/USDT (Stable) (Pancake)",
  "Stake DAO ezETH (pendle)", // index 50
  "Stake DAO B-80BAL-20WETH/sdBal (Balancer)",
  "Stake DAO CVX1/cvgCVX",
] as const;

const incompatibilities: {
  [key in PoolName]: number[];
} = {
  "Stake DAO MIM/DAI/USDC/USDT": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO uniBTC (Pendle)": [1, 4, 12, 31, 35, 38, 46, 50],
  "Stake DAO CRV/sdCRV": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO WETH/pxETH": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO wstETH (Pendle)": [1, 4, 12, 31, 35, 38, 46, 50],
  "Stake DAO STG/USDC": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO CRV/cvxCRV": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO WETH/SDT": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO DOLA/FRAX/PYUSD": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO USR/RLP": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO pxETH/stETH": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO WETH (Yearn)": [11, 17, 23, 36, 37],
  "Stake DAO syrupUSDC (Pendle)": [1, 4, 12, 31, 35, 38, 46, 50],
  "Stake DAO eUSD/USDC": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO USDT/crvUSD": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO crvUSD/tBTC/wstETH": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO crvUSD Leverage (WETH collat)": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO CRV/yCRV (Yearn)": [11, 17, 23, 36, 37],
  "Stake DAO crvUSD Leverage (wstETH collat)": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO alETH/pxETH": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO crvUSD Leverage (WBTC collat)": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO crvUSD/WETH/CRV": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO veSDT (vsdCRV) (StakeDAO)": [22],
  "Stake DAO YFI/sdYFI (Yearn)": [11, 17, 23, 36, 37],
  "Stake DAO FRAX/crvUSD": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO slisBNB/WBNB (Pancake)": [25, 41, 44, 49],
  "Stake DAO ETH/ETHx": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO Passive Aave USD": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO CRV/vsdCRV/asdCRV v2.1": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO USDC/crvUSD": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO crvUSD (tBTC collat)": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO USDS (pendle)": [1, 4, 12, 31, 35, 38, 46, 50],
  "Stake DAO XAI/FRAX/USDC": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO USDT/aUSD₮": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO crvUSD Leverage (USDe collat)": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO weETH (pendle)": [1, 4, 12, 31, 35, 38, 46, 50],
  "Stake DAO WETH/YFI (Yearn)": [11, 17, 23, 36, 37],
  "Stake DAO WETH/yETH (Yearn)": [11, 17, 23, 36, 37],
  "Stake DAO eBTC (pendle)": [1, 4, 12, 31, 35, 38, 46, 50],
  "Stake DAO USDe/USDx": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO Passive sEUR": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO rETH/WETH v3 (Pancake)": [25, 41, 44, 49],
  "Stake DAO thUSD/crvUSD": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO zunETH/pxETH": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO pxETH/WETH v3 (Pancake)": [25, 41, 44, 49],
  "Stake DAO alUSD/FRAX/USDC": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO sfrxETH (pendle)": [1, 4, 12, 31, 35, 38, 46, 50],
  "Stake DAO SDT/cvgSDT": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO crvUSD Leverage (sUSDe collat)": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO lisUSD/USDT (Stable) (Pancake)": [25, 41, 44, 49],
  "Stake DAO ezETH (pendle)": [1, 4, 12, 31, 35, 38, 46, 50],
  "Stake DAO B-80BAL-20WETH/sdBal (Balancer)": [51],
  "Stake DAO CVX1/cvgCVX": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
};

function validateAndCleanCompatibility() {
  const cleanedIncompatibilities: Record<string, number[]> = {};
  const incompatibilitieNames: Record<string, string[]> = {};
  const issues: string[] = [];

  // Clean and add self-incompatibility
  for (const [protocol, incompatibleList] of Object.entries(
    incompatibilities,
  )) {
    const protocolIndex = protocolList.indexOf(protocol as PoolName);
    if (protocolIndex === -1) {
      issues.push(`Protocol not found in list: ${protocol}`);
      continue;
    }

    // Remove duplicates and add self
    const cleanedList = Array.from(
      new Set([...incompatibleList, protocolIndex]),
    )
      .sort((a, b) => a - b)
      .filter((index) => index !== null);
    cleanedIncompatibilities[protocol] = cleanedList;
  }

  for (const [protocol, incompatibleList] of Object.entries(
    incompatibilities,
  )) {
    // Find duplicates by comparing sorted array to Set
    const duplicates = incompatibleList.filter(
      (item, index) => incompatibleList.indexOf(item) !== index,
    );

    if (duplicates.length > 0) {
      console.log(`\nDuplicates found in ${protocol}:`);
      console.log("Duplicate indices:", duplicates);
    }
  }

  // Verify symmetry
  for (const [protocol, incompatibleList] of Object.entries(
    cleanedIncompatibilities,
  )) {
    const protocolIndex = protocolList.indexOf(protocol as PoolName);

    for (const incompatibleIndex of incompatibleList) {
      const incompatibleProtocol = protocolList[incompatibleIndex];
      const reverseList = cleanedIncompatibilities[incompatibleProtocol];

      if (!reverseList) {
        issues.push(
          `Missing incompatibility list for: ${incompatibleProtocol}`,
        );
        continue;
      }

      if (!reverseList.includes(protocolIndex)) {
        issues.push(
          `Asymmetric incompatibility: ${protocol} -> ${incompatibleProtocol} but not vice versa`,
        );
      }
    }
  }

  // Replace with names
  for (const [protocol, incompatibleList] of Object.entries(
    cleanedIncompatibilities,
  )) {
    incompatibilitieNames[protocol] = incompatibleList.map(
      (index) => protocolList[index],
    );
  }

  // Asset compatibility analysis
  const assetGroups = {
    ethRelated: protocolList.filter(
      (p) =>
        p.includes("ETH") ||
        p.includes("stETH") ||
        p.includes("ezETH") ||
        p.includes("weETH"),
    ),
    stablecoins: protocolList.filter(
      (p) =>
        p.includes("USD") ||
        p.includes("DAI") ||
        p.includes("USDT") ||
        p.includes("USDC") ||
        p.includes("FRAX") ||
        p.includes("MIM"),
    ),
    btcRelated: protocolList.filter(
      (p) => p.includes("BTC") || p.includes("tBTC"),
    ),
    crv: protocolList.filter((p) => p.includes("CRV") || p.includes("cvx")),
  };

  // Check for potential missed asset incompatibilities
  // for (const [groupName, groupProtocols] of Object.entries(assetGroups)) {
  //   for (const protocol1 of groupProtocols) {
  //     for (const protocol2 of groupProtocols) {
  //       if (protocol1 !== protocol2) {
  //         const idx1 = protocolList.indexOf(protocol1);
  //         const idx2 = protocolList.indexOf(protocol2);
  //         if (!cleanedIncompatibilities[protocol1]?.includes(idx2)) {
  //           issues.push(
  //             `Potential missed ${groupName} incompatibility: ${protocol1} and ${protocol2} share asset risk`,
  //           );
  //         }
  //       }
  //     }
  //   }
  // }

  return {
    incompatibilitieNames,
    issues,
    assetGroups,
  };
}

// Run validation
function runValidation() {
  const result = validateAndCleanCompatibility();
// Report findings
  console.log("Validation Issues:", result.issues);
  console.log("\nAsset Groups Statistics:");
  for (const [group, protocols] of Object.entries(result.assetGroups)) {
    console.log(`${group}: ${protocols.length} protocols`);
  }
}

type PoolConfig = {
  name: PoolName;
  paymentAsset: string;
  strategyId: BigNumberish;
  incompatiblePools: number[];
  compatiblePools: number[];
};

function generatePoolsFile(poolNames: PoolName[]) {
  const paymentAsset = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH
  const strategyId = 3; // Morpho MEV Vault

  const existingPools = ["Amphor Restaked ETH", "Amphor Symbiotic LRT Vault"];
  const allPools = [...existingPools, ...poolNames];

  let deployConfig: {
    [key in PoolName]?: PoolConfig;
  } = {};

  for (const protocol of poolNames) {
    // Maps incompatible IDs to names & remove pools not included in deployment
    const incompatibleNames = incompatibilities[protocol]
      .map((id) => protocolList[id])
      .filter((pool) => poolNames.includes(pool));

    // Add existing pools to incompatible names
    const fullIncompatibleNames = [...existingPools, ...incompatibleNames];

    // Maps incompatible names to IDs
    const incompatiblePools = fullIncompatibleNames.map((pool) => {
      const id = allPools.indexOf(pool);
      if (id === -1) throw Error("Did not find ID");
      return id;
    });
    // Infer compatible pools from incompatible pools
    const compatiblePools = Array.from({ length: allPools.length }, (_, i) =>
      incompatiblePools.includes(i) ? -1 : i,
    ).filter((id) => id !== -1);

    deployConfig[protocol] = {
      name: protocol,
      paymentAsset,
      strategyId,
      incompatiblePools,
      compatiblePools,
    };
  }

  fs.writeFileSync(
    "./scripts/pools/pools.json",
    JSON.stringify(deployConfig, null, 2),
  );
}

runValidation();
generatePoolsFile(mevPools);
