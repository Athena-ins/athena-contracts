import { expect } from "chai";
import { expectEqual } from "../../../helpers/chai/almostEqualState";
import {
  claimInfoFormat,
  coverInfoFormat,
  poolInfoFormat,
} from "../../../helpers/dataFormat";
import {
  convertToCurrencyDecimals,
  postTxHandler,
  setNextBlockTimestamp,
} from "../../../helpers/hardhat";
import {
  calcExpectedClaimDataAfterSubmitEvidence,
  //
  calcExpectedCoverDataAfterInitiateClaim,
  calcExpectedCoverDataAfterWithdrawCompensation,
  calcExpectedPoolDataAfterInitiateClaim,
  calcExpectedPoolDataAfterWithdrawCompensation,
} from "../../../helpers/utils/calculations";
import { getTxCostAndTimestamp, getContractsData } from "./helpers";
// Types
import { BigNumber, BigNumberish, Wallet } from "ethers";
import { TestEnv } from "../../../context";
import { TimeTravelOptions } from "../../../helpers/hardhat";

// ======= ACTIONS ======= //

export async function submitEvidenceForClaim(
  testEnv: TestEnv,
  user: Wallet,
  claimId: number,
  ipfsEvidenceCids: string[],
  party: "claimant" | "prosecutor",
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
) {
  const { ClaimManager, LiquidityManager } = testEnv.contracts;

  if (expectedResult === "success") {
    const claimInfoBefore = await ClaimManager.claimInfo(claimId).then((data) =>
      claimInfoFormat(data),
    );
    const tokenDataBefore = await LiquidityManager.coverInfo(
      claimInfoBefore.coverId,
    ).then((data) => coverInfoFormat(data));
    const poolDataBefore = await LiquidityManager.poolInfo(
      tokenDataBefore.poolId,
    ).then((data) => poolInfoFormat(data));

    const txResult = await postTxHandler(
      ClaimManager.connect(user).submitEvidenceForClaim(
        claimId,
        ipfsEvidenceCids,
      ),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: [poolDataAfter],
      tokenData: claimDataAfter,
      timestamp,
    } = await getContractsData(
      testEnv,
      [tokenDataBefore.poolId],
      claimId,
      "claim",
    );

    const expectedClaimData = calcExpectedClaimDataAfterSubmitEvidence(
      ipfsEvidenceCids,
      party,
      claimInfoBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(poolDataAfter, poolDataBefore);
    expectEqual(claimDataAfter, expectedClaimData);
  } else if (expectedResult === "revert") {
    await expect(
      ClaimManager.connect(user).submitEvidenceForClaim(
        claimId,
        ipfsEvidenceCids,
      ),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function initiateClaim(
  testEnv: TestEnv,
  user: Wallet,
  coverId: BigNumberish,
  tokenClaimed: string,
  amountClaimed: BigNumberish,
  ipfsMetaEvidenceCid: string,
  signature: string,
  valueSent: BigNumberish | undefined,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { LiquidityManager, ClaimManager } = testEnv.contracts;

  const amountClaimedAmount = await convertToCurrencyDecimals(
    tokenClaimed,
    amountClaimed,
  );

  const messageValue: BigNumberish =
    valueSent ||
    (await Promise.all([
      ClaimManager.claimCollateral(),
      ClaimManager.arbitrationCost(),
    ]).then((prices) =>
      prices.reduce((acc, el) => acc.add(el), BigNumber.from(0)),
    ));

  if (expectedResult === "success") {
    const tokenDataBefore = await LiquidityManager.coverInfo(coverId).then(
      (data) => coverInfoFormat(data),
    );
    const poolDataBefore = await LiquidityManager.poolInfo(
      tokenDataBefore.poolId,
    ).then((data) => poolInfoFormat(data));

    const txResult = await postTxHandler(
      ClaimManager.connect(user).initiateClaim(coverId, amountClaimedAmount, {
        value: messageValue,
      }),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: [poolDataAfter],
      tokenData: tokenDataAfter,
      timestamp,
    } = await getContractsData(
      testEnv,
      [tokenDataBefore.poolId],
      coverId,
      "cover",
    );

    const expectedPoolData = calcExpectedPoolDataAfterInitiateClaim(
      amountClaimedAmount,
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedCoverDataAfterInitiateClaim(
      amountClaimedAmount,
      poolDataBefore,
      expectedPoolData,
      tokenDataBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(tokenDataAfter, expectedTokenData);
  } else if (expectedResult === "revert") {
    await expect(
      ClaimManager.connect(user).initiateClaim(coverId, amountClaimedAmount, {
        value: messageValue,
      }),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function withdrawCompensation(
  testEnv: TestEnv,
  user: Wallet,
  claimId: number,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { ClaimManager } = testEnv.contracts;

  if (expectedResult === "success") {
    const claimInfoBefore = await ClaimManager.claimInfo(claimId).then((data) =>
      claimInfoFormat(data),
    );

    const {
      poolData: [poolDataBefore],
      tokenData: tokenDataBefore,
    } = await getContractsData(
      testEnv,
      [claimInfoBefore.poolId],
      claimInfoBefore.coverId,
      "cover",
    );

    const txResult = await postTxHandler(
      ClaimManager.connect(user).withdrawCompensation(claimId),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: [poolDataAfter],
      tokenData: tokenDataAfter,
      timestamp,
    } = await getContractsData(
      testEnv,
      [claimInfoBefore.poolId],
      claimInfoBefore.coverId,
      "cover",
    );

    const expectedPoolData = calcExpectedPoolDataAfterWithdrawCompensation(
      claimInfoBefore.amount,
      claimId,
      poolDataBefore,
      tokenDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedCoverDataAfterWithdrawCompensation(
      claimInfoBefore,
      poolDataBefore,
      expectedPoolData,
      tokenDataBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(tokenDataAfter, expectedTokenData);
  } else if (expectedResult === "revert") {
    await expect(
      ClaimManager.connect(user).withdrawCompensation(claimId),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function disputeClaim(
  testEnv: TestEnv,
  user: Wallet,
  claimId: number,
  valueSent: BigNumberish | undefined,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { ClaimManager, LiquidityManager } = testEnv.contracts;

  const messageValue: BigNumberish =
    valueSent || (await ClaimManager.arbitrationCost());

  if (expectedResult === "success") {
    const claimInfoBefore = await ClaimManager.claimInfo(claimId).then((data) =>
      claimInfoFormat(data),
    );
    const tokenDataBefore = await LiquidityManager.coverInfo(
      claimInfoBefore.coverId,
    ).then((data) => coverInfoFormat(data));
    const poolDataBefore = await LiquidityManager.poolInfo(
      tokenDataBefore.poolId,
    ).then((data) => poolInfoFormat(data));

 await postTxHandler(
      ClaimManager.connect(user).disputeClaim(claimId, {
        value: messageValue,
      }),
    );

 

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: [poolDataAfter],
      tokenData: tokenDataAfter,
      timestamp,
    } = await getContractsData(
      testEnv,
      [tokenDataBefore.poolId],
      claimInfoBefore.coverId,
      "cover",
    );

    expectEqual(poolDataAfter, poolDataBefore);
    if (!skipTokenCheck) expectEqual(tokenDataAfter, tokenDataBefore);
  } else if (expectedResult === "revert") {
    await expect(
      ClaimManager.connect(user).disputeClaim(claimId, {
        value: messageValue,
      }),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function rule(
  testEnv: TestEnv,
  user: Wallet,
  claimId: number,
  ruling: "RefusedToArbitrate" | "PayClaimant" | "RejectClaim",
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { ClaimManager, LiquidityManager } = testEnv.contracts;

  if (expectedResult === "success") {
    const claimInfoBefore = await ClaimManager.claimInfo(claimId).then((data) =>
      claimInfoFormat(data),
    );
    const tokenDataBefore = await LiquidityManager.coverInfo(
      claimInfoBefore.coverId,
    ).then((data) => coverInfoFormat(data));
    const poolDataBefore = await LiquidityManager.poolInfo(
      tokenDataBefore.poolId,
    ).then((data) => poolInfoFormat(data));

    let rulingValue: number;
    switch (ruling) {
      case "RefusedToArbitrate":
        rulingValue = 0;
        break;
      case "PayClaimant":
        rulingValue = 1;
        break;
      case "RejectClaim":
        rulingValue = 2;
        break;
    }

    const txResult = await postTxHandler(
      ClaimManager.connect(user).rule(claimId, rulingValue),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: [poolDataAfter],
      tokenData: tokenDataAfter,
      timestamp,
    } = await getContractsData(
      testEnv,
      [tokenDataBefore.poolId],
      claimInfoBefore.coverId,
      "cover",
    );

    // Additional checks based on ruling type could be added here
    if (!skipTokenCheck) {
      if (ruling === "PayClaimant") {
        // Add specific validation for PayClaimant case
      } else if (ruling === "RejectClaim") {
        // Add specific validation for RejectClaim case
      }
    }

    expectEqual(poolDataAfter, poolDataBefore);
    if (!skipTokenCheck) expectEqual(tokenDataAfter, tokenDataBefore);
  } else if (expectedResult === "revert") {
    let rulingValue: number;
    switch (ruling) {
      case "RefusedToArbitrate":
        rulingValue = 0;
        break;
      case "PayClaimant":
        rulingValue = 1;
        break;
      case "RejectClaim":
        rulingValue = 2;
        break;
    }

    await expect(
      ClaimManager.connect(user).rule(claimId, rulingValue),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function overrule(
  testEnv: TestEnv,
  user: Wallet,
  claimId: number,
  punish: boolean,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { ClaimManager, LiquidityManager } = testEnv.contracts;

  if (expectedResult === "success") {
    const claimInfoBefore = await ClaimManager.claimInfo(claimId).then((data) =>
      claimInfoFormat(data),
    );
    const tokenDataBefore = await LiquidityManager.coverInfo(
      claimInfoBefore.coverId,
    ).then((data) => coverInfoFormat(data));
    const poolDataBefore = await LiquidityManager.poolInfo(
      tokenDataBefore.poolId,
    ).then((data) => poolInfoFormat(data));

    const txResult = await postTxHandler(
      ClaimManager.connect(user).overrule(claimId, punish),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: [poolDataAfter],
      tokenData: tokenDataAfter,
      timestamp,
    } = await getContractsData(
      testEnv,
      [tokenDataBefore.poolId],
      claimInfoBefore.coverId,
      "cover",
    );

    // Additional checks could be added here based on punish parameter
    if (!skipTokenCheck && punish) {
      // Add specific validation for punish case
    }

    expectEqual(poolDataAfter, poolDataBefore);
    if (!skipTokenCheck) expectEqual(tokenDataAfter, tokenDataBefore);
  } else if (expectedResult === "revert") {
    await expect(
      ClaimManager.connect(user).overrule(claimId, punish),
    ).to.revertTransactionWith(revertMessage);
  }
}
