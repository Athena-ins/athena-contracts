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
      tick: 1,
      secondsPerTick: constants.MAX_SECONDS_PER_TICK.toNumber(),
      coveredCapital: BigNumber.from(0),
      remainingCovers: BigNumber.from(0),
      lastUpdateTimestamp: txTimestamp,
      liquidityIndex: BigNumber.from(0),
    },
    strategyId: strategyId,
    strategyRewardRate: BigNumber.from(0),
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
    lastOnchainUpdateTimestamp: txTimestamp,
    ongoingClaims: 0,
    premiumRate: BigNumber.from(0),
    liquidityIndexLead: BigNumber.from(0),
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

    expect.slot0.tick =
      pool.slot0.tick + Math.floor(timeElapsed / expect.slot0.secondsPerTick);

    expect.premiumRate = getPremiumRate(pool, expect.utilizationRate);
    expect.liquidityIndexLead = computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      ignoredDuration,
    );

    if (expect.slot0.tick === pool.slot0.tick) {
      expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
    } else {
      expect.slot0.lastUpdateTimestamp = timestamp - ignoredDuration;

      expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
        computeLiquidityIndex(
          expect.utilizationRate,
          newPremiumRate,
          timeElapsed - ignoredDuration,
        ),
      );
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

    expect.slot0.tick =
      pool.slot0.tick + Math.floor(timeElapsed / expect.slot0.secondsPerTick);

    expect.premiumRate = getPremiumRate(pool, expect.utilizationRate);
    expect.liquidityIndexLead = computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      ignoredDuration,
    );

    if (expect.slot0.tick === pool.slot0.tick) {
      expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
    } else {
      expect.slot0.lastUpdateTimestamp = timestamp - ignoredDuration;

      expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
        computeLiquidityIndex(
          expect.utilizationRate,
          newPremiumRate,
          timeElapsed - ignoredDuration,
        ),
      );
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

    expect.slot0.tick =
      pool.slot0.tick + Math.floor(timeElapsed / expect.slot0.secondsPerTick);

    expect.premiumRate = getPremiumRate(pool, expect.utilizationRate);
    expect.liquidityIndexLead = computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      ignoredDuration,
    );

    if (expect.slot0.tick === pool.slot0.tick) {
      expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
    } else {
      expect.slot0.lastUpdateTimestamp = timestamp - ignoredDuration;

      expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
        computeLiquidityIndex(
          expect.utilizationRate,
          newPremiumRate,
          timeElapsed - ignoredDuration,
        ),
      );
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

    expect.slot0.tick =
      pool.slot0.tick + Math.floor(timeElapsed / expect.slot0.secondsPerTick);

    expect.premiumRate = getPremiumRate(pool, expect.utilizationRate);
    expect.liquidityIndexLead = computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      ignoredDuration,
    );

    if (expect.slot0.tick === pool.slot0.tick) {
      expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
    } else {
      expect.slot0.lastUpdateTimestamp = timestamp - ignoredDuration;

      expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
        computeLiquidityIndex(
          expect.utilizationRate,
          newPremiumRate,
          timeElapsed - ignoredDuration,
        ),
      );
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

    expect.slot0.tick =
      pool.slot0.tick + Math.floor(timeElapsed / expect.slot0.secondsPerTick);

    expect.premiumRate = getPremiumRate(pool, expect.utilizationRate);
    expect.liquidityIndexLead = computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      ignoredDuration,
    );

    if (expect.slot0.tick === pool.slot0.tick) {
      expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
    } else {
      expect.slot0.lastUpdateTimestamp = timestamp - ignoredDuration;

      expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
        computeLiquidityIndex(
          expect.utilizationRate,
          newPremiumRate,
          timeElapsed - ignoredDuration,
        ),
      );
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
  const expectedArray: PoolInfoObject[] = [];

  for (const pool of poolDataBefore) {
    const expect = deepCopy(pool);

    expect.strategyRewardIndex = strategyRewardIndex;

    expect.totalLiquidity = pool.totalLiquidity.sub(amountToRemove);
    expect.availableLiquidity = pool.availableLiquidity.sub(amountToRemove);
    expect.utilizationRate = utilization(
      pool.slot0.coveredCapital,
      expect.totalLiquidity,
    );

    expect.overlappedCapital = pool.overlappedPools.map((id, i) => {
      const existingCapital = pool.overlappedCapital[i];
      return poolIds.includes(id)
        ? existingCapital.sub(amountToRemove)
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

    expect.slot0.tick =
      pool.slot0.tick + Math.floor(timeElapsed / expect.slot0.secondsPerTick);

    expect.premiumRate = getPremiumRate(pool, expect.utilizationRate);
    expect.liquidityIndexLead = computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      ignoredDuration,
    );

    if (expect.slot0.tick === pool.slot0.tick) {
      expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
    } else {
      expect.slot0.lastUpdateTimestamp = timestamp - ignoredDuration;

      expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
        computeLiquidityIndex(
          expect.utilizationRate,
          newPremiumRate,
          timeElapsed - ignoredDuration,
        ),
      );
    }

    expectedArray.push(expect);
  }

  return expectedArray;
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
  const pool = poolDataBefore;

  expect.strategyRewardIndex = strategyRewardIndex;

  // These value may be unpredictably changed due to covers expiring during time travel
  expect.availableLiquidity = pool.availableLiquidity.sub(amount);
  expect.slot0.coveredCapital = pool.slot0.coveredCapital.add(amount);
  expect.slot0.remainingCovers = pool.slot0.remainingCovers.add(1);

  expect.utilizationRate = utilization(
    expect.slot0.coveredCapital,
    expect.totalLiquidity,
  );

  const { newPremiumRate, newSecondsPerTick } = updatedPremiumRate(
    pool,
    amount,
    BigNumber.from(0),
  );

  expect.slot0.secondsPerTick = newSecondsPerTick.toNumber();

  const timeElapsed = timestamp - pool.slot0.lastUpdateTimestamp;
  const ignoredDuration = timeElapsed % expect.slot0.secondsPerTick;

  expect.slot0.tick =
    pool.slot0.tick + Math.floor(timeElapsed / expect.slot0.secondsPerTick);

  expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
    computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      timeElapsed - ignoredDuration,
    ),
  );
  expect.premiumRate = getPremiumRate(pool, expect.utilizationRate);
  expect.liquidityIndexLead = computeLiquidityIndex(
    expect.utilizationRate,
    newPremiumRate,
    ignoredDuration,
  );

  if (expect.slot0.tick === pool.slot0.tick) {
    expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
  } else {
    expect.slot0.lastUpdateTimestamp = timestamp - ignoredDuration;
  }

  return expect;
}

