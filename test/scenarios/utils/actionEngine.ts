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
  const signer = this.signers[userName];

  const getTokenAddress = getTokenAddressBySymbol.bind(this);

  if (!expected) {
    throw Error(`An expected resut for action ${name} is required`);
  }
  if (!signer) {
    throw Error(`Cannot find signer ${userName} among context signers`);
  }

  console.log("name: ", name);
  switch (name) {
    case "getTokens":
      {
        const { tokenName, amount } = args;

        const assetAddress = getTokenAddress(tokenName);

        await getTokens(this, assetAddress, signer, amount);
      }
      break;
    case "approveTokens":
      {
        const { spender, tokenName, amount } = args;

        const spenderAddress = this.contracts[spender].address;
        const assetAddress = getTokenAddress(tokenName);

        await approveTokens(this, assetAddress, signer, spenderAddress, amount);
      }
      break;
    case "createPool":
      {
        const { paymentAsset, strategyId, compatiblePools } = args;

        const assetAddress = getTokenAddress(paymentAsset);
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
          signer,
          assetAddress,
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
          signer,
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
          signer,
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
          signer,
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
          signer,
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
          signer,
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
          signer,
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
          signer,
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

        await takeInterests(this, signer, positionId, expected, timeTravel);
      }
      break;

    case "initiateClaim":
      {
        const { coverId, amountClaimed, ipfsMetaEvidenceCid, signature } = args;

        await initiateClaim(
          this,
          signer,
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

        await withdrawCompensation(this, signer, claimId, expected, timeTravel);
      }
      break;

    default:
      throw `Invalid action requested: ${name}`;

    // case "disputeClaim":
    //   {
    //     await disputeClaim(this, signer);
    //   }
    //   break;

    // case "rule":
    //   {
    //     await rule(this, signer);
    //   }
    //   break;

    // case "overrule":
    //   {
    //     await overrule(this, signer);
    //   }
    //   break;
  }
}
