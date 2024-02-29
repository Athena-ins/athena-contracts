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
} from "./poolRayMath";
// Types
import { BigNumber } from "ethers";
import {
  PoolInfoObject,
  PositionInfoObject,
  CoverInfoObject,
  ClaimInfoObject,
} from "../chai/almostEqualState";

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
  timestamp: BigNumber,
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
      lastUpdateTimestamp: timestamp.toNumber(),
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
  };
}

export function calcExpectedPoolDataAfterOpenPosition(
  positionAmount: BigNumber,
  isWrapped: boolean,
  poolIds: number[],
  poolDataBefore: PoolInfoObject[],
  strategyRewardIndex: BigNumber,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PoolInfoObject[] {
  const expectedArray: PoolInfoObject[] = [];

  for (const pool of poolDataBefore) {
    const expect = { ...pool };

    expect.strategyRewardIndex = strategyRewardIndex;

    expect.totalLiquidity = expect.totalLiquidity.add(positionAmount);
    expect.availableLiquidity = expect.availableLiquidity.add(positionAmount);
    expect.utilizationRate = utilization(
      pool.slot0.coveredCapital,
      expect.totalLiquidity,
    );

    expect.overlappedPools = [
      ...expect.overlappedPools,
      ...poolIds.filter((id) => !pool.overlappedPools.includes(id)),
    ];

    expect.overlappedCapital = expect.overlappedPools.map((id, i) => {
      const existingCapital = pool.overlappedCapital[i];
      return poolIds.includes(id)
        ? existingCapital.add(positionAmount)
        : existingCapital;
    });

    expect.slot0.lastUpdateTimestamp = timestamp.toNumber();

    // These value may be unpredictably changed due to covers expiring during time travel
    const timeElapsed = timestamp.sub(txTimestamp);
    const oldPremiumRate = getPremiumRate(pool, pool.utilizationRate);
    const newPremiumRate = getPremiumRate(pool, expect.utilizationRate);
    expect.slot0.secondsPerTick = secondsPerTick(
      pool.slot0.secondsPerTick,
      oldPremiumRate,
      newPremiumRate,
    ).toNumber();
    expect.slot0.tick = Math.floor(
      timeElapsed.toNumber() / expect.slot0.secondsPerTick,
    );
    expect.slot0.liquidityIndex = computeLiquidityIndex(
      expect.utilizationRate,
      newPremiumRate,
      timeElapsed,
    );

    expectedArray.push(expect);
  }

  return expectedArray;
}

export function calcExpectedPoolDataAfterAddLiquidity(
  amountToAdd: BigNumber,
  isWrapped: boolean,
  poolIds: BigNumber[],
  poolDataBefore: PoolInfoObject[],
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PoolInfoObject[] {
  const expected = structuredClone(poolDataBefore);

  return expected;
}

export function calcExpectedPoolDataAfterCommitRemoveLiquidity(
  poolDataBefore: PoolInfoObject[],
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PoolInfoObject[] {
  const expected = structuredClone(poolDataBefore);

  return expected;
}

export function calcExpectedPoolDataAfterUncommitRemoveLiquidity(
  poolDataBefore: PoolInfoObject[],
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PoolInfoObject[] {
  const expected = structuredClone(poolDataBefore);

  return expected;
}

export function calcExpectedPoolDataAfterTakeInterests(
  poolDataBefore: PoolInfoObject[],
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PoolInfoObject[] {
  const expected = structuredClone(poolDataBefore);

  return expected;
}

export function calcExpectedPoolDataAfterRemoveLiquidity(
  amountToRemove: BigNumber,
  keepWrapped: boolean,
  poolDataBefore: PoolInfoObject[],
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PoolInfoObject[] {
  const expected = structuredClone(poolDataBefore);

  return expected;
}

export function calcExpectedPoolDataAfterOpenCover(
  amount: BigNumber,
  premiums: BigNumber,
  poolDataBefore: PoolInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PoolInfoObject {
  const expected = { ...poolDataBefore };

  return expected;
}

export function calcExpectedPoolDataAfterUpdateCover(
  coverToAddAmount: BigNumber,
  coverToRemoveAmount: BigNumber,
  premiumsToAddAmount: BigNumber,
  premiumsToRemoveAmount: BigNumber,
  poolDataBefore: PoolInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PoolInfoObject {
  const expected = { ...poolDataBefore };

  return expected;
}

export function calcExpectedPoolDataAfterInitiateClaim(
  amountClaimedAmount: BigNumber,
  poolDataBefore: PoolInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PoolInfoObject {
  const expected = { ...poolDataBefore };

  return expected;
}

export function calcExpectedPoolDataAfterWithdrawCompensation(
  claimAmount: BigNumber,
  poolDataBefore: PoolInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PoolInfoObject {
  const expected = { ...poolDataBefore };

  return expected;
}

// ========= POSITIONS ========= //

export function calcExpectedPositionDataAfterOpenPosition(
  positionAmount: BigNumber,
  isWrapped: boolean,
  poolIds: number[],
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
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
  isWrapped: boolean,
  poolIds: number[],
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PositionInfoObject {
  const expected = { ...tokenDataBefore };

  return expected;
}

export function calcExpectedPositionDataAfterTakeInterests(
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PositionInfoObject {
  const expected = { ...tokenDataBefore };

  return expected;
}

export function calcExpectedPositionDataAfterCommitRemoveLiquidity(
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PositionInfoObject {
  const expected = { ...tokenDataBefore };

  return expected;
}

export function calcExpectedPositionDataAfterUncommitRemoveLiquidity(
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PositionInfoObject {
  const expected = { ...tokenDataBefore };

  return expected;
}

export function calcExpectedPositionDataAfterRemoveLiquidity(
  amountToRemove: BigNumber,
  keepWrapped: boolean,
  poolDataBefore: PoolInfoObject[],
  expectedPoolData: PoolInfoObject[],
  tokenDataBefore: PositionInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PositionInfoObject {
  const expected = { ...tokenDataBefore };

  return expected;
}

// ========= COVERS ========= //

export function calcExpectedCoverDataAfterOpenCover(
  amount: BigNumber,
  premiums: BigNumber,
  poolDataBefore: PoolInfoObject,
  expectedPoolData: PoolInfoObject,
  tokenDataBefore: CoverInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): CoverInfoObject {
  const expected = { ...tokenDataBefore };

  return expected;
}

export function calcExpectedCoverDataAfterUpdateCover(
  coverToAddAmount: BigNumber,
  coverToRemoveAmount: BigNumber,
  premiumsToAddAmount: BigNumber,
  premiumsToRemoveAmount: BigNumber,
  poolDataBefore: PoolInfoObject,
  expectedPoolData: PoolInfoObject,
  tokenDataBefore: CoverInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): CoverInfoObject {
  const expected = { ...tokenDataBefore };

  return expected;
}

export function calcExpectedCoverDataAfterInitiateClaim(
  amountClaimedAmount: BigNumber,
  poolDataBefore: PoolInfoObject,
  expectedPoolData: PoolInfoObject,
  tokenDataBefore: CoverInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): CoverInfoObject {
  const expected = { ...tokenDataBefore };

  return expected;
}

export function calcExpectedCoverDataAfterWithdrawCompensation(
  claimInfoBefore: ClaimInfoObject,
  poolDataBefore: PoolInfoObject,
  expectedPoolData: PoolInfoObject,
  tokenDataBefore: CoverInfoObject,
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): CoverInfoObject {
  const expected = { ...tokenDataBefore };

  return expected;
}
