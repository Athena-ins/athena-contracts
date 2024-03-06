import {
  constants,
  toRay,
  RayInt,
  getPremiumRate,
  computeLiquidityIndex,
  getCoverRewards,
  getDailyCost,
  secondsPerTick,
  currentPremiumRate,
  updatedPremiumRate,
  utilization,
  computeReward,
  currentDailyCost,
} from "./poolRayMath";
import { deepCopy } from "../miscUtils";
// Types
import { BigNumber } from "ethers";
import {
  PoolInfoObject,
  PositionInfoObject,
  CoverInfoObject,
  ClaimInfoObject,
} from "../types";

// @bw should not make copies of the previous data but rebuild explicitely the expected data

// ========= POOLS ========= //

export function calcExpectedPoolDataAfterCreatePool(
  poolId: BigNumber,
  feeRate: BigNumber,
  uOptimal: BigNumber,
  r0: BigNumber,
  rSlope1: BigNumber,
  rSlope2: BigNumber,
  strategyId: number,
  paymentAsset: string,
  strategyTokens: { underlying: string; wrapped: string },
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
): PoolInfoObject {
  return {
    poolId: poolId.toNumber(),
    feeRate,
    formula: {
      uOptimal,
      r0,
      rSlope1,
      rSlope2,
    },
    slot0: {
      tick: 0,
      secondsPerTick: constants.MAX_SECONDS_PER_TICK.toNumber(),
      coveredCapital: BigNumber.from(0),
      remainingCovers: BigNumber.from(0),
      lastUpdateTimestamp: txTimestamp,
      liquidityIndexLead: BigNumber.from(0),
      liquidityIndex: BigNumber.from(0),
    },
    strategyId: strategyId,
    paymentAsset: paymentAsset.toLowerCase(),
    underlyingAsset: strategyTokens.underlying.toLowerCase(),
    wrappedAsset: strategyTokens.wrapped.toLowerCase(),
    isPaused: false,
    overlappedPools: [poolId.toNumber()],
    compensationIds: [],
    overlappedCapital: [BigNumber.from(0)],
    utilizationRate: BigNumber.from(0),
    totalLiquidity: BigNumber.from(0),
    availableLiquidity: BigNumber.from(0),
    strategyRewardIndex,
  };
}

export function calcExpectedPoolDataAfterOpenPosition(
  positionAmount: BigNumber,
  poolIds: number[],
  poolDataBefore: PoolInfoObject[],
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject[] {
  const expectedArray: PoolInfoObject[] = [];

  for (const pool of poolDataBefore) {
    const expect = deepCopy(pool);

    expect.strategyRewardIndex = strategyRewardIndex;

    expect.totalLiquidity = pool.totalLiquidity.add(positionAmount);
    expect.availableLiquidity = pool.availableLiquidity.add(positionAmount);
    expect.utilizationRate = utilization(
      pool.slot0.coveredCapital,
      expect.totalLiquidity,
    );

    expect.overlappedPools = [
      ...pool.overlappedPools,
      ...poolIds.filter((id) => !pool.overlappedPools.includes(id)),
    ];

    expect.overlappedCapital = expect.overlappedPools.map((id, i) => {
      const existingCapital = pool.overlappedCapital?.[i] || BigNumber.from(0);
      return poolIds.includes(id)
        ? existingCapital.add(positionAmount)
        : existingCapital;
    });

    // These value may be unpredictably changed due to covers expiring during time travel
    const timeElapsed = timestamp - pool.slot0.lastUpdateTimestamp;
    const ignoredDuration = timeElapsed % expect.slot0.secondsPerTick;

    const oldPremiumRate = getPremiumRate(pool, pool.utilizationRate);
    const newPremiumRate = getPremiumRate(pool, expect.utilizationRate);

    expect.slot0.secondsPerTick = secondsPerTick(
      pool.slot0.secondsPerTick,
      oldPremiumRate,
      newPremiumRate,
    ).toNumber();
    expect.slot0.tick = Math.floor(timeElapsed / expect.slot0.secondsPerTick);
    expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
      computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
        timeElapsed - ignoredDuration,
      ),
    );
    expect.slot0.liquidityIndexLead = computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      ignoredDuration,
    );

    if (expect.slot0.tick === pool.slot0.tick) {
      expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
    } else {
      expect.slot0.lastUpdateTimestamp = txTimestamp - ignoredDuration;
    }

    expectedArray.push(expect);
  }

  return expectedArray;
}

