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
} from "../utils/poolRayMath";
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

function updatePoolTimeBasedState(
  poolDataBefore: PoolInfoObject,
  expect: PoolInfoObject,
  timestamp: number,
): PoolInfoObject {
  // These value may be unpredictably changed due to covers expiring during time travel
  const timeElapsed = timestamp - poolDataBefore.slot0.lastUpdateTimestamp;
  const ignoredDuration = timeElapsed % expect.slot0.secondsPerTick;

  const oldPremiumRate = getPremiumRate(
    poolDataBefore,
    poolDataBefore.utilizationRate,
  );
  const newPremiumRate = getPremiumRate(expect, expect.utilizationRate);

  expect.slot0.secondsPerTick = secondsPerTick(
    poolDataBefore.slot0.secondsPerTick,
    oldPremiumRate,
    newPremiumRate,
  ).toNumber();

  expect.slot0.tick =
    poolDataBefore.slot0.tick +
    Math.floor(timeElapsed / expect.slot0.secondsPerTick);

  expect.premiumRate = getPremiumRate(expect, expect.utilizationRate);
  expect.liquidityIndexLead = computeLiquidityIndex(
    expect.utilizationRate,
    newPremiumRate,
    ignoredDuration,
  );

  if (expect.slot0.tick === poolDataBefore.slot0.tick) {
    expect.slot0.lastUpdateTimestamp = poolDataBefore.slot0.lastUpdateTimestamp;
  } else {
    expect.slot0.lastUpdateTimestamp = timestamp - ignoredDuration;
    expect.slot0.liquidityIndex = poolDataBefore.slot0.liquidityIndex.add(
      computeLiquidityIndex(
        expect.utilizationRate,
        newPremiumRate,
        timeElapsed - ignoredDuration,
      ),
    );
  }

  return expect;
}

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

    const updatedExpect = updatePoolTimeBasedState(pool, expect, timestamp);
    expectedArray.push(updatedExpect);
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

    const updatedExpect = updatePoolTimeBasedState(pool, expect, timestamp);
    expectedArray.push(updatedExpect);
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

    const updatedExpect = updatePoolTimeBasedState(pool, expect, timestamp);
    expectedArray.push(updatedExpect);
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

    const updatedExpect = updatePoolTimeBasedState(pool, expect, timestamp);

    expectedArray.push(updatedExpect);
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

    const updatedExpect = updatePoolTimeBasedState(pool, expect, timestamp);

    expectedArray.push(updatedExpect);
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

    const updatedExpect = updatePoolTimeBasedState(pool, expect, timestamp);
    expectedArray.push(updatedExpect);
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

  expect.availableLiquidity = pool.availableLiquidity.sub(amount);
  expect.slot0.coveredCapital = pool.slot0.coveredCapital.add(amount);

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

  return updatePoolTimeBasedState(poolDataBefore, expect, timestamp);
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

  expect.availableLiquidity = pool.availableLiquidity
    .sub(coverToAddAmount)
    .add(coverToRemoveAmount);
  expect.slot0.coveredCapital = pool.slot0.coveredCapital
    .add(coverToAddAmount)
    .sub(coverToRemoveAmount);

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

  return updatePoolTimeBasedState(poolDataBefore, expect, timestamp);
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

  return updatePoolTimeBasedState(poolDataBefore, expect, timestamp);
}

export function calcExpectedPoolDataAfterWithdrawCompensation(
  claimAmount: BigNumber,
  compensationId: number,
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
  expect.compensationIds = [...pool.compensationIds, compensationId];

  const shouldCloseCover =
    claimAmount.eq(tokenDataBefore.coverAmount) ||
    poolDataBefore.totalLiquidity.lt(poolDataBefore.slot0.coveredCapital);

  if (shouldCloseCover) {
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

  return updatePoolTimeBasedState(poolDataBefore, expect, timestamp);
}

export function calcExpectedPoolDataAfterSubmitEvidence(
  poolDataBefore: PoolInfoObject,
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const expect = deepCopy(poolDataBefore);

  expect.strategyRewardIndex = strategyRewardIndex;

  return updatePoolTimeBasedState(poolDataBefore, expect, timestamp);
}

export function calcExpectedPoolDataAfterDisputeClaim(
  poolDataBefore: PoolInfoObject,
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const expect = deepCopy(poolDataBefore);

  expect.strategyRewardIndex = strategyRewardIndex;

  expect.ongoingClaims = poolDataBefore.ongoingClaims - 1;
  if (expect.ongoingClaims < 0)
    throw Error("Ongoing claims cannot be negative");

  return updatePoolTimeBasedState(poolDataBefore, expect, timestamp);
}

export function calcExpectedPoolDataAfterRuleClaim(
  poolDataBefore: PoolInfoObject,
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const expect = deepCopy(poolDataBefore);

  expect.strategyRewardIndex = strategyRewardIndex;

  expect.ongoingClaims = poolDataBefore.ongoingClaims - 1;
  if (expect.ongoingClaims < 0)
    throw Error("Ongoing claims cannot be negative");

  return updatePoolTimeBasedState(poolDataBefore, expect, timestamp);
}

export function calcExpectedPoolDataAfterOverruleRuling(
  poolDataBefore: PoolInfoObject,
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const expect = deepCopy(poolDataBefore);

  expect.strategyRewardIndex = strategyRewardIndex;

  return updatePoolTimeBasedState(poolDataBefore, expect, timestamp);
}

export function calcExpectedPoolDataAfterAppeal(
  poolDataBefore: PoolInfoObject,
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const expect = deepCopy(poolDataBefore);

  expect.strategyRewardIndex = strategyRewardIndex;

  // No change to the ongoingClaims count as the claim remains disputed

  return updatePoolTimeBasedState(poolDataBefore, expect, timestamp);
}

export function calcExpectedPoolDataAfterWithdrawProsecutionReward(
  poolDataBefore: PoolInfoObject,
  strategyRewardIndex: BigNumber,
  txTimestamp: number,
  timestamp: number,
): PoolInfoObject {
  const expect = deepCopy(poolDataBefore);

  expect.strategyRewardIndex = strategyRewardIndex;

  // The claim is removed from the pool when the prosecutor gets paid
  expect.ongoingClaims--;
  if (expect.ongoingClaims < 0)
    throw Error("Ongoing claims cannot be negative");

  return updatePoolTimeBasedState(poolDataBefore, expect, timestamp);
}
