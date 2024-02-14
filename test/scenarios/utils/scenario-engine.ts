import { Wallet } from "ethers";
import { Context } from "mocha";
import {
  // liquidity
  openCover,
  updateCover,
  openPosition,
  addLiquidity,
  commitRemoveLiquidity,
  uncommitRemoveLiquidity,
  removeLiquidity,
  takeInterests,
  // claims
  initiateClaim,
  disputeClaim,
  rule,
  overrule,
  withdrawCompensation,
  // staking
  // farming
  // dao
} from "./actions";
import { SignerName } from "../../context";

export interface Action {
  name: string;
  userName: SignerName;
  args?: any;
  expected: string;
  revertMessage?: string;
}

export interface Story {
  description: string;
  actions: Action[];
}

export interface Scenario {
  title: string;
  description: string;
  stories: Story[];
}

export const executeStory = async (story: Story, testEnv: Context) => {
  for (const action of story.actions) {
    await executeAction(action, testEnv);
  }
};

const executeAction = async (action: Action, testEnv: Context) => {
  const { poolId, tokenId, claimId, poolIds } = action.args;
  const { name, expected, revertMessage, userName } = action;

  if (!name) throw "Action name is missing";
  if (!poolId && !tokenId && !claimId && !poolIds.length)
    throw `Invalid target for action ${name}`;
  if (!expected) throw `An expected resut for action ${name} is required`;

  const user = testEnv.signers[userName];
  if (!user) throw `Cannot find user ${userName} among context signers`;

  if (name === "openCover") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await openCover(user);
  } else if (name === "updateCover") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await updateCover(user);
  } else if (name === "openPosition") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await openPosition(user);
  } else if (name === "addLiquidity") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await addLiquidity(user);
  } else if (name === "commitRemoveLiquidity") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await commitRemoveLiquidity(user);
  } else if (name === "uncommitRemoveLiquidity") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await uncommitRemoveLiquidity(user);
  } else if (name === "removeLiquidity") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await removeLiquidity(user);
  } else if (name === "takeInterests") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await takeInterests(user);
  } else if (name === "initiateClaim") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await initiateClaim(user);
  } else if (name === "disputeClaim") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await disputeClaim(user);
  } else if (name === "rule") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await rule(user);
  } else if (name === "overrule") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await overrule(user);
  } else if (name === "withdrawCompensation") {
    const target = poolId;
    const { amount } = action.args;
    if (!amount) throw `Invalid amount of ${target} to mint`;

    await withdrawCompensation(user);
  } else {
    throw `Invalid action requested: ${name}`;
  }
};
