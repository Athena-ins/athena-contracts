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
// Types
import { SignerName } from "../../context";
import { TimeTravelOptions } from "../../helpers/hardhat";

type BaseAction = {
  userName: SignerName;
  expected: string;
  timeTravel?: TimeTravelOptions;
  revertMessage?: string;
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