export function calcExpectedPoolDataAfterUpdateCover(
  coverToAddAmount: BigNumber,
  coverToRemoveAmount: BigNumber,
  premiumsToAddAmount: BigNumber,
  premiumsToRemoveAmount: BigNumber,
  tokenDataBefore: CoverInfoObject,
  poolDataBefore: PoolInfoObject,
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const expect = deepCopy(poolDataBefore);
  const pool = poolDataBefore;

  expect.strategyRewardIndex = strategyRewardIndex;

  // If we remove all premiums we are closing cover
  if (premiumsToRemoveAmount.eq(constants.MAX_UINT256))
    coverToRemoveAmount = tokenDataBefore.coverAmount;

  // These value may be unpredictably changed due to covers expiring during time travel
  expect.availableLiquidity = pool.availableLiquidity
    .sub(coverToAddAmount)
    .add(coverToRemoveAmount);
  expect.slot0.coveredCapital = pool.slot0.coveredCapital
    .add(coverToAddAmount)
    .sub(coverToRemoveAmount);
  expect.slot0.remainingCovers = pool.slot0.remainingCovers;

  if (
    premiumsToRemoveAmount.eq(constants.MAX_UINT256) ||
    tokenDataBefore.premiumsLeft.eq(premiumsToRemoveAmount)
  ) {
    expect.slot0.remainingCovers = expect.slot0.remainingCovers.sub(1);
  }

  expect.utilizationRate = utilization(
    expect.slot0.coveredCapital,
    expect.totalLiquidity,
  );

  const { newPremiumRate, newSecondsPerTick } = updatedPremiumRate(
    pool,
    coverToAddAmount,
    coverToRemoveAmount,
  );

  expect.slot0.secondsPerTick = newSecondsPerTick.toNumber();

  const timeElapsed = timestamp - pool.slot0.lastUpdateTimestamp;
  const ignoredDuration = timeElapsed % expect.slot0.secondsPerTick;

  expect.slot0.tick =
    pool.slot0.tick + Math.floor(timeElapsed / expect.slot0.secondsPerTick);

  expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
    computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      timeElapsed - ignoredDuration,
    ),
  );
  expect.premiumRate = getPremiumRate(pool, expect.utilizationRate);
  expect.liquidityIndexLead = computeLiquidityIndex(
    expect.utilizationRate,
    newPremiumRate,
    ignoredDuration,
  );

  if (expect.slot0.tick === pool.slot0.tick) {
    expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
  } else {
    expect.slot0.lastUpdateTimestamp = timestamp - ignoredDuration;
  }

  return expect;
}

