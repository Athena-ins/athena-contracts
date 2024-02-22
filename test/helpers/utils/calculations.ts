import { rayMath } from "./poolRayMath";
import { BigNumberish, BigNumber } from "ethers";

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
) {
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
      secondsPerTick: rayMath.constants.MAX_SECONDS_PER_TICK,
      coveredCapital: BigNumber.from(0),
      remainingCovers: BigNumber.from(0),
      lastUpdateTimestamp: timestamp,
      liquidityIndex: BigNumber.from(0),
    },
    strategyId: BigNumber.from(strategyId),
    paymentAsset,
    underlyingAsset: strategyTokens.underlying,
    wrappedAsset: strategyTokens.wrapped,
    isPaused: false,
    overlappedPools: [],
    compensationIds: [],
  };
}

// export async function calcExpectedPoolDataAfterOpenCover() {}
// export async function calcExpectedPoolDataAfterOpenPosition() {}
// export async function calcExpectedPoolDataAfterAddLiquidity() {}
// export async function calcExpectedPoolDataAfterCommitRemoveLiquidity() {}
// export async function calcExpectedPoolDataAfterUncommitRemoveLiquidity() {}
// export async function calcExpectedPoolDataAfterTakeInterests() {}
// export async function calcExpectedPoolDataAfterRemoveLiquidity() {}
// export async function calcExpectedPoolDataAfterUpdateCover() {}
// export async function calcExpectedPoolDataAfterWithdrawCompensation() {}
// export async function calcExpectedPoolDataAfterInitiateClaim() {}

// export async function calcExpectedCoverDataAfterOpenCover() {}
// export async function calcExpectedCoverDataAfterUpdateCover() {}
// export async function calcExpectedCoverDataAfterWithdrawCompensation() {}
// export async function calcExpectedCoverDataAfterInitiateClaim() {}

// export async function calcExpectedPositionDataAfterOpenPosition() {}
// export async function calcExpectedPositionDataAfterAddLiquidity() {}
// export async function calcExpectedPositionDataAfterCommitRemoveLiquidity() {}
// export async function calcExpectedPositionDataAfterUncommitRemoveLiquidity() {}
// export async function calcExpectedPositionDataAfterTakeInterests() {}
// export async function calcExpectedPositionDataAfterRemoveLiquidity() {}
