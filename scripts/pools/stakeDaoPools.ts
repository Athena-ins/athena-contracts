const firstWave = [
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

const protocols = [
  "Stake DAO MIM/DAI/USDC/USDT",
  "Stake DAO uniBTC (Pendle)",
  "Stake DAO CRV/sdCRV",
  "Stake DAO WETH/pxETH",
  "Stake DAO wstETH (Pendle)",
  "Stake DAO STG/USDC",
  "Stake DAO CRV/cvxCRV",
  "Stake DAO WETH/SDT",
  "Stake DAO DOLA/FRAX/PYUSD",
  "Stake DAO USR/RLP",
  "Stake DAO pxETH/stETH",
  "Stake DAO WETH (Yearn)",
  "Stake DAO syrupUSDC (Pendle)",
  "Stake DAO eUSD/USDC",
  "Stake DAO USDT/crvUSD",
  "Stake DAO crvUSD/tBTC/wstETH",
  "Stake DAO crvUSD Leverage (WETH collat)",
  "Stake DAO CRV/yCRV (Yearn)",
  "Stake DAO crvUSD Leverage (wstETH collat)",
  "Stake DAO alETH/pxETH",
  "Stake DAO crvUSD Leverage (WBTC collat)",
  "Stake DAO crvUSD/WETH/CRV",
  "Stake DAO veSDT (vsdCRV) (StakeDAO)",
  "Stake DAO YFI/sdYFI (Yearn)",
  "Stake DAO FRAX/crvUSD",
  "Stake DAO slisBNB/WBNB (Pancake)",
  "Stake DAO ETH/ETHx",
  "Stake DAO Passive Aave USD",
  "Stake DAO CRV/vsdCRV/asdCRV v2.1",
  "Stake DAO USDC/crvUSD",
  "Stake DAO crvUSD (tBTC collat)",
  "Stake DAO XAI/FRAX/USDC",
  "Stake DAO USDT/aUSD₮",
  "Stake DAO crvUSD Leverage (USDe collat)",
  "Stake DAO WETH/YFI (Yearn)",
  "Stake DAO WETH/yETH (Yearn)",
  "Stake DAO USDe/USDx",
  "Stake DAO Passive sEUR",
  "Stake DAO rETH/WETH v3 (Pancake)",
  "Stake DAO thUSD/crvUSD",
  "Stake DAO zunETH/pxETH",
  "Stake DAO pxETH/WETH v3 (Pancake)",
  "Stake DAO alUSD/FRAX/USDC",
  "Stake DAO SDT/cvgSDT",
  "Stake DAO crvUSD Leverage (sUSDe collat)",
  "Stake DAO lisUSD/USDT (Stable) (Pancake)",
  "Stake DAO B-80BAL-20WETH/sdBal (Balancer)",
  "Stake DAO CVX1/cvgCVX",
];

const incompatibilities = {
  "Stake DAO MIM/DAI/USDC/USDT": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO uniBTC (Pendle)": [1, 2, 4, 12, 31, 35, 38, 46, 50],
  "Stake DAO CRV/sdCRV": [
    0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27,
    28, 29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
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
  "Stake DAO WETH/YFI (Yearn)": [11, 17, 23, 36, 37],
  "Stake DAO WETH/yETH (Yearn)": [11, 17, 23, 36, 37],
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
  "Stake DAO SDT/cvgSDT": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO crvUSD Leverage (sUSDe collat)": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
  "Stake DAO lisUSD/USDT (Stable) (Pancake)": [25, 41, 44, 49],
  "Stake DAO B-80BAL-20WETH/sdBal (Balancer)": [51],
  "Stake DAO CVX1/cvgCVX": [
    0, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 24, 26, 27, 28,
    29, 30, 32, 33, 34, 39, 40, 42, 43, 45, 47, 48, 52,
  ],
};

function validateAndCleanCompatibility() {
  const cleanedIncompatibilities: Record<string, number[]> = {};
  const issues: string[] = [];

  // Clean and add self-incompatibility
  for (const [protocol, incompatibleList] of Object.entries(
    incompatibilities,
  )) {
    const protocolIndex = protocols.indexOf(protocol);
    if (protocolIndex === -1) {
      issues.push(`Protocol not found in list: ${protocol}`);
      continue;
    }

    // Remove duplicates and add self
    const cleanedList = Array.from(
      new Set([...incompatibleList, protocolIndex]),
    ).sort((a, b) => a - b);
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
    const protocolIndex = protocols.indexOf(protocol);

    for (const incompatibleIndex of incompatibleList) {
      const incompatibleProtocol = protocols[incompatibleIndex];
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

  // Asset compatibility analysis
  const assetGroups = {
    ethRelated: protocols.filter(
      (p) =>
        p.includes("ETH") ||
        p.includes("stETH") ||
        p.includes("ezETH") ||
        p.includes("weETH"),
    ),
    stablecoins: protocols.filter(
      (p) =>
        p.includes("USD") ||
        p.includes("DAI") ||
        p.includes("USDT") ||
        p.includes("USDC") ||
        p.includes("FRAX") ||
        p.includes("MIM"),
    ),
    btcRelated: protocols.filter(
      (p) => p.includes("BTC") || p.includes("tBTC"),
    ),
    crv: protocols.filter((p) => p.includes("CRV") || p.includes("cvx")),
  };

  // Check for potential missed asset incompatibilities
  // for (const [groupName, groupProtocols] of Object.entries(assetGroups)) {
  //   for (const protocol1 of groupProtocols) {
  //     for (const protocol2 of groupProtocols) {
  //       if (protocol1 !== protocol2) {
  //         const idx1 = protocols.indexOf(protocol1);
  //         const idx2 = protocols.indexOf(protocol2);
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
    cleanedIncompatibilities,
    issues,
    assetGroups,
  };
}

// Run validation
const result = validateAndCleanCompatibility();
// console.log("result: ", result.cleanedIncompatibilities);

// Report findings
console.log("Validation Issues:", result.issues);
console.log("\nAsset Groups Statistics:");
for (const [group, protocols] of Object.entries(result.assetGroups)) {
  console.log(`${group}: ${protocols.length} protocols`);
}

// Export cleaned data
console.log("\nCleaned incompatibilities object ready for export");