export function calcExpectedPoolDataAfterAddLiquidity(
  amountToAdd: BigNumber,
  poolIds: number[],
  poolDataBefore: PoolInfoObject[],
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject[] {
  const expectedArray: PoolInfoObject[] = [];

  for (const pool of poolDataBefore) {
    const expect = deepCopy(pool);

    expect.strategyRewardIndex = strategyRewardIndex;

    expect.totalLiquidity = pool.totalLiquidity.add(amountToAdd);
    expect.availableLiquidity = pool.availableLiquidity.add(amountToAdd);
    expect.utilizationRate = utilization(
      pool.slot0.coveredCapital,
      expect.totalLiquidity,
    );

    expect.overlappedCapital = pool.overlappedPools.map((id, i) => {
      const existingCapital = pool.overlappedCapital[i];
      return poolIds.includes(id)
        ? existingCapital.add(amountToAdd)
        : existingCapital;
    });

    // These value may be unpredictably changed due to covers expiring during time travel
    const timeElapsed = timestamp - pool.slot0.lastUpdateTimestamp;
    const ignoredDuration = timeElapsed % expect.slot0.secondsPerTick;

    const oldPremiumRate = getPremiumRate(pool, pool.utilizationRate);
    const newPremiumRate = getPremiumRate(pool, expect.utilizationRate);

    expect.slot0.secondsPerTick = secondsPerTick(
      pool.slot0.secondsPerTick,
      oldPremiumRate,
      newPremiumRate,
    ).toNumber();
    expect.slot0.tick = Math.floor(timeElapsed / expect.slot0.secondsPerTick);
    expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
      computeLiquidityIndex(
        expect.utilizationRate,
        newPremiumRate,
        timeElapsed - ignoredDuration,
      ),
    );
    expect.slot0.liquidityIndexLead = computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      ignoredDuration,
    );

    if (expect.slot0.tick === pool.slot0.tick) {
      expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
    } else {
      expect.slot0.lastUpdateTimestamp = txTimestamp - ignoredDuration;
    }

    expectedArray.push(expect);
  }

  return expectedArray;
}

export function calcExpectedPoolDataAfterCommitRemoveLiquidity(
  poolDataBefore: PoolInfoObject[],
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject[] {
  const expectedArray = [];

  for (const pool of poolDataBefore) {
    const expect = deepCopy(pool);

    expect.strategyRewardIndex = strategyRewardIndex;

    // These value may be unpredictably changed due to covers expiring during time travel
    const timeElapsed = timestamp - pool.slot0.lastUpdateTimestamp;
    const ignoredDuration = timeElapsed % expect.slot0.secondsPerTick;

    const oldPremiumRate = getPremiumRate(pool, pool.utilizationRate);
    const newPremiumRate = getPremiumRate(pool, expect.utilizationRate);

    expect.slot0.secondsPerTick = secondsPerTick(
      pool.slot0.secondsPerTick,
      oldPremiumRate,
      newPremiumRate,
    ).toNumber();
    expect.slot0.tick = Math.floor(timeElapsed / expect.slot0.secondsPerTick);
    expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
      computeLiquidityIndex(
        expect.utilizationRate,
        newPremiumRate,
        timeElapsed - ignoredDuration,
      ),
    );
    expect.slot0.liquidityIndexLead = computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      ignoredDuration,
    );

    if (expect.slot0.tick === pool.slot0.tick) {
      expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
    } else {
      expect.slot0.lastUpdateTimestamp = timestamp - ignoredDuration;
    }

    expectedArray.push(expect);
  }

  return expectedArray;
}

