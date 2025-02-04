import {
  waitFor,
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
import {
  getTestingCidAndSig,
  getTokenAddressBySymbol,
} from "../../helpers/protocol";
import { toRay } from "../../helpers/utils/poolRayMath";
// Types
import { Action } from "./actionTypes";

export type Story = {
  description: string;
  actions: Action[];
};

export type Scenario = {
  title: string;
  stories: Story[];
};

export async function executeAction(this: Mocha.Context, action: Action) {
  //======= WAIT ACTION =======//
  if (action.name === "wait") {
    return await waitFor(action.timeTravel);
  }

  const {
    name,
    expected,
    userName,
    timeTravel,
    revertMessage,
    args,
    skipTokenCheck,
  } = action;

  const signer = this.signers[userName];

  if (!expected) {
    throw Error(`An expected resut for action ${name} is required`);
  }
  if (!signer) {
    throw Error(`Cannot find signer ${userName} among context signers`);
  }

  switch (name) {
    //=====================================//
    //======= TOKEN/POOL MANAGEMENT =======//
    //=====================================//

    case "getTokens": {
      const { tokenSymbol, amount } = args;

      await getTokens(this, tokenSymbol, signer, amount);

      break;
    }

    case "approveTokens": {
      const { spender, tokenSymbol, amount } = args;

      const spenderAddress = this.contracts?.[spender]?.address;
      if (!spenderAddress)
        throw Error(`Cannot find spender ${spender} among context contracts`);

      await approveTokens(this, tokenSymbol, signer, spenderAddress, amount);

      break;
    }

    case "createPool": {
      const { paymentAssetSymbol, strategyId, compatiblePools } = args;
      const { poolFormula } = this.protocolConfig;

      const paymentAsset = getTokenAddressBySymbol(
        this.contracts,
        paymentAssetSymbol,
        this.chainId,
      );

      const feeRate =
        args.feeRate !== undefined ? toRay(args.feeRate) : poolFormula.feeRate;
      const uOptimal =
        args.uOptimal !== undefined
          ? toRay(args.uOptimal)
          : poolFormula.uOptimal;
      const r0 = args.r0 !== undefined ? toRay(args.r0) : poolFormula.r0;
      const rSlope1 =
        args.rSlope1 !== undefined ? toRay(args.rSlope1) : poolFormula.rSlope1;
      const rSlope2 =
        args.rSlope2 !== undefined ? toRay(args.rSlope2) : poolFormula.rSlope2;

      await createPool(
        this,
        signer,
        paymentAsset,
        strategyId,
        feeRate,
        uOptimal,
        r0,
        rSlope1,
        rSlope2,
        compatiblePools,
        expected,
        revertMessage,
      );

      break;
    }

    //================================//
    //======= COVER MANAGEMENT =======//
    //================================//

    case "openCover": {
      const {
        poolId,
        coverTokenSymbol,
        coverAmount,
        premiumTokenSymbol,
        premiumAmount,
      } = args;

      const coverToken = getTokenAddressBySymbol(
        this.contracts,
        coverTokenSymbol,
        this.chainId,
      );

      const premiumToken = getTokenAddressBySymbol(
        this.contracts,
        premiumTokenSymbol,
        this.chainId,
      );

      await openCover(
        this,
        signer,
        poolId,
        coverToken,
        coverAmount,
        premiumToken,
        premiumAmount,
        expected,
        revertMessage,
        timeTravel,
        skipTokenCheck,
      );

      break;
    }

    case "updateCover": {
      const {
        coverId,
        coverTokenSymbol,
        coverToAdd,
        coverToRemove,
        premiumTokenSymbol,
        premiumToAdd,
        premiumToRemove,
      } = args;

      const coverToken = getTokenAddressBySymbol(
        this.contracts,
        coverTokenSymbol,
        this.chainId,
      );

      const premiumToken = getTokenAddressBySymbol(
        this.contracts,
        premiumTokenSymbol,
        this.chainId,
      );

      await updateCover(
        this,
        signer,
        coverId,
        coverToken,
        coverToAdd,
        coverToRemove,
        premiumToken,
        premiumToAdd,
        premiumToRemove,
        expected,
        revertMessage,
        timeTravel,
        skipTokenCheck,
      );

      break;
    }

    //===================================//
    //======= POSITION MANAGEMENT =======//
    //===================================//

    case "openPosition": {
      const { amount, tokenSymbol, isWrapped, poolIds } = args;

      const depositToken = getTokenAddressBySymbol(
        this.contracts,
        tokenSymbol,
        this.chainId,
      );

      await openPosition(
        this,
        signer,
        depositToken,
        amount,
        isWrapped,
        poolIds,
        expected,
        revertMessage,
        timeTravel,
        skipTokenCheck,
      );

      break;
    }

    case "addLiquidity": {
      const { positionId, tokenSymbol, amount, isWrapped } = args;

      const depositToken = getTokenAddressBySymbol(
        this.contracts,
        tokenSymbol,
        this.chainId,
      );

      await addLiquidity(
        this,
        signer,
        positionId,
        depositToken,
        amount,
        isWrapped,
        expected,
        revertMessage,
        timeTravel,
        skipTokenCheck,
      );

      break;
    }

    case "commitRemoveLiquidity": {
      const { positionId } = args;

      await commitRemoveLiquidity(
        this,
        signer,
        positionId,
        expected,
        revertMessage,
        timeTravel,
        skipTokenCheck,
      );

      break;
    }

    case "uncommitRemoveLiquidity": {
      const { positionId } = args;

      await uncommitRemoveLiquidity(
        this,
        signer,
        positionId,
        expected,
        revertMessage,
        timeTravel,
        skipTokenCheck,
      );

      break;
    }

    case "removeLiquidity": {
      const { positionId, tokenSymbol, amount, keepWrapped } = args;

      const withdrawnToken = getTokenAddressBySymbol(
        this.contracts,
        tokenSymbol,
        this.chainId,
      );

      await removeLiquidity(
        this,
        signer,
        positionId,
        withdrawnToken,
        amount,
        keepWrapped,
        expected,
        revertMessage,
        timeTravel,
        skipTokenCheck,
      );

      break;
    }

    case "takeInterests": {
      const { positionId } = args;

      await takeInterests(
        this,
        signer,
        positionId,
        expected,
        revertMessage,
        timeTravel,
        skipTokenCheck,
      );

      break;
    }

    //================================//
    //======= CLAIM MANAGEMENT =======//
    //================================//

    case "initiateClaim": {
      const {
        coverId,
        tokenSymbol,
        amountClaimed,
        ipfsMetaEvidenceCid,
        signature,
        valueSent,
      } = args;

      // @dev Remove usage of signature authentication
      const { ipfsCid, cidSignature } =
        await getTestingCidAndSig(ipfsMetaEvidenceCid);

      const tokenClaimed = getTokenAddressBySymbol(
        this.contracts,
        tokenSymbol,
        this.chainId,
      );

      await initiateClaim(
        this,
        signer,
        coverId,
        tokenClaimed,
        amountClaimed,
        ipfsCid ?? ipfsMetaEvidenceCid,
        cidSignature ?? signature,
        valueSent,
        expected,
        revertMessage,
        timeTravel,
        skipTokenCheck,
      );

      break;
    }

    case "withdrawCompensation": {
      const { claimId } = args;

      await withdrawCompensation(
        this,
        signer,
        claimId,
        expected,
        revertMessage,
        timeTravel,
        skipTokenCheck,
      );

      break;
    }

    default: {
      throw `Invalid action requested: ${name}`;
    }
  }
}
