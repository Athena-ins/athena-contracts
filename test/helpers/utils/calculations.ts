import { constants } from "./poolRayMath";
// Types
import { BigNumberish, BigNumber } from "ethers";
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
    poolId,
    feeRate,
    formula: {
      uOptimal,
      r0,
      rSlope1,
      rSlope2,
    },
    slot0: {
      tick: 0,
      secondsPerTick: constants.MAX_SECONDS_PER_TICK,
      coveredCapital: BigNumber.from(0),
      remainingCovers: BigNumber.from(0),
      lastUpdateTimestamp: timestamp,
      liquidityIndex: BigNumber.from(0),
    },
    strategyId: BigNumber.from(strategyId),
    paymentAsset: paymentAsset.toLowerCase(),
    underlyingAsset: strategyTokens.underlying.toLowerCase(),
    wrappedAsset: strategyTokens.wrapped.toLowerCase(),
    isPaused: false,
    overlappedPools: [],
    compensationIds: [],
  };
}

export function calcExpectedPoolDataAfterOpenPosition(
  positionAmount: BigNumber,
  isWrapped: boolean,
  poolIds: number[],
  poolDataBefore: PoolInfoObject[],
  txTimestamp: BigNumber,
  timestamp: BigNumber,
): PoolInfoObject[] {
  const expected = structuredClone(poolDataBefore);

  return expected;
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
  const expected = { ...tokenDataBefore };

  return expected;
}

export function calcExpectedPositionDataAfterAddLiquidity(
  amountToAdd: BigNumber,
  isWrapped: boolean,
  poolIds: BigNumber[],
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
