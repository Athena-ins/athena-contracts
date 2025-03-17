import { LiquidityManager, ClaimManager } from "../../typechain";
import {
  PoolInfoObject,
  PositionInfoObject,
  CoverInfoObject,
  ClaimInfoObject,
  ClaimStatus,
} from "./types";

const claimStatusIndex = {
  0: "Initiated",
  // Virtual status
  1: "Accepted",
  2: "Compensated",
  // Statuses below are only used when a claim is disputed
  3: "Disputed",
  4: "Appealed",
  5: "RejectedByOverrule",
  6: "RejectedByCourtDecision",
  7: "AcceptedByCourtDecision",
  8: "CompensatedAfterDispute",
  9: "ProsecutorPaid",
} as const;

export function getClaimStatus(index: number): ClaimStatus {
  const status = claimStatusIndex[index as keyof typeof claimStatusIndex];
  if (!status) throw new Error(`Unknown claim status: ${index}`);

  return status;
}

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
      lastUpdateTimestamp: data.slot0.lastUpdateTimestamp.toNumber(),
      liquidityIndex: data.slot0.liquidityIndex,
    },
    strategyId: data.strategyId.toNumber(),
    strategyRewardRate: data.strategyRewardRate,
    paymentAsset: data.paymentAsset.toLowerCase(),
    underlyingAsset: data.underlyingAsset.toLowerCase(),
    wrappedAsset: data.wrappedAsset.toLowerCase(),
    isPaused: data.isPaused,
    overlappedPools: data.overlappedPools.map((val) => val.toNumber()),
    compensationIds: data.compensationIds.map((val) => val.toNumber()),
    overlappedCapital: data.overlappedCapital,
    utilizationRate: data.utilizationRate,
    totalLiquidity: data.totalLiquidity,
    availableLiquidity: data.availableLiquidity,
    strategyRewardIndex: data.strategyRewardIndex,
    lastOnchainUpdateTimestamp: data.lastOnchainUpdateTimestamp.toNumber(),
    ongoingClaims: data.ongoingClaims.toNumber(),
    premiumRate: data.premiumRate,
    liquidityIndexLead: data.liquidityIndexLead,
  };
}

export function positionInfoFormat(
  data: Awaited<ReturnType<LiquidityManager["positionInfo"]>>,
): PositionInfoObject {
  return {
    positionId: data.positionId.toNumber(),
    supplied: data.supplied,
    suppliedWrapped: data.supplied,
    commitWithdrawalTimestamp: data.commitWithdrawalTimestamp.toNumber(),
    strategyRewardIndex: data.strategyRewardIndex,
    poolIds: data.poolIds.map((val) => val.toNumber()),
    newUserCapital: data.newUserCapital,
    newUserCapitalWrapped: data.newUserCapitalWrapped,
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
    isActive: data.isActive,
    premiumsLeft: data.premiumsLeft,
    dailyCost: data.dailyCost,
    premiumRate: data.premiumRate,
    lastTick: data.lastTick,
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
    prosecutor: data.prosecutor,
    deposit: data.deposit,
    collateral: data.collateral,
    evidence: data.evidence,
    counterEvidence: data.counterEvidence,
    metaEvidenceURI: data.metaEvidenceURI,
    rulingTimestamp: data.rulingTimestamp.toNumber(),
    appeals: data.appeals.map((val) => val.toNumber()),
  };
}
