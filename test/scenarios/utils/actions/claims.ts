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
  calcExpectedClaimDataAfterRuleClaim,
  calcExpectedClaimDataAfterOverruleRuling,
  calcExpectedClaimDataAfterAppeal,
  calcExpectedClaimDataAfterWithdrawProsecutionReward,
  //
  calcExpectedCoverDataAfterSubmitEvidence,
  calcExpectedCoverDataAfterInitiateClaim,
  calcExpectedCoverDataAfterWithdrawCompensation,
  calcExpectedCoverDataAfterDisputeClaim,
  calcExpectedCoverDataAfterRuleClaim,
  calcExpectedCoverDataAfterOverruleRuling,
  calcExpectedCoverDataAfterAppeal,
  calcExpectedCoverDataAfterWithdrawProsecutionReward,
  //
  calcExpectedPoolDataAfterSubmitEvidence,
  calcExpectedPoolDataAfterInitiateClaim,
  calcExpectedPoolDataAfterWithdrawCompensation,
  calcExpectedPoolDataAfterDisputeClaim,
  calcExpectedPoolDataAfterRuleClaim,
  calcExpectedPoolDataAfterOverruleRuling,
  calcExpectedPoolDataAfterAppeal,
  calcExpectedPoolDataAfterWithdrawProsecutionReward,
} from "../../../helpers/calculations";
import { getTxCostAndTimestamp, getEntityData } from "./helpers";
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
        ClaimManager.claimCollateral(),
        ClaimManager.arbitrationCost(),
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
      poolDataBefore,
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
      claimId,
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

    // Sanity check to make sure it is the correct claim
    expect(claimInfoBefore.disputeId).to.equal(disputeId);

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

    const expectedClaimData = calcExpectedClaimDataAfterRuleClaim(
      claimInfoBefore,
      rulingValue,
      txTimestamp,
      timestamp,
    );

    const expectedPoolData = calcExpectedPoolDataAfterRuleClaim(
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedCoverData = calcExpectedCoverDataAfterRuleClaim(
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

    const expectedClaimData = calcExpectedClaimDataAfterOverruleRuling(
      claimInfoBefore,
      txTimestamp,
      timestamp,
    );

    const expectedPoolData = calcExpectedPoolDataAfterOverruleRuling(
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedCoverData = calcExpectedCoverDataAfterOverruleRuling(
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

export async function appeal(
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

  if (expectedResult === "success") {
    const claimInfoBefore = await ClaimManager.claimInfo(claimId).then((data) =>
      claimInfoFormat(data),
    );

    // Get appeal cost for this dispute
    const messageValue = valueSent
      ? BigNumber.from(valueSent)
      : await ClaimManager.appealCost(claimInfoBefore.disputeId);

    const coverDataBefore = await LiquidityManager.coverInfo(
      claimInfoBefore.coverId,
    ).then((data) => coverInfoFormat(data));

    const poolDataBefore = await LiquidityManager.poolInfo(
      coverDataBefore.poolId,
    ).then((data) => poolInfoFormat(data));

    const txResult = await postTxHandler(
      ClaimManager.connect(user).appeal(claimId, {
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

    const expectedClaimData = calcExpectedClaimDataAfterAppeal(
      claimInfoBefore,
      user.address,
      txTimestamp,
      timestamp,
    );

    const expectedPoolData = calcExpectedPoolDataAfterAppeal(
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedCoverData = calcExpectedCoverDataAfterAppeal(
      coverDataBefore,
      txTimestamp,
      timestamp,
    );

    expectEqual(claimDataAfter, expectedClaimData);
    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(coverDataAfter, expectedCoverData);
  } else if (expectedResult === "revert") {
    await expect(
      ClaimManager.connect(user).appeal(claimId, {
        value: valueSent ? BigNumber.from(valueSent) : BigNumber.from(0),
      }),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function withdrawProsecutionReward(
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
      ClaimManager.connect(user).withdrawProsecutionReward(claimId),
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

    const expectedClaimData =
      calcExpectedClaimDataAfterWithdrawProsecutionReward(
        claimInfoBefore,
        txTimestamp,
        timestamp,
      );

    const expectedPoolData = calcExpectedPoolDataAfterWithdrawProsecutionReward(
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedCoverData =
      calcExpectedCoverDataAfterWithdrawProsecutionReward(
        coverDataBefore,
        txTimestamp,
        timestamp,
      );

    expectEqual(claimDataAfter, expectedClaimData);
    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(coverDataAfter, expectedCoverData);
  } else if (expectedResult === "revert") {
    await expect(
      ClaimManager.connect(user).withdrawProsecutionReward(claimId),
    ).to.revertTransactionWith(revertMessage);
  }
}
