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
import { Action } from "./actionTypes";
import { getTokenAddressBySymbol } from "../../helpers/protocol";

export type Story = {
  description: string;
  actions: Action[];
};

export type Scenario = {
  title: string;
  stories: Story[];
};

export async function executeAction(this: Mocha.Context, action: Action) {
  const { name, expected, userName, timeTravel, revertMessage, args } = action;
  const user = this.signers[userName];

  if (!expected) {
    throw Error(`An expected resut for action ${name} is required`);
  }
  if (!user) {
    throw Error(`Cannot find user ${userName} among context signers`);
  }

  switch (name) {
    case "getTokens":
      {
        const { tokenName, amount } = args;

        await getTokens(this, tokenName, user, amount);
      }
      break;
    case "approveTokens":
      {
        const { spender, tokenName, amount } = args;

        const spenderAddress = this.contracts[spender].address;

        await approveTokens(this, tokenName, user, spenderAddress, amount);
      }
      break;
    case "createPool":
      {
        const { paymentAsset, strategyId, compatiblePools } = args;

        getTokenAddressBySymbol(paymentAsset);

        const { poolFormula } = this.protocolConfig;

        const feeRate =
          args.feeRate !== undefined
            ? toRay(args.feeRate)
            : poolFormula.feeRate;
        const uOptimal =
          args.uOptimal !== undefined
            ? toRay(args.uOptimal)
            : poolFormula.uOptimal;
        const r0 = args.r0 !== undefined ? toRay(args.r0) : poolFormula.r0;
        const rSlope1 =
          args.rSlope1 !== undefined
            ? toRay(args.rSlope1)
            : poolFormula.rSlope1;
        const rSlope2 =
          args.rSlope2 !== undefined
            ? toRay(args.rSlope2)
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
        const { poolId, coverAmount, premiumAmount } = args;

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
        } = args;

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
        const { amount, isWrapped, poolIds } = args;

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
        const { positionId, amount, isWrapped } = args;

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
        const { positionId } = args;

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
        const { positionId } = args;

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
        const { positionId, amount, keepWrapped } = args;

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
        const { positionId } = args;

        await takeInterests(this, user, positionId, expected, timeTravel);
      }
      break;

    case "initiateClaim":
      {
        const { coverId, amountClaimed, ipfsMetaEvidenceCid, signature } = args;

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
        const { claimId } = args;

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
}