export function calcExpectedPoolDataAfterInitiateClaim(
  amountClaimedAmount: BigNumber,
  poolDataBefore: PoolInfoObject,
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const pool = poolDataBefore;

  const expect = deepCopy(pool);

  expect.ongoingClaims++;
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

  expect.slot0.tick =
    pool.slot0.tick + Math.floor(timeElapsed / expect.slot0.secondsPerTick);

  expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
    computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      timeElapsed - ignoredDuration,
    ),
  );
  expect.premiumRate = getPremiumRate(pool, expect.utilizationRate);
  expect.liquidityIndexLead = computeLiquidityIndex(
    expect.utilizationRate,
    newPremiumRate,
    ignoredDuration,
  );

  if (expect.slot0.tick === pool.slot0.tick) {
    expect.slot0.lastUpdateTimestamp = pool.slot0.lastUpdateTimestamp;
  } else {
    expect.slot0.lastUpdateTimestamp = timestamp - ignoredDuration;
  }

  return expect;
}

export function calcExpectedPoolDataAfterWithdrawCompensation(
  claimAmount: BigNumber,
  claimId: number,
  poolDataBefore: PoolInfoObject,
  tokenDataBefore: CoverInfoObject,
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const pool = poolDataBefore;
  const expect = deepCopy(poolDataBefore);

  expect.strategyRewardIndex = strategyRewardIndex;

  expect.ongoingClaims--;
  expect.compensationIds = [...pool.compensationIds, claimId];

  if (
    claimAmount.eq(tokenDataBefore.coverAmount) ||
    expect.availableLiquidity.lt(claimAmount)
  ) {
    expect.slot0.remainingCovers = pool.slot0.remainingCovers.sub(1);
    expect.slot0.coveredCapital = pool.slot0.coveredCapital.sub(
      tokenDataBefore.coverAmount.sub(claimAmount),
    );
  }

  expect.totalLiquidity = pool.totalLiquidity.sub(claimAmount);
  expect.slot0.coveredCapital = pool.slot0.coveredCapital.sub(claimAmount);

  expect.utilizationRate = utilization(
    expect.slot0.coveredCapital,
    expect.totalLiquidity,
  );

  expect.overlappedCapital = pool.overlappedCapital.map((capital) =>
    capital.sub(claimAmount),
  );

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

  expect.slot0.tick =
    pool.slot0.tick + Math.floor(timeElapsed / expect.slot0.secondsPerTick);

  expect.slot0.liquidityIndex = pool.slot0.liquidityIndex.add(
    computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      timeElapsed - ignoredDuration,
    ),
  );
  expect.premiumRate = getPremiumRate(pool, expect.utilizationRate);
  expect.liquidityIndexLead = computeLiquidityIndex(
    expect.utilizationRate,
    newPremiumRate,
    ignoredDuration,
  );

  expect.slot0.lastUpdateTimestamp = timestamp - ignoredDuration;

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
  const expect = {} as PositionInfoObject;

  expect.positionId = tokenDataBefore.positionId;
  expect.supplied = positionAmount;
  expect.commitWithdrawalTimestamp = 0;
  expect.poolIds = poolIds;
  expect.newUserCapital = expect.supplied;

  // @bw change with strat man v1
  expect.suppliedWrapped = expect.supplied;
  // @bw change with strat man v1
  expect.newUserCapitalWrapped = expect.newUserCapital;

  expect.coverRewards = [];
  for (const [i, pool] of poolDataBefore.entries()) {
    const coverRewards = getCoverRewards(
      expect.newUserCapital,
      pool.slot0.liquidityIndex,
      expectedPoolData[i].slot0.liquidityIndex,
    );
    expect.coverRewards.push(coverRewards);
  }

  expect.strategyRewardIndex = expectedPoolData[0].strategyRewardIndex;
  expect.strategyRewards = computeReward(
    expect.newUserCapital,
    tokenDataBefore.strategyRewardIndex,
    expectedPoolData[0].strategyRewardIndex,
  );

  return expect;
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

  expect.positionId = tokenDataBefore.positionId;
  expect.supplied = tokenDataBefore.supplied.add(amountToAdd);
  expect.commitWithdrawalTimestamp = 0;
  expect.poolIds = poolIds;
  expect.newUserCapital = expect.supplied;

  // @bw change with strat man v1
  expect.suppliedWrapped = expect.supplied;
  // @bw change with strat man v1
  expect.newUserCapitalWrapped = expect.newUserCapital;

  expect.coverRewards = [];
  for (const [i, pool] of poolDataBefore.entries()) {
    // adding liquidity takes profits
    const coverRewards =
      txTimestamp === timestamp
        ? BigNumber.from(0)
        : getCoverRewards(
            expect.newUserCapital,
            pool.slot0.liquidityIndex,
            expectedPoolData[i].slot0.liquidityIndex,
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
  const expect = {} as PositionInfoObject;

  expect.positionId = tokenDataBefore.positionId;
  expect.supplied = tokenDataBefore.supplied;
  expect.commitWithdrawalTimestamp = 0;
  expect.poolIds = tokenDataBefore.poolIds;
  expect.newUserCapital = expect.supplied;

  // @bw change with strat man v1
  expect.suppliedWrapped = expect.supplied;
  // @bw change with strat man v1
  expect.newUserCapitalWrapped = expect.newUserCapital;

  expect.coverRewards = [];
  for (const [i, pool] of poolDataBefore.entries()) {
    // adding liquidity takes profits
    const coverRewards =
      txTimestamp === timestamp
        ? BigNumber.from(0)
        : getCoverRewards(
            expect.newUserCapital,
            pool.slot0.liquidityIndex,
            expectedPoolData[i].slot0.liquidityIndex,
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

  expect.positionId = tokenDataBefore.positionId;
  expect.supplied = tokenDataBefore.supplied;
  expect.commitWithdrawalTimestamp = txTimestamp;
  expect.poolIds = tokenDataBefore.poolIds;
  expect.newUserCapital = expect.supplied;
  expect.strategyRewardIndex = expectedPoolData[0].strategyRewardIndex;

  // @bw change with strat man v1
  expect.suppliedWrapped = expect.supplied;
  // @bw change with strat man v1
  expect.newUserCapitalWrapped = expect.newUserCapital;

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
  newStartStrategyIndex: BigNumber,
  newStartLiquidityIndexes: BigNumber[],
  txTimestamp: number,
  timestamp: number,
): PositionInfoObject {
  const expect = {} as PositionInfoObject;

  expect.positionId = tokenDataBefore.positionId;
  expect.supplied = tokenDataBefore.supplied;
  expect.commitWithdrawalTimestamp = 0;
  expect.poolIds = tokenDataBefore.poolIds;
  expect.newUserCapital = expect.supplied;
  expect.strategyRewardIndex = expectedPoolData[0].strategyRewardIndex;

  // @bw change with strat man v1
  expect.suppliedWrapped = expect.supplied;
  // @bw change with strat man v1
  expect.newUserCapitalWrapped = expect.newUserCapital;

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

export function calcExpectedPositionDataAfterRemoveLiquidity(
  amountToRemove: BigNumber,
  keepWrapped: boolean,
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  txTimestamp: number,
  timestamp: number,
): PositionInfoObject {
  const expect = {} as PositionInfoObject;

  expect.positionId = tokenDataBefore.positionId;
  expect.supplied = tokenDataBefore.supplied.sub(amountToRemove);
  expect.commitWithdrawalTimestamp = 0;
  expect.poolIds = tokenDataBefore.poolIds;
  expect.newUserCapital = expect.supplied;

  // @bw change with strat man v1
  expect.suppliedWrapped = expect.supplied;
  // @bw change with strat man v1
  expect.newUserCapitalWrapped = expect.newUserCapital;

  expect.coverRewards = [];
  for (const [i, pool] of poolDataBefore.entries()) {
    // adding liquidity takes profits
    const coverRewards =
      txTimestamp === timestamp
        ? BigNumber.from(0)
        : getCoverRewards(
            expect.newUserCapital,
            pool.slot0.liquidityIndex,
            expectedPoolData[i].slot0.liquidityIndex,
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
  expect.isActive = true;

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

  const durationInSeconds = RayInt.from(
    premiums.mul(constants.YEAR).mul(constants.PERCENTAGE_BASE),
  )
    .rayDiv(expect.premiumRate)
    .div(amount)
    .toNumber();

  expect.lastTick =
    poolDataBefore.slot0.tick +
    Math.floor(durationInSeconds / expectedPoolData.slot0.secondsPerTick);

  const timeLostToTickRounding =
    durationInSeconds -
    expectedPoolData.slot0.secondsPerTick *
      (expect.lastTick - poolDataBefore.slot0.tick);
  const premiumsLostToTickRounding = expect.dailyCost
    .mul(timeLostToTickRounding)
    .div(24 * 60 * 60);

  const timeElapsed =
    (expectedPoolData.slot0.tick - poolDataBefore.slot0.tick) *
    expectedPoolData.slot0.secondsPerTick;
  const premiumsSpent = expect.dailyCost.mul(timeElapsed).div(24 * 60 * 60);

  expect.premiumsLeft = premiums
    .sub(premiumsLostToTickRounding)
    .sub(premiumsSpent);

  if (expect.premiumsLeft.eq(0)) {
    expect.isActive = false;
    expect.lastTick = expectedPoolData.slot0.tick - 1;
  }

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

  expect.coverAmount = tokenDataBefore.coverAmount
    .add(coverToAddAmount)
    .sub(coverToRemoveAmount);
  expect.poolId = expectedPoolData.poolId;
  expect.isActive = true;

  if (
    premiumsToRemoveAmount.eq(constants.MAX_UINT256) ||
    tokenDataBefore.premiumsLeft.eq(premiumsToRemoveAmount)
  ) {
    expect.isActive = false;

    expect.premiumRate = BigNumber.from(0);
    expect.dailyCost = BigNumber.from(0);
    expect.premiumsLeft = BigNumber.from(0);
    expect.lastTick = poolDataBefore.slot0.tick - 1;
  } else {
    const { newPremiumRate: beginPremiumRate } = updatedPremiumRate(
      poolDataBefore,
      coverToAddAmount,
      coverToRemoveAmount,
    );

    expect.premiumRate = getPremiumRate(
      expectedPoolData,
      expectedPoolData.utilizationRate,
    );
    expect.dailyCost = currentDailyCost(
      expect.coverAmount,
      beginPremiumRate,
      expect.premiumRate,
    );

    const timeElapsed =
      (expectedPoolData.slot0.tick - poolDataBefore.slot0.tick) *
      expectedPoolData.slot0.secondsPerTick;
    const premiumsSpent = expect.dailyCost.mul(timeElapsed).div(24 * 60 * 60);

    const newPremiums = tokenDataBefore.premiumsLeft
      .sub(premiumsToRemoveAmount)
      .add(premiumsToAddAmount);
    expect.premiumsLeft = newPremiums.sub(premiumsSpent);

    const durationInSeconds = RayInt.from(
      newPremiums.mul(constants.YEAR).mul(constants.PERCENTAGE_BASE),
    )
      .rayDiv(expect.premiumRate)
      .div(expect.coverAmount)
      .toNumber();

    expect.lastTick =
      poolDataBefore.slot0.tick +
      Math.floor(durationInSeconds / expectedPoolData.slot0.secondsPerTick);
  }

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
  const coverId = tokenDataBefore.coverId;
  const coverAmount = tokenDataBefore.coverAmount;
  const poolId = tokenDataBefore.poolId;
  const lastTick = tokenDataBefore.lastTick;

  const premiumRate = getPremiumRate(
    expectedPoolData,
    expectedPoolData.utilizationRate,
  );
  const dailyCost = tokenDataBefore.dailyCost;
  const premiumsLeft = tokenDataBefore.premiumsLeft.sub(
    dailyCost.mul(timestamp - txTimestamp).div(24 * 60 * 60),
  );
  const isActive = premiumsLeft.gt(0);

  return {
    coverId,
    coverAmount,
    poolId,
    isActive,
    lastTick,
    premiumRate,
    dailyCost,
    premiumsLeft,
  };
}

export function calcExpectedCoverDataAfterWithdrawCompensation(
  claimInfoBefore: ClaimInfoObject,
  poolDataBefore: PoolInfoObject,
  expectedPoolData: PoolInfoObject,
  tokenDataBefore: CoverInfoObject,
  txTimestamp: number,
  timestamp: number,
): CoverInfoObject {
  const claimAmount = claimInfoBefore.amount;

  const coverId = tokenDataBefore.coverId;
  const coverAmount = tokenDataBefore.coverAmount.sub(claimAmount);
  const poolId = tokenDataBefore.poolId;

  const shouldCloseCover =
    claimAmount.eq(tokenDataBefore.coverAmount) ||
    poolDataBefore.availableLiquidity.lt(claimAmount);

  const { newPremiumRate: beginPremiumRate } = updatedPremiumRate(
    poolDataBefore,
    0,
    shouldCloseCover ? tokenDataBefore.coverAmount : claimAmount,
  );

  const premiumRate = getPremiumRate(
    expectedPoolData,
    expectedPoolData.utilizationRate,
  );

  let dailyCost = currentDailyCost(coverAmount, beginPremiumRate, premiumRate);
  let premiumsLeft = tokenDataBefore.premiumsLeft.sub(
    dailyCost.mul(timestamp - txTimestamp).div(24 * 60 * 60),
  );
  let isActive = true;

  if (
    claimAmount.eq(tokenDataBefore.coverAmount) ||
    poolDataBefore.availableLiquidity.lt(claimAmount)
  ) {
    dailyCost = BigNumber.from(0);
    premiumsLeft = BigNumber.from(0);
    isActive = false;
  }

  let lastTick = poolDataBefore.slot0.tick - 1;

  if (!shouldCloseCover) {
    const { newPremiumRate: beginPremiumRate } = updatedPremiumRate(
      expectedPoolData,
      0,
      0,
    );

    const premiumRate = getPremiumRate(
      expectedPoolData,
      expectedPoolData.utilizationRate,
    );
    const dailyCost = currentDailyCost(
      coverAmount,
      beginPremiumRate,
      premiumRate,
    );

    const timeElapsed =
      (expectedPoolData.slot0.tick - poolDataBefore.slot0.tick) *
      expectedPoolData.slot0.secondsPerTick;
    const premiumsSpent = dailyCost.mul(timeElapsed).div(24 * 60 * 60);

    const premiumsLeft = tokenDataBefore.premiumsLeft.sub(premiumsSpent);

    const durationInSeconds = RayInt.from(
      premiumsLeft.mul(constants.YEAR).mul(constants.PERCENTAGE_BASE),
    )
      .rayDiv(premiumRate)
      .div(coverAmount)
      .toNumber();

    lastTick =
      poolDataBefore.slot0.tick +
      Math.floor(durationInSeconds / expectedPoolData.slot0.secondsPerTick);
  }

  return {
    coverId,
    coverAmount,
    poolId,
    isActive,
    lastTick,
    premiumRate,
    dailyCost,
    premiumsLeft,
  };
}
