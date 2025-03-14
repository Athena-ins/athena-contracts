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
