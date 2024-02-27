import { LiquidityManager, ClaimManager } from "../../typechain";
import {
  PoolInfoObject,
  PositionInfoObject,
  CoverInfoObject,
  ClaimInfoObject,
} from "./chai/almostEqualState";

export function poolInfoFormat(
  data: Awaited<ReturnType<LiquidityManager["poolInfo"]>>,
): PoolInfoObject {
  return {
    poolId: data.poolId.toNumber(),
    feeRate: data.feeRate,
    formula: {
      uOptimal: data.formula.uOptimal,
      r0: data.formula.r0,
      rSlope1: data.formula.rSlope1,
      rSlope2: data.formula.rSlope2,
    },
    slot0: {
      tick: data.slot0.tick,
      secondsPerTick: data.slot0.secondsPerTick.toNumber(),
      coveredCapital: data.slot0.coveredCapital,
      remainingCovers: data.slot0.remainingCovers,
      lastUpdateTimestamp: data.slot0.lastUpdateTimestamp.toNumber(),
      liquidityIndex: data.slot0.liquidityIndex,
    },
    strategyId: data.strategyId.toNumber(),
    paymentAsset: data.paymentAsset,
    underlyingAsset: data.underlyingAsset,
    wrappedAsset: data.wrappedAsset,
    isPaused: data.isPaused,
    overlappedPools: data.overlappedPools.map((val) => val.toNumber()),
    compensationIds: data.compensationIds.map((val) => val.toNumber()),
  };
}

export function positionInfoFormat(
  data: Awaited<ReturnType<LiquidityManager["positionInfo"]>>,
): PositionInfoObject {
  return {
    supplied: data.supplied,
    commitWithdrawalTimestamp: data.commitWithdrawalTimestamp.toNumber(),
    rewardIndex: data.rewardIndex,
    poolIds: data.poolIds.map((val) => val.toNumber()),
    newUserCapital: data.newUserCapital,
    coverRewards: data.coverRewards,
    strategyRewards: data.strategyRewards,
  };
}

export function coverInfoFormat(
  data: Awaited<ReturnType<LiquidityManager["coverInfo"]>>,
): CoverInfoObject {
  return {
    coverId: data.coverId.toNumber(),
    poolId: data.poolId.toNumber(),
    coverAmount: data.coverAmount,
    start: data.start.toNumber(),
    end: data.end.toNumber(),
    premiumsLeft: data.premiumsLeft,
    dailyCost: data.dailyCost,
    premiumRate: data.premiumRate,
  };
}

export function claimInfoFormat(
  data: Awaited<ReturnType<ClaimManager["claimInfo"]>>,
): ClaimInfoObject {
  return {
    claimant: data.claimant,
    coverId: data.coverId.toNumber(),
    poolId: data.poolId.toNumber(),
    claimId: data.claimId.toNumber(),
    disputeId: data.disputeId.toNumber(),
    status: data.status,
    createdAt: data.createdAt.toNumber(),
    amount: data.amount,
    challenger: data.challenger,
    deposit: data.deposit,
    evidence: data.evidence,
    counterEvidence: data.counterEvidence,
    metaEvidence: data.metaEvidence,
    rulingTimestamp: data.rulingTimestamp.toNumber(),
  };
}
