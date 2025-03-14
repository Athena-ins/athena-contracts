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

export function calcExpectedCoverDataAfterSubmitEvidence(
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
  const expect = {
    coverId: tokenDataBefore.coverId,
    poolId: tokenDataBefore.poolId,
    isActive: true,
  } as CoverInfoObject;

  const claimAmount = claimInfoBefore.amount;

  // If the claimed amount is the total cover or if the pool is overutilized
  const shouldCloseCover =
    claimAmount.eq(tokenDataBefore.coverAmount) ||
    poolDataBefore.totalLiquidity.lt(poolDataBefore.slot0.coveredCapital);

  if (shouldCloseCover) {
    // If we close the cover we do not reduce the cover amount
    expect.coverAmount = tokenDataBefore.coverAmount;
    expect.premiumRate = BigNumber.from(0);
    expect.dailyCost = BigNumber.from(0);
    expect.premiumsLeft = BigNumber.from(0);
    expect.isActive = false;
    expect.lastTick = poolDataBefore.slot0.tick - 1;
  } else {
    expect.coverAmount = tokenDataBefore.coverAmount.sub(claimAmount);

    expect.premiumRate = getPremiumRate(
      expectedPoolData,
      expectedPoolData.utilizationRate,
    );

    const { newPremiumRate: beginPremiumRate } = updatedPremiumRate(
      expectedPoolData,
      0,
      0,
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

    expect.premiumsLeft = tokenDataBefore.premiumsLeft.sub(premiumsSpent);

    const durationInSeconds = RayInt.from(
      expect.premiumsLeft.mul(constants.YEAR).mul(constants.PERCENTAGE_BASE),
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

export function calcExpectedCoverDataAfterDisputeClaim(
  tokenDataBefore: CoverInfoObject,
  txTimestamp: number,
  timestamp: number,
): CoverInfoObject {
  // Cover data remains unchanged after dispute
  return tokenDataBefore;
}

export function calcExpectedCoverDataAfterRuleClaim(
  tokenDataBefore: CoverInfoObject,
  txTimestamp: number,
  timestamp: number,
): CoverInfoObject {
  // Cover data remains unchanged after ruling until compensation is withdrawn
  return tokenDataBefore;
}

export function calcExpectedCoverDataAfterOverruleRuling(
  tokenDataBefore: CoverInfoObject,
  txTimestamp: number,
  timestamp: number,
): CoverInfoObject {
  // Cover data remains unchanged after overrule
  return tokenDataBefore;
}

export function calcExpectedCoverDataAfterAppeal(
  tokenDataBefore: CoverInfoObject,
  txTimestamp: number,
  timestamp: number,
): CoverInfoObject {
  // Cover data remains unchanged after appeal
  return tokenDataBefore;
}

export function calcExpectedCoverDataAfterWithdrawProsecutionReward(
  tokenDataBefore: CoverInfoObject,
  txTimestamp: number,
  timestamp: number,
): CoverInfoObject {
  // Cover data remains unchanged after prosecutor reward withdrawal
  return tokenDataBefore;
}
