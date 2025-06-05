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
  calcExpectedClaimDataAfterInitiateClaim,
  calcExpectedClaimDataAfterWithdrawCompensation,
  calcExpectedClaimDataAfterDisputeClaim,
  calcExpectedClaimDataAfterCourtRuling,
  calcExpectedClaimDataAfterExecuteRuling,
  calcExpectedClaimDataAfterOverrule,
  calcExpectedClaimDataAfterFundAppeal,
  calcExpectedClaimDataAfterResolveProsecution,
  //
  calcExpectedCoverDataAfterSubmitEvidence,
  calcExpectedCoverDataAfterInitiateClaim,
  calcExpectedCoverDataAfterWithdrawCompensation,
  calcExpectedCoverDataAfterDisputeClaim,
  calcExpectedCoverDataAfterCourtRuling,
  calcExpectedCoverDataAfterExecuteRuling,
  calcExpectedCoverDataAfterOverrule,
  calcExpectedCoverDataAfterFundAppeal,
  calcExpectedCoverDataAfterResolveProsecution,
  //
  calcExpectedPoolDataAfterSubmitEvidence,
  calcExpectedPoolDataAfterInitiateClaim,
  calcExpectedPoolDataAfterWithdrawCompensation,
  calcExpectedPoolDataAfterDisputeClaim,
  calcExpectedPoolDataAfterCourtRuling,
  calcExpectedPoolDataAfterExecuteRuling,
  calcExpectedPoolDataAfterOverrule,
  calcExpectedPoolDataAfterFundAppeal,
  calcExpectedPoolDataAfterResolveProsecution,
} from "../../../helpers/calculations";
import { getTxCostAndTimestamp, getEntityData } from "./helpers";
// Types
import { BigNumber, BigNumberish, Wallet } from "ethers";
import { TestEnv } from "../../../context";
import { DisputeSide } from "../../../helpers/types";
import { TimeTravelOptions } from "../../../helpers/hardhat";

// ======= ACTIONS ======= //

