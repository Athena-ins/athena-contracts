import { BigNumber } from "ethers";
import { LiquidityManager, ClaimManager } from "../../typechain";

export type FormattedPool = {
  poolId: number;
  feeRate: BigNumber;
  formula: {
    uOptimal: BigNumber;
    r0: BigNumber;
    rSlope1: BigNumber;
    rSlope2: BigNumber;
  };
  slot0: {
    tick: number;
    secondsPerTick: number;
    coveredCapital: BigNumber;
    lastUpdateTimestamp: number;
    liquidityIndex: BigNumber;
  };
  strategyId: number;
  strategyRewardRate: BigNumber;
  paymentAsset: string;
  underlyingAsset: string;
  wrappedAsset: string;
  isPaused: boolean;
  overlappedPools: number[];
  compensationIds: number[];
  overlappedCapital: BigNumber[];
  utilizationRate: BigNumber;
  totalLiquidity: BigNumber;
  availableLiquidity: BigNumber;
  strategyRewardIndex: BigNumber;
  lastOnchainUpdateTimestamp: number;
  ongoingClaims: number;
  premiumRate: BigNumber;
  liquidityIndexLead: BigNumber;
};

export type FormattedPosition = {
  positionId: number;
  supplied: BigNumber;
  suppliedWrapped: BigNumber;
  commitWithdrawalTimestamp: number;
  strategyRewardIndex: BigNumber;
  poolIds: number[];
  newUserCapital: BigNumber;
  newUserCapitalWrapped: BigNumber;
  coverRewards: BigNumber[];
  strategyRewards: BigNumber;
};

export type FormattedCover = {
  coverId: number;
  poolId: number;
  coverAmount: BigNumber;
  isActive: boolean;
  premiumsLeft: BigNumber;
  dailyCost: BigNumber;
  premiumRate: BigNumber;
  lastTick: number;
};

export enum ClaimStatusEnum {
  Initiated = 0,
  Accepted = 1, // Virtual status
  Compensated = 2,
  // Statuses below are only used when a claim is disputed
  Disputed = 3,
  Appealed = 4,
  RejectedByOverrule = 5,
  RejectedByCourtDecision = 6,
  AcceptedByCourtDecision = 7,
  CompensatedAfterDispute = 8,
  ProsecutionResolved = 9,
}

export type ClaimStatus =
  | "Initiated"
  | "Accepted"
  | "Compensated"
  | "Disputed"
  | "Appealed"
  | "RejectedByOverrule"
  | "RejectedByCourtDecision"
  | "AcceptedByCourtDecision"
  | "CompensatedAfterDispute"
  | "ProsecutionResolved";

export type DisputeSide = "RefusedToArbitrate" | "PayClaimant" | "RejectClaim";

export type RoundData = {
  // - 0 side for `RulingOptions.RefusedToArbitrate`.
  // - 1 side for `RulingOptions.PayClaimant`.
  // - 2 side for `RulingOptions.RejectClaim`.
  paidFees: [BigNumber, BigNumber, BigNumber];
  hasPaid: [boolean, boolean, boolean];
  fundedSides: number[];
  feeRewards: BigNumber;
};

export type FormattedClaim = {
  claimId: number;
  poolId: number;
  relatedClaimIds: number[];
  evidence: string[];
  counterEvidence: string[];
  coverAmount: BigNumber;
  isCoverActive: boolean;
  coverId: number;
  disputeId: number;
  metaEvidenceURI: string;
  status: number;
  ruling: number;
  createdAt: number;
  amount: BigNumber;
  claimant: string;
  prosecutor: string;
  deposit: BigNumber;
  collateral: BigNumber;
  rulingTimestamp: number;
  challengedTimestamp: number;
  appeals: number[];
  appealRounds: RoundData[];
  currentRuling: number;
};

export type PoolInfo =
  | Awaited<ReturnType<LiquidityManager["poolInfo"]>>
  | FormattedPool;
export type PositionInfo =
  | Awaited<ReturnType<LiquidityManager["positionInfo"]>>
  | FormattedPosition;
export type CoverInfo =
  | Awaited<ReturnType<LiquidityManager["coverInfo"]>>
  | FormattedCover;
export type ClaimInfo =
  | Awaited<ReturnType<ClaimManager["claimInfo"]>>
  | FormattedClaim;