export function calcExpectedPoolDataAfterUncommitRemoveLiquidity(
  poolDataBefore: PoolInfoObject[],
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject[] {
  const expectedArray = [];

  for (const pool of poolDataBefore) {
    const expect = deepCopy(pool);

    expect.strategyRewardIndex = strategyRewardIndex;

    // These value may be unpredictably changed due to covers expiring during time travel
    const timeElapsed = timestamp - pool.slot0.lastUpdateTimestamp;
    const ignoredDuration = timeElapsed % expect.slot0.secondsPerTick;

    const oldPremiumRate = getPremiumRate(pool, pool.utilizationRate);
    const newPremiumRate = getPremiumRate(pool, expect.utilizationRate);

    expect.slot0.secondsPerTick = secondsPerTick(
      pool.slot0.secondsPerTick,
      oldPremiumRate,
      newPremiumRate,
    ).toNumber();
    expect.slot0.tick = Math.floor(timeElapsed / expect.slot0.secondsPerTick);
    expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
      computeLiquidityIndex(
        expect.utilizationRate,
        newPremiumRate,
        timeElapsed - ignoredDuration,
      ),
    );
    expect.slot0.liquidityIndexLead = computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      ignoredDuration,
    );

    if (expect.slot0.tick === pool.slot0.tick) {
      expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
    } else {
      expect.slot0.lastUpdateTimestamp = txTimestamp - ignoredDuration;
    }

    expectedArray.push(expect);
  }

  return expectedArray;
}

export function calcExpectedPoolDataAfterTakeInterests(
  poolDataBefore: PoolInfoObject[],
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject[] {
  const expectedArray = [];

  for (const pool of poolDataBefore) {
    const expect = deepCopy(pool);

    expect.strategyRewardIndex = strategyRewardIndex;

    // These value may be unpredictably changed due to covers expiring during time travel
    const timeElapsed = timestamp - pool.slot0.lastUpdateTimestamp;
    const ignoredDuration = timeElapsed % expect.slot0.secondsPerTick;

    const oldPremiumRate = getPremiumRate(pool, pool.utilizationRate);
    const newPremiumRate = getPremiumRate(pool, expect.utilizationRate);

    expect.slot0.secondsPerTick = secondsPerTick(
      pool.slot0.secondsPerTick,
      oldPremiumRate,
      newPremiumRate,
    ).toNumber();
    expect.slot0.tick = Math.floor(timeElapsed / expect.slot0.secondsPerTick);
    expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
      computeLiquidityIndex(
        expect.utilizationRate,
        newPremiumRate,
        timeElapsed - ignoredDuration,
      ),
    );
    expect.slot0.liquidityIndexLead = computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      ignoredDuration,
    );

    if (expect.slot0.tick === pool.slot0.tick) {
      expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
    } else {
      expect.slot0.lastUpdateTimestamp = txTimestamp - ignoredDuration;
    }

    expectedArray.push(expect);
  }

  return expectedArray;
}

export function calcExpectedPoolDataAfterRemoveLiquidity(
  amountToRemove: BigNumber,
  poolIds: number[],
  keepWrapped: boolean,
  poolDataBefore: PoolInfoObject[],
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject[] {
  const expect = deepCopy(poolDataBefore);

  return expect;
}

export function calcExpectedPoolDataAfterOpenCover(
  amount: BigNumber,
  premiums: BigNumber,
  poolDataBefore: PoolInfoObject,
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const expect = deepCopy(poolDataBefore);

  expect.strategyRewardIndex = strategyRewardIndex;

  // These value may be unpredictably changed due to covers expiring during time travel
  expect.availableLiquidity = poolDataBefore.availableLiquidity.sub(amount);
  expect.slot0.coveredCapital = poolDataBefore.slot0.coveredCapital.add(amount);
  expect.slot0.remainingCovers = poolDataBefore.slot0.remainingCovers.add(1);
  expect.utilizationRate = utilization(
    expect.slot0.coveredCapital,
    expect.totalLiquidity,
  );

  const { newPremiumRate, newSecondsPerTick } = updatedPremiumRate(
    poolDataBefore,
    amount,
    BigNumber.from(0),
  );

  expect.slot0.secondsPerTick = newSecondsPerTick.toNumber();

  const timeElapsed = timestamp - poolDataBefore.slot0.lastUpdateTimestamp;
  const ignoredDuration = timeElapsed % expect.slot0.secondsPerTick;

  expect.slot0.tick = Math.floor(timeElapsed / expect.slot0.secondsPerTick);
  expect.slot0.liquidityIndex = poolDataBefore.slot0.liquidityIndex.add(
    computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      timeElapsed - ignoredDuration,
    ),
  );
  expect.slot0.liquidityIndexLead = computeLiquidityIndex(
    expect.utilizationRate,
    newPremiumRate,
    ignoredDuration,
  );

  if (expect.slot0.tick === poolDataBefore.slot0.tick) {
    expect.slot0.lastUpdateTimestamp = poolDataBefore.slot0.lastUpdateTimestamp;
  } else {
    expect.slot0.lastUpdateTimestamp = txTimestamp - ignoredDuration;
  }

  return expect;
}