export async function executeRuling(
  testEnv: TestEnv,
  user: Wallet,
  disputeId: number,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { ClaimManager, LiquidityManager, AthenaArbitrator } =
    testEnv.contracts;

  if (expectedResult === "success") {
    const claimId = await ClaimManager.disputeIdToClaimId(disputeId);
    const claimInfoBefore = await ClaimManager.claimInfo(claimId).then((data) =>
      claimInfoFormat(data),
    );

    const coverDataBefore = await LiquidityManager.coverInfo(
      claimInfoBefore.coverId,
    ).then((data) => coverInfoFormat(data));
    const poolDataBefore = await LiquidityManager.poolInfo(
      coverDataBefore.poolId,
    ).then((data) => poolInfoFormat(data));

    // Execute the ruling to finalize it
    const txResult = await postTxHandler(
      (AthenaArbitrator as any).connect(user).executeRuling(disputeId),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: [poolDataAfter],
      entityDatas: [coverDataAfter, claimDataAfter],
      timestamp,
    } = await getEntityData(
      testEnv,
      [claimInfoBefore.poolId],
      [
        { id: claimInfoBefore.coverId, type: "cover" },
        { id: claimId, type: "claim" },
      ],
    );

    const expectedClaimData = calcExpectedClaimDataAfterExecuteRuling(
      claimInfoBefore,
      txTimestamp,
      timestamp,
    );

    const expectedPoolData = calcExpectedPoolDataAfterExecuteRuling(
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedCoverData = calcExpectedCoverDataAfterExecuteRuling(
      coverDataBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(claimDataAfter, expectedClaimData);
    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(coverDataAfter, expectedCoverData);
  } else if (expectedResult === "revert") {
    await expect(
      (AthenaArbitrator as any).connect(user).executeRuling(disputeId),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function submitEvidenceForClaim(
  testEnv: TestEnv,
  user: Wallet,
  claimId: number,
  ipfsEvidenceCids: string[],
  party: "claimant" | "prosecutor",
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
    const coverDataBefore = await LiquidityManager.coverInfo(
      claimInfoBefore.coverId,
    ).then((data) => coverInfoFormat(data));
    const poolDataBefore = await LiquidityManager.poolInfo(
      coverDataBefore.poolId,
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
      entityDatas: [claimDataAfter, coverDataAfter],
      timestamp,
    } = await getEntityData(
      testEnv,
      [coverDataBefore.poolId],
      [
        { id: claimId, type: "claim" },
        { id: claimInfoBefore.coverId, type: "cover" },
      ],
    );

    const expectedClaimData = calcExpectedClaimDataAfterSubmitEvidence(
      ipfsEvidenceCids,
      party,
      claimInfoBefore,
      txTimestamp,
      timestamp,
    );
    const expectedPoolData = calcExpectedPoolDataAfterSubmitEvidence(
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );
    const expectedCoverData = calcExpectedCoverDataAfterSubmitEvidence(
      expectedPoolData,
      coverDataBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(poolDataAfter, expectedPoolData);
    expectEqual(claimDataAfter, expectedClaimData);
    if (!skipTokenCheck) expectEqual(coverDataAfter, expectedCoverData);
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
  coverId: number,
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

  const [arbitrationCost, claimCollateral] = valueSent
    ? [BigNumber.from(valueSent), BigNumber.from(0)]
    : await Promise.all([
        ClaimManager.arbitrationCost(),
        ClaimManager.claimCollateral(),
      ]);

  const messageValue = arbitrationCost.add(claimCollateral);

  if (expectedResult === "success") {
    const coverDataBefore = await LiquidityManager.coverInfo(coverId).then(
      (data) => coverInfoFormat(data),
    );
    const poolDataBefore = await LiquidityManager.poolInfo(
      coverDataBefore.poolId,
    ).then((data) => poolInfoFormat(data));

    const expectedClaimId = Number(await ClaimManager.nextClaimId());
    const metaEvidenceURI = await ClaimManager.metaEvidenceURI(expectedClaimId);
    const relatedClaimIds =
      await ClaimManager.coverIdToClaimIds(expectedClaimId);

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
      entityDatas: [claimDataAfter, coverDataAfter],
      timestamp,
    } = await getEntityData(
      testEnv,
      [coverDataBefore.poolId],
      [
        { id: expectedClaimId, type: "claim" },
        { id: coverId, type: "cover" },
      ],
    );

    const expectedClaimData = calcExpectedClaimDataAfterInitiateClaim(
      amountClaimedAmount,
      coverId,
      expectedClaimId,
      metaEvidenceURI,
      relatedClaimIds,
      poolDataBefore,
      coverDataAfter,
      user.address,
      messageValue,
      claimCollateral,
      txTimestamp,
      timestamp,
    );
    const expectedPoolData = calcExpectedPoolDataAfterInitiateClaim(
      amountClaimedAmount,
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );
    const expectedCoverData = calcExpectedCoverDataAfterInitiateClaim(
      amountClaimedAmount,
      poolDataBefore,
      expectedPoolData,
      coverDataBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(poolDataAfter, expectedPoolData);
    expectEqual(claimDataAfter, expectedClaimData);
    if (!skipTokenCheck) expectEqual(coverDataAfter, expectedCoverData);
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
  const { ClaimManager, LiquidityManager } = testEnv.contracts;

  if (expectedResult === "success") {
    const [claimInfoBefore, nextCompensationId] = await Promise.all([
      ClaimManager.claimInfo(claimId).then((data) => claimInfoFormat(data)),
      LiquidityManager.nextCompensationId().then((id) => id.toNumber()),
    ]);

    const {
      poolData: [poolDataBefore],
      entityDatas: [coverDataBefore],
    } = await getEntityData(
      testEnv,
      [claimInfoBefore.poolId],
      [{ id: claimInfoBefore.coverId, type: "cover" }],
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
      entityDatas: [coverDataAfter, claimDataAfter],
      timestamp,
    } = await getEntityData(
      testEnv,
      [claimInfoBefore.poolId],
      [
        { id: claimInfoBefore.coverId, type: "cover" },
        { id: claimId, type: "claim" },
      ],
    );

    const expectedClaimData = calcExpectedClaimDataAfterWithdrawCompensation(
      claimInfoBefore,
      txTimestamp,
      timestamp,
    );

    const expectedPoolData = calcExpectedPoolDataAfterWithdrawCompensation(
      claimInfoBefore.amount,
      nextCompensationId,
      poolDataBefore,
      coverDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedCoverData = calcExpectedCoverDataAfterWithdrawCompensation(
      claimInfoBefore,
      poolDataBefore,
      expectedPoolData,
      coverDataBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(claimDataAfter, expectedClaimData);
    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(coverDataAfter, expectedCoverData);
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

  const messageValue = valueSent
    ? BigNumber.from(valueSent)
    : await ClaimManager.arbitrationCost();

  if (expectedResult === "success") {
    const claimInfoBefore = await ClaimManager.claimInfo(claimId).then((data) =>
      claimInfoFormat(data),
    );
    const coverDataBefore = await LiquidityManager.coverInfo(
      claimInfoBefore.coverId,
    ).then((data) => coverInfoFormat(data));
    const poolDataBefore = await LiquidityManager.poolInfo(
      coverDataBefore.poolId,
    ).then((data) => poolInfoFormat(data));

    const txResult = await postTxHandler(
      ClaimManager.connect(user).disputeClaim(claimId, {
        value: messageValue,
      }),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: [poolDataAfter],
      entityDatas: [coverDataAfter, claimDataAfter],
      timestamp,
    } = await getEntityData(
      testEnv,
      [claimInfoBefore.poolId],
      [
        { id: claimInfoBefore.coverId, type: "cover" },
        { id: claimId, type: "claim" },
      ],
    );

    const expectedClaimData = calcExpectedClaimDataAfterDisputeClaim(
      claimInfoBefore,
      user.address,
      claimDataAfter.disputeId,
      txTimestamp,
      timestamp,
    );

    const expectedPoolData = calcExpectedPoolDataAfterDisputeClaim(
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedCoverData = calcExpectedCoverDataAfterDisputeClaim(
      coverDataBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(claimDataAfter, expectedClaimData);
    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(coverDataAfter, expectedCoverData);
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
  disputeId: number,
  ruling: "RefusedToArbitrate" | "PayClaimant" | "RejectClaim",
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { ClaimManager, LiquidityManager, AthenaArbitrator } =
    testEnv.contracts;

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

  if (expectedResult === "success") {
    const claimId = await ClaimManager.disputeIdToClaimId(disputeId);
    const claimInfoBefore = await ClaimManager.claimInfo(claimId).then((data) =>
      claimInfoFormat(data),
    );

    const coverDataBefore = await LiquidityManager.coverInfo(
      claimInfoBefore.coverId,
    ).then((data) => coverInfoFormat(data));
    const poolDataBefore = await LiquidityManager.poolInfo(
      coverDataBefore.poolId,
    ).then((data) => poolInfoFormat(data));

    const txResult = await postTxHandler(
      AthenaArbitrator.connect(user).giveRuling(
        claimInfoBefore.disputeId,
        rulingValue,
      ),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: [poolDataAfter],
      entityDatas: [coverDataAfter, claimDataAfter],
      timestamp,
    } = await getEntityData(
      testEnv,
      [claimInfoBefore.poolId],
      [
        { id: claimInfoBefore.coverId, type: "cover" },
        { id: claimId, type: "claim" },
      ],
    );

    if (!skipTokenCheck) {
      if (ruling === "PayClaimant") {
        // @bw Add specific validation for PayClaimant case
      } else if (ruling === "RejectClaim") {
        // @bw Add specific validation for RejectClaim case
      }
    }

    const expectedClaimData = calcExpectedClaimDataAfterCourtRuling(
      claimInfoBefore,
      rulingValue,
      txTimestamp,
      timestamp,
    );

    const expectedPoolData = calcExpectedPoolDataAfterCourtRuling(
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedCoverData = calcExpectedCoverDataAfterCourtRuling(
      coverDataBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(claimDataAfter, expectedClaimData);
    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(coverDataAfter, expectedCoverData);
  } else if (expectedResult === "revert") {
    await expect(
      AthenaArbitrator.connect(user).giveRuling(disputeId, rulingValue),
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
    const coverDataBefore = await LiquidityManager.coverInfo(
      claimInfoBefore.coverId,
    ).then((data) => coverInfoFormat(data));
    const poolDataBefore = await LiquidityManager.poolInfo(
      coverDataBefore.poolId,
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
      entityDatas: [coverDataAfter, claimDataAfter],
      timestamp,
    } = await getEntityData(
      testEnv,
      [claimInfoBefore.poolId],
      [
        { id: claimInfoBefore.coverId, type: "cover" },
        { id: claimId, type: "claim" },
      ],
    );

    if (!skipTokenCheck && punish) {
      // @bw Add specific validation for punish case
    }

    const expectedClaimData = calcExpectedClaimDataAfterOverrule(
      claimInfoBefore,
      txTimestamp,
      timestamp,
    );

    const expectedPoolData = calcExpectedPoolDataAfterOverrule(
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedCoverData = calcExpectedCoverDataAfterOverrule(
      coverDataBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(claimDataAfter, expectedClaimData);
    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(coverDataAfter, expectedCoverData);
  } else if (expectedResult === "revert") {
    await expect(
      ClaimManager.connect(user).overrule(claimId, punish),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function fundAppeal(
  testEnv: TestEnv,
  user: Wallet,
  claimId: number,
  side: DisputeSide,
  valueSent: BigNumberish | undefined,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { ClaimManager, LiquidityManager, AthenaArbitrator } =
    testEnv.contracts;

  let sideValue: number;
  switch (side) {
    case "RefusedToArbitrate":
      sideValue = 0;
      break;
    case "PayClaimant":
      sideValue = 1;
      break;
    case "RejectClaim":
      sideValue = 2;
      break;
  }

  if (expectedResult === "success") {
    const claimInfoBefore = await ClaimManager.claimInfo(claimId).then((data) =>
      claimInfoFormat(data),
    );

    // Calculate appeal cost based on the current ruling
    const [appealCost, multipliers] = await Promise.all([
      ClaimManager.getAppealCost(claimInfoBefore.disputeId),
      ClaimManager.getMultipliers(),
    ]);

    let messageValue: BigNumber;
    if (valueSent) {
      messageValue = BigNumber.from(valueSent);
    } else {
      // Get the appropriate multiplier based on whether we're funding the side that won or lost
      const currentRuling = await AthenaArbitrator.currentRuling(
        claimInfoBefore.disputeId,
      ).then((el) => el.toNumber());
      const multiplier =
        sideValue === currentRuling ? multipliers.winner : multipliers.loser;

      messageValue = appealCost.add(
        appealCost.mul(multiplier).div(multipliers.divisor),
      );
    }

    const coverDataBefore = await LiquidityManager.coverInfo(
      claimInfoBefore.coverId,
    ).then((data) => coverInfoFormat(data));

    const poolDataBefore = await LiquidityManager.poolInfo(
      coverDataBefore.poolId,
    ).then((data) => poolInfoFormat(data));

    const txResult = await postTxHandler(
      ClaimManager.connect(user).fundAppeal(claimId, sideValue, {
        value: messageValue,
      }),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: [poolDataAfter],
      entityDatas: [coverDataAfter, claimDataAfter],
      timestamp,
    } = await getEntityData(
      testEnv,
      [claimInfoBefore.poolId],
      [
        { id: claimInfoBefore.coverId, type: "cover" },
        { id: claimId, type: "claim" },
      ],
    );

    const expectedClaimData = calcExpectedClaimDataAfterFundAppeal(
      sideValue,
      messageValue,
      multipliers,
      appealCost,
      claimInfoBefore,
      txTimestamp,
      timestamp,
    );

    const expectedPoolData = calcExpectedPoolDataAfterFundAppeal(
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedCoverData = calcExpectedCoverDataAfterFundAppeal(
      coverDataBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(claimDataAfter, expectedClaimData);
    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(coverDataAfter, expectedCoverData);
  } else if (expectedResult === "revert") {
    await expect(
      ClaimManager.connect(user).fundAppeal(claimId, sideValue, {
        value: valueSent ? BigNumber.from(valueSent) : BigNumber.from(0),
      }),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function resolveProsecution(
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
      entityDatas: [coverDataBefore],
    } = await getEntityData(
      testEnv,
      [claimInfoBefore.poolId],
      [{ id: claimInfoBefore.coverId, type: "cover" }],
    );

    const txResult = await postTxHandler(
      ClaimManager.connect(user).resolveProsecution(claimId),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: [poolDataAfter],
      entityDatas: [coverDataAfter, claimDataAfter],
      timestamp,
    } = await getEntityData(
      testEnv,
      [claimInfoBefore.poolId],
      [
        { id: claimInfoBefore.coverId, type: "cover" },
        { id: claimId, type: "claim" },
      ],
    );

    const expectedClaimData = calcExpectedClaimDataAfterResolveProsecution(
      claimInfoBefore,
      txTimestamp,
      timestamp,
    );

    const expectedPoolData = calcExpectedPoolDataAfterResolveProsecution(
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedCoverData = calcExpectedCoverDataAfterResolveProsecution(
      coverDataBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(claimDataAfter, expectedClaimData);
    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(coverDataAfter, expectedCoverData);
  } else if (expectedResult === "revert") {
    await expect(
      ClaimManager.connect(user).resolveProsecution(claimId),
    ).to.revertTransactionWith(revertMessage);
  }
}
