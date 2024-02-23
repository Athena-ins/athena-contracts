import {
  getTokens,
  approveTokens,
  createPool,
  openPosition,
  addLiquidity,
  commitRemoveLiquidity,
  uncommitRemoveLiquidity,
  takeInterests,
  removeLiquidity,
  openCover,
  updateCover,
  initiateClaim,
  withdrawCompensation,
  // disputeClaim,
  // rule,
  // overrule,
  //
  // need dao, farming, staking, claim
} from "./actions";
import { toRay } from "../../helpers/utils/poolRayMath";
// Types
import { SignerName } from "../../context";
import { TimeTravelOptions } from "../../helpers/hardhat";
import { getTokenAddressBySymbol } from "../../helpers/protocol";
import { ProtocolContracts } from "../../helpers/deployers";

type BaseAction = {
  userName: SignerName;
  expected: string;
  timeTravel?: TimeTravelOptions;
  revertMessage?: string;
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
    ipfsMetaEvidenceCid: string;
    signature: string;
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

export type Story = {
  description: string;
  actions: Action[];
};

export type Scenario = {
  title: string;
  stories: Story[];
};

export async function executeStory(story: Story) {
  const title = `Scenario: ${story.description}`;

  describe(title, async function () {
    for (const action of story.actions) {
      await executeAction(action);
    }
  });
}

async function executeAction(action: Action) {
  const { name, expected, userName, timeTravel } = action;

  const title = `${userName} should ${name} expecting ${expected}`;

  it(title, async function () {
    if (!expected)
      throw Error(`An expected resut for action ${name} is required`);

    const user = this.signers[userName];
    if (!user)
      throw Error(`Cannot find user ${userName} among context signers`);

    if (name === "openCover") action.args;

    switch (name) {
      case "getTokens":
        {
          const { tokenName, amount } = action.args;

          await getTokens(this, tokenName, user, amount);
        }
        break;
      case "approveTokens":
        {
          const { spender, tokenName, amount } = action.args;

          const spenderAddress = this.contracts[spender].address;

          await approveTokens(this, tokenName, user, spenderAddress, amount);
        }
        break;
      case "createPool":
        {
          const { paymentAsset, strategyId, compatiblePools } = action.args;

          getTokenAddressBySymbol(paymentAsset);

          const { poolFormula } = this.protocolConfig;

          const feeRate =
            action.args.feeRate !== undefined
              ? toRay(action.args.feeRate)
              : poolFormula.feeRate;
          const uOptimal =
            action.args.uOptimal !== undefined
              ? toRay(action.args.uOptimal)
              : poolFormula.uOptimal;
          const r0 =
            action.args.r0 !== undefined
              ? toRay(action.args.r0)
              : poolFormula.r0;
          const rSlope1 =
            action.args.rSlope1 !== undefined
              ? toRay(action.args.rSlope1)
              : poolFormula.rSlope1;
          const rSlope2 =
            action.args.rSlope2 !== undefined
              ? toRay(action.args.rSlope2)
              : poolFormula.rSlope2;

          await createPool(
            this,
            paymentAsset,
            strategyId,
            feeRate,
            uOptimal,
            r0,
            rSlope1,
            rSlope2,
            compatiblePools,
            expected,
          );
        }
        break;
      case "openCover":
        {
          const { poolId, coverAmount, premiumAmount } = action.args;

          await openCover(
            this,
            user,
            poolId,
            coverAmount,
            premiumAmount,
            expected,
            timeTravel,
          );
        }
        break;

      case "updateCover":
        {
          const {
            coverId,
            coverToAdd,
            coverToRemove,
            premiumToAdd,
            premiumToRemove,
          } = action.args;

          await updateCover(
            this,
            user,
            coverId,
            coverToAdd,
            coverToRemove,
            premiumToAdd,
            premiumToRemove,
            expected,
            timeTravel,
          );
        }
        break;

      case "openPosition":
        {
          const { amount, isWrapped, poolIds } = action.args;

          await openPosition(
            this,
            user,
            amount,
            isWrapped,
            poolIds,
            expected,
            timeTravel,
          );
        }
        break;

      case "addLiquidity":
        {
          const { positionId, amount, isWrapped } = action.args;

          await addLiquidity(
            this,
            user,
            positionId,
            amount,
            isWrapped,
            expected,
            timeTravel,
          );
        }
        break;

      case "commitRemoveLiquidity":
        {
          const { positionId } = action.args;

          await commitRemoveLiquidity(
            this,
            user,
            positionId,
            expected,
            timeTravel,
          );
        }
        break;

      case "uncommitRemoveLiquidity":
        {
          const { positionId } = action.args;

          await uncommitRemoveLiquidity(
            this,
            user,
            positionId,
            expected,
            timeTravel,
          );
        }
        break;

      case "removeLiquidity":
        {
          const { positionId, amount, keepWrapped } = action.args;

          await removeLiquidity(
            this,
            user,
            positionId,
            amount,
            keepWrapped,
            expected,
            timeTravel,
          );
        }
        break;

      case "takeInterests":
        {
          const { positionId } = action.args;

          await takeInterests(this, user, positionId, expected, timeTravel);
        }
        break;

      case "initiateClaim":
        {
          const { coverId, amountClaimed, ipfsMetaEvidenceCid, signature } =
            action.args;

          await initiateClaim(
            this,
            user,
            coverId,
            amountClaimed,
            ipfsMetaEvidenceCid,
            signature,
            expected,
            timeTravel,
          );
        }
        break;

      case "withdrawCompensation":
        {
          const { claimId } = action.args;

          await withdrawCompensation(this, user, claimId, expected, timeTravel);
        }
        break;

      default:
        throw `Invalid action requested: ${name}`;

      // case "disputeClaim":
      //   {
      //     await disputeClaim(this, user);
      //   }
      //   break;

      // case "rule":
      //   {
      //     await rule(this, user);
      //   }
      //   break;

      // case "overrule":
      //   {
      //     await overrule(this, user);
      //   }
      //   break;
    }
  });
}