export function calcExpectedPoolDataAfterUpdateCover(
  coverToAddAmount: BigNumber,
  coverToRemoveAmount: BigNumber,
  premiumsToAddAmount: BigNumber,
  premiumsToRemoveAmount: BigNumber,
  poolDataBefore: PoolInfoObject,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const expect = deepCopy(poolDataBefore);

  return expect;
}

export function calcExpectedPoolDataAfterInitiateClaim(
  amountClaimedAmount: BigNumber,
  poolDataBefore: PoolInfoObject,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const expect = deepCopy(poolDataBefore);

  return expect;
}

export function calcExpectedPoolDataAfterWithdrawCompensation(
  claimAmount: BigNumber,
  poolDataBefore: PoolInfoObject,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const expect = deepCopy(poolDataBefore);

  return expect;
}

// ========= POSITIONS ========= //

export function calcExpectedPositionDataAfterOpenPosition(
  positionAmount: BigNumber,
  poolIds: number[],
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  txTimestamp: number,
  timestamp: number,
): PositionInfoObject {
  const expect: any = {};

  expect.supplied = positionAmount;
  expect.commitWithdrawalTimestamp = 0;
  expect.poolIds = poolIds;
  expect.newUserCapital = expect.supplied;

  expect.coverRewards = [];
  for (const pool of poolDataBefore) {
    const coverRewards = getCoverRewards(
      expect.newUserCapital,
      pool.slot0.liquidityIndex,
      expectedPoolData[0].slot0.liquidityIndex,
    );
    expect.coverRewards.push(coverRewards);
  }

  expect.strategyRewardIndex = expectedPoolData[0].strategyRewardIndex;
  expect.strategyRewards = computeReward(
    expect.newUserCapital,
    tokenDataBefore.strategyRewardIndex,
    expectedPoolData[0].strategyRewardIndex,
  );

  return expect satisfies PositionInfoObject;
}

export function calcExpectedPositionDataAfterAddLiquidity(
  amountToAdd: BigNumber,
  poolIds: number[],
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  txTimestamp: number,
  timestamp: number,
): PositionInfoObject {
  const expect = {} as PositionInfoObject;

  expect.supplied = tokenDataBefore.supplied.add(amountToAdd);
  expect.commitWithdrawalTimestamp = 0;
  expect.poolIds = poolIds;
  expect.newUserCapital = expect.supplied;

  expect.coverRewards = [];
  for (const pool of poolDataBefore) {
    // adding liquidity takes profits
    const coverRewards =
      txTimestamp === timestamp
      ? BigNumber.from(0)
      : getCoverRewards(
          expect.newUserCapital,
          pool.slot0.liquidityIndex,
          expectedPoolData[0].slot0.liquidityIndex,
        );
    expect.coverRewards.push(coverRewards);
  }

  expect.strategyRewardIndex = expectedPoolData[0].strategyRewardIndex;
  // adding liquidity takes profits
  expect.strategyRewards =
    txTimestamp === timestamp
    ? BigNumber.from(0)
    : computeReward(
        expect.newUserCapital,
        tokenDataBefore.strategyRewardIndex,
        expectedPoolData[0].strategyRewardIndex,
      );

  return expect;
}

export function calcExpectedPositionDataAfterTakeInterests(
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  txTimestamp: number,
  timestamp: number,
): PositionInfoObject {
  const expect = deepCopy(tokenDataBefore);

  return expect;
}

