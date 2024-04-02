import { BigNumber } from "ethers";
import { LiquidityManager, ClaimManager } from "../../typechain";

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
    remainingCovers: BigNumber;
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

export type ClaimInfoObject = {
  claimant: string;
  coverId: number;
  poolId: number;
  claimId: number;
  disputeId: number;
  status: number;
  createdAt: number;
  amount: BigNumber;
  challenger: string;
  deposit: BigNumber;
  evidence: string[];
  counterEvidence: string[];
  metaEvidence: string;
  rulingTimestamp: number;
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
