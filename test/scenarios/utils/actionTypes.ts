// Types
import { SignerName } from "../../context";
import { ProtocolContracts } from "../../helpers/deployers";
import { TimeTravelOptions } from "../../helpers/hardhat";

type BaseAction = {
  userName: SignerName;
  expected: "revert" | "success";
  revertMessage?: string;
  timeTravel?: TimeTravelOptions;
};

type ActionGetTokens = BaseAction & {
  name: "getTokens";
  args: {
    tokenName: "ATEN" | "USDT";
    amount: number;
  };
};
type ActionApproveTokens = BaseAction & {
  name: "approveTokens";
  args: {
    spender: keyof ProtocolContracts;
    tokenName: "ATEN" | "USDT";
    amount: number;
  };
};
type ActionCreatePool = BaseAction & {
  name: "createPool";
  args: {
    paymentAsset: "USDT";
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
    coverAmount: number;
    premiumAmount: number;
  };
};
type ActionUpdateCover = BaseAction & {
  name: "updateCover";
  args: {
    coverId: number;
    coverToAdd: number;
    coverToRemove: number;
    premiumToAdd: number;
    premiumToRemove: number;
  };
};
type ActionOpenPosition = BaseAction & {
  name: "openPosition";
  args: {
    amount: number;
    isWrapped: boolean;
    poolIds: number[];
  };
};
type ActionAddLiquidity = BaseAction & {
  name: "addLiquidity";
  args: {
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