export function calcExpectedPositionDataAfterCommitRemoveLiquidity(
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  newStartStrategyIndex: BigNumber,
  newStartLiquidityIndexes: BigNumber[],
  txTimestamp: number,
  timestamp: number,
): PositionInfoObject {
  const expect = {} as PositionInfoObject;

  expect.supplied = tokenDataBefore.supplied;
  expect.commitWithdrawalTimestamp = txTimestamp;
  expect.poolIds = tokenDataBefore.poolIds;
  expect.newUserCapital = expect.supplied;
  expect.strategyRewardIndex = expectedPoolData[0].strategyRewardIndex;

  expect.coverRewards = [];
  for (const [i, pool] of poolDataBefore.entries()) {
    const startLiquidityIndex = newStartLiquidityIndexes[i];
    const expectedLiquidityIndex = expectedPoolData[i].slot0.liquidityIndex;
    // commiting takes profits
    const coverRewards =
      txTimestamp === timestamp
      ? BigNumber.from(0)
      : getCoverRewards(
          expect.newUserCapital,
          startLiquidityIndex,
          expectedLiquidityIndex,
        );
    expect.coverRewards.push(coverRewards);
  }

  // commiting takes profits
  expect.strategyRewards =
    txTimestamp === timestamp
    ? BigNumber.from(0)
    : computeReward(
        expect.newUserCapital,
        newStartStrategyIndex,
        expectedPoolData[0].strategyRewardIndex,
      );

  return expect;
}

export function calcExpectedPositionDataAfterUncommitRemoveLiquidity(
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  txTimestamp: number,
  timestamp: number,
): PositionInfoObject {
  const expect = deepCopy(tokenDataBefore);

  return expect;
}

export function calcExpectedPositionDataAfterRemoveLiquidity(
  amountToRemove: BigNumber,
  keepWrapped: boolean,
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  txTimestamp: number,
  timestamp: number,
): PositionInfoObject {
  const expect = deepCopy(tokenDataBefore);

  return expect;
}

// ========= COVERS ========= //

export function calcExpectedCoverDataAfterOpenCover(
  amount: BigNumber,
  premiums: BigNumber,
  poolDataBefore: PoolInfoObject,
  expectedPoolData: PoolInfoObject,
  tokenDataBefore: CoverInfoObject,
  txTimestamp: number,
  timestamp: number,
): CoverInfoObject {
  const expect = deepCopy(tokenDataBefore);

  expect.coverAmount = amount;
  expect.poolId = expectedPoolData.poolId;
  expect.start = timestamp;
  expect.end = 0;

  const { newPremiumRate: beginPremiumRate } = updatedPremiumRate(
    poolDataBefore,
    amount,
    BigNumber.from(0),
  );

  expect.premiumRate = getPremiumRate(
    expectedPoolData,
    expectedPoolData.utilizationRate,
  );
  expect.dailyCost = currentDailyCost(
    amount,
    beginPremiumRate,
    expect.premiumRate,
  );
  expect.premiumsLeft = premiums.sub(
    expect.dailyCost.mul(timestamp - txTimestamp).div(26 * 60 * 60),
  );

  return expect;
}

export function calcExpectedCoverDataAfterUpdateCover(
  coverToAddAmount: BigNumber,
  coverToRemoveAmount: BigNumber,
  premiumsToAddAmount: BigNumber,
  premiumsToRemoveAmount: BigNumber,
  poolDataBefore: PoolInfoObject,
  expectedPoolData: PoolInfoObject,
  tokenDataBefore: CoverInfoObject,
  txTimestamp: number,
  timestamp: number,
): CoverInfoObject {
  const expect = deepCopy(tokenDataBefore);

  return expect;
}

export function calcExpectedCoverDataAfterInitiateClaim(
  amountClaimedAmount: BigNumber,
  poolDataBefore: PoolInfoObject,
  expectedPoolData: PoolInfoObject,
  tokenDataBefore: CoverInfoObject,
  txTimestamp: number,
  timestamp: number,
): CoverInfoObject {
  const expect = deepCopy(tokenDataBefore);

  return expect;
}

export function calcExpectedCoverDataAfterWithdrawCompensation(
  claimInfoBefore: ClaimInfoObject,
  poolDataBefore: PoolInfoObject,
  expectedPoolData: PoolInfoObject,
  tokenDataBefore: CoverInfoObject,
  txTimestamp: number,
  timestamp: number,
): CoverInfoObject {
  const expect = deepCopy(tokenDataBefore);

  return expect;
}
