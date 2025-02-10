import { ethers } from "hardhat";
import { getDeployPoolConfig } from "../verificationData/deployPoolParams";
//
import { LiquidityManager } from "../../typechain";

export async function checkPoolCompatibility(
  liquidityManager: LiquidityManager,
) {
  const pools = getDeployPoolConfig();

  const updates: {
    poolIds: number[];
    poolIdCompatible: number[][];
    poolIdCompatibleStatus: boolean[][];
  } = {
    poolIds: [],
    poolIdCompatible: [],
    poolIdCompatibleStatus: [],
  };

  const compatibilityChecks = [];
  for (let i = 0; i < pools.length; i++) {
    const checksForPoolI = [];
    for (let j = i + 1; j < pools.length; j++) {
      checksForPoolI.push({
        poolId: i,
        otherPoolId: j,
        shouldBeCompatible: !pools[i].incompatiblePools.includes(pools[j].name),
        compatibilityCheck: liquidityManager.arePoolCompatible(i, j), // Already using smallest ID first
      });
    }
    if (checksForPoolI.length > 0) {
      compatibilityChecks.push(
        Promise.all(
          checksForPoolI.map(async (check) => ({
            ...check,
            isCompatibleOnChain: await check.compatibilityCheck,
          })),
        ),
      );
    }
  }

  const results = await Promise.all(compatibilityChecks);

  results.forEach((poolChecks) => {
    const updatesForPool = poolChecks.filter(
      (check) => check.shouldBeCompatible !== check.isCompatibleOnChain,
    );

    if (updatesForPool.length > 0) {
      updates.poolIds.push(updatesForPool[0].poolId);
      updates.poolIdCompatible.push(updatesForPool.map((u) => u.otherPoolId));
      updates.poolIdCompatibleStatus.push(
        updatesForPool.map((u) => u.shouldBeCompatible),
      );
    }
  });

  return updates;
}
