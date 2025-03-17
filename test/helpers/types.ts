import { BigNumber } from "ethers";
import { LiquidityManager, ClaimManager } from "../../typechain";

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
  | "ProsecutorPaid";

export type PoolInfoObject = {
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

export type PositionInfoObject = {
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

export type CoverInfoObject = {
  coverId: number;
  poolId: number;
  coverAmount: BigNumber;
  isActive: boolean;
  premiumsLeft: BigNumber;
  dailyCost: BigNumber;
  premiumRate: BigNumber;
  lastTick: number;
};

export type AppealDataObject = {
  appealTimestamp: number;
  appellant: string;
};

export type ClaimInfoObject = {
  claimant: string;
  coverId: number;
  poolId: number;
  claimId: number;
  disputeId: number;
  status: number;
  createdAt: number;
  amount: BigNumber;
  prosecutor: string;
  deposit: BigNumber;
  collateral: BigNumber;
  evidence: string[];
  counterEvidence: string[];
  metaEvidenceURI: string;
  rulingTimestamp: number;
  appeals: AppealDataObject[];
};

export type PoolInfo =
  | Awaited<ReturnType<LiquidityManager["poolInfo"]>>
  | PoolInfoObject;
export type PositionInfo =
  | Awaited<ReturnType<LiquidityManager["positionInfo"]>>
  | PositionInfoObject;
export type CoverInfo =
  | Awaited<ReturnType<LiquidityManager["coverInfo"]>>
  | CoverInfoObject;
export type ClaimInfo =
  | Awaited<ReturnType<ClaimManager["claimInfo"]>>
  | ClaimInfoObject;
