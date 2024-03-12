// Types
import { SignerName } from "../../context";
import { ProtocolContracts } from "../../helpers/deployers";
import { TimeTravelOptions } from "../../helpers/hardhat";

type PoolTokenSymbols = "USDT" | "aUSDT" | "USDC" | "aUSDC";
type TokensSymbols = "ATEN" | PoolTokenSymbols;

type BaseAction = {
  userName: SignerName;
  expected: "revert" | "success";
  revertMessage?: string;
  timeTravel?: TimeTravelOptions;
};

type ActionWait = BaseAction & {
  userName: "deployer";
  name: "wait";
  timeTravel: TimeTravelOptions;
  expected: "success";
  revertMessage?: undefined;
  args: {};
};

type ActionGetTokens = BaseAction & {
  name: "getTokens";
  args: {
    tokenSymbol: TokensSymbols;
    amount: number;
  };
};
type ActionApproveTokens = BaseAction & {
  name: "approveTokens";
  args: {
    spender: keyof ProtocolContracts;
    tokenSymbol: TokensSymbols;
    amount: number;
  };
};
type ActionCreatePool = BaseAction & {
  name: "createPool";
  args: {
    paymentAssetSymbol: PoolTokenSymbols;
    strategyId: number;
    compatiblePools: number[];
    feeRate?: number;
    uOptimal?: number;
    r0?: number;
    rSlope1?: number;
    rSlope2?: number;
  };
};
type ActionOpenCover = BaseAction & {
  name: "openCover";
  args: {
    poolId: number;
    coverTokenSymbol: PoolTokenSymbols;
    coverAmount: number;
    premiumTokenSymbol: PoolTokenSymbols;
    premiumAmount: number;
  };
};
type ActionUpdateCover = BaseAction & {
  name: "updateCover";
  args: {
    coverId: number;
    coverTokenSymbol: PoolTokenSymbols;
    coverToAdd: number;
    coverToRemove: number;
    premiumTokenSymbol: PoolTokenSymbols;
    premiumToAdd: number;
    premiumToRemove: number | "maxUint";
  };
};
type ActionOpenPosition = BaseAction & {
  name: "openPosition";
  args: {
    tokenSymbol: TokensSymbols;
    amount: number;
    isWrapped: boolean;
    poolIds: number[];
  };
};
type ActionAddLiquidity = BaseAction & {
  name: "addLiquidity";
  args: {
    tokenSymbol: TokensSymbols;
    positionId: number;
    amount: number;
    isWrapped: boolean;
  };
};
type ActionCommitRemoveLiquidity = BaseAction & {
  name: "commitRemoveLiquidity";
  args: {
    positionId: number;
  };
};
type ActionUncommitRemoveLiquidity = BaseAction & {
  name: "uncommitRemoveLiquidity";
  args: {
    positionId: number;
  };
};
type ActionRemoveLiquidity = BaseAction & {
  name: "removeLiquidity";
  args: {
    positionId: number;
    tokenSymbol: TokensSymbols;
    amount: number;
    keepWrapped: boolean;
  };
};
type ActionTakeInterests = BaseAction & {
  name: "takeInterests";
  args: {
    positionId: number;
  };
};
type ActionInitiateClaim = BaseAction & {
  name: "initiateClaim";
  args: {
    coverId: number;
    tokenSymbol: TokensSymbols;
    amountClaimed: number;
    ipfsMetaEvidenceCid?: string;
    signature?: string;
    valueSent?: string;
  };
};
type ActionWithdrawCompensation = BaseAction & {
  name: "withdrawCompensation";
  args: {
    claimId: number;
  };
};

export type Action =
  | ActionWait
  | ActionGetTokens
  | ActionApproveTokens
  | ActionCreatePool
  | ActionOpenCover
  | ActionUpdateCover
  | ActionOpenPosition
  | ActionAddLiquidity
  | ActionCommitRemoveLiquidity
  | ActionUncommitRemoveLiquidity
  | ActionRemoveLiquidity
  | ActionTakeInterests
  | ActionInitiateClaim
  | ActionWithdrawCompensation;
