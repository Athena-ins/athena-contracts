import hre, { ethers } from "hardhat";
import { expect } from "chai";
import {
  calcExpectedPoolDataAfterCreatePool,
  calcExpectedPoolDataAfterOpenCover,
  calcExpectedPoolDataAfterOpenPosition,
  calcExpectedPoolDataAfterAddLiquidity,
  calcExpectedPoolDataAfterCommitRemoveLiquidity,
  calcExpectedPoolDataAfterUncommitRemoveLiquidity,
  calcExpectedPoolDataAfterTakeInterests,
  calcExpectedPoolDataAfterRemoveLiquidity,
  calcExpectedPoolDataAfterUpdateCover,
  calcExpectedPoolDataAfterWithdrawCompensation,
  calcExpectedPoolDataAfterInitiateClaim,
  //
  calcExpectedCoverDataAfterOpenCover,
  calcExpectedCoverDataAfterUpdateCover,
  calcExpectedCoverDataAfterWithdrawCompensation,
  calcExpectedCoverDataAfterInitiateClaim,
  //
  calcExpectedPositionDataAfterOpenPosition,
  calcExpectedPositionDataAfterAddLiquidity,
  calcExpectedPositionDataAfterCommitRemoveLiquidity,
  calcExpectedPositionDataAfterUncommitRemoveLiquidity,
  calcExpectedPositionDataAfterTakeInterests,
  calcExpectedPositionDataAfterRemoveLiquidity,
} from "../../helpers/utils/calculations";
import {
  getCurrentTime,
  postTxHandler,
  setNextBlockTimestamp,
  convertToCurrencyDecimals,
} from "../../helpers/hardhat";
import { expectEqual } from "../../helpers/chai/almostEqualState";
// Types
import { BigNumber, BigNumberish, ContractReceipt, Wallet } from "ethers";
import { TestEnv } from "../../context";
import { TimeTravelOptions } from "../../helpers/hardhat";
import { ERC20__factory } from "../../../typechain";

export const getTxCostAndTimestamp = async (tx: ContractReceipt) => {
  if (!tx.blockNumber || !tx.transactionHash || !tx.cumulativeGasUsed) {
    throw new Error("No tx blocknumber");
  }
  const txTimestamp = BigNumber.from(
    (await hre.ethers.provider.getBlock(tx.blockNumber)).timestamp,
  );

  const txInfo = await hre.ethers.provider.getTransaction(tx.transactionHash);
  if (!txInfo?.gasPrice) throw new Error("No tx info");
  const txCost = BigNumber.from(tx.cumulativeGasUsed.toString()).mul(
    txInfo.gasPrice.toString(),
  );

  return { txCost, txTimestamp };
};

export async function getContractsData(
  testEnv: TestEnv,
  poolIds: BigNumberish[],
  tokenId: BigNumberish,
  tokenType: "cover" | "position",
) {
  const LiquidityManager = testEnv.contracts.LiquidityManager;

  const poolData = await Promise.all(
    poolIds.map((poolId) => LiquidityManager.poolInfo(poolId)),
  );
  const [tokenData, timestamp] = await Promise.all([
    tokenType === "cover"
      ? LiquidityManager.coverInfo(tokenId)
      : LiquidityManager.positionInfo(tokenId),
    getCurrentTime(),
  ]);

  return {
    poolData,
    tokenData,
    timestamp: BigNumber.from(timestamp),
  };
}

// ======= ACTIONS ======= //

export async function getTokens(
  testEnv: TestEnv,
  tokenName: "USDT" | "ATEN",
  to: Wallet,
  amount: BigNumberish,
) {
  const [tokenAddress, getterFunction] =
    tokenName === "USDT"
      ? [testEnv.contracts.TetherToken.address, testEnv.helpers.getUsdt]
      : [testEnv.contracts.AthenaToken.address, testEnv.helpers.getAten];

  const token = ERC20__factory.connect(tokenAddress, to);
  const toAddress = await to.getAddress();

  const [balanceBefore, approveAmount] = await Promise.all([
    token.balanceOf(toAddress),
    convertToCurrencyDecimals(tokenAddress, amount),
  ]);

  await getterFunction(toAddress, approveAmount);

  const balanceAfter = await token.balanceOf(toAddress);

  expect(balanceAfter).to.equal(balanceBefore.add(amount));
}

export async function approveTokens(
  testEnv: TestEnv,
  tokenName: "USDT" | "ATEN",
  from: Wallet,
  spender: string,
  amount: BigNumberish,
) {
  const [tokenAddress, approveFunction] =
    tokenName === "USDT"
      ? [testEnv.contracts.TetherToken.address, testEnv.helpers.approveUsdt]
      : [testEnv.contracts.AthenaToken.address, testEnv.helpers.approveAten];

  const token = ERC20__factory.connect(tokenAddress, from);
  const fromAddress = await from.getAddress();

  const [allowanceBefore, approveAmount] = await Promise.all([
    token.allowance(fromAddress, spender),
    convertToCurrencyDecimals(tokenAddress, amount),
  ]);

  await approveFunction(from, spender, approveAmount);

  const allowanceAfter = await token.allowance(fromAddress, spender);
  expect(allowanceAfter).to.equal(allowanceBefore.add(amount));
}

export async function createPool(
  testEnv: TestEnv,
  paymentAsset: string, // address paymentAsset
  strategyId: number, // uint256 strategyId
  feeRate: BigNumber, // uint256 feeRate
  uOptimal: BigNumber, // uint256 uOptimal
  r0: BigNumber, // uint256 r0
  rSlope1: BigNumber, // uint256 rSlope1
  rSlope2: BigNumber, // uint256 rSlope2
  compatiblePools: number[], // uint64[] compatiblePools
  expectedResult: "success" | string,
) {
  const { LiquidityManager, StrategyManager } = testEnv.contracts;

  const poolId = await LiquidityManager.nextPoolId();

  if (expectedResult === "success") {
    const txResult = await postTxHandler(
      LiquidityManager.createPool(
        paymentAsset,
        strategyId,
        feeRate,
        uOptimal,
        r0,
        rSlope1,
        rSlope2,
        compatiblePools,
      ),
    );
    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    const [poolData, strategyTokens] = await Promise.all([
      LiquidityManager.poolInfo(poolId),
      StrategyManager.assets(strategyId),
    ]);

    const expectedPoolData = calcExpectedPoolDataAfterCreatePool(
      poolId,
      feeRate,
      uOptimal,
      r0,
      rSlope1,
      rSlope2,
      strategyId,
      paymentAsset,
      strategyTokens,
      txTimestamp,
    );

    expectEqual(poolData, expectedPoolData);
  } else {
    await expect(
      LiquidityManager.createPool(
        paymentAsset,
        strategyId,
        feeRate,
        uOptimal,
        r0,
        rSlope1,
        rSlope2,
        compatiblePools,
      ),
      expectedResult,
    ).to.be.reverted;
  }
}

export async function openPosition(
  testEnv: TestEnv,
  user: Wallet,
  amount: BigNumberish,
  isWrapped: boolean,
  poolIds: number[],
  expectedResult: "success" | string,
  timeTravel?: TimeTravelOptions,
) {
  const { LiquidityManager } = testEnv.contracts;

  const poolInfos = await Promise.all(
    poolIds.map((poolId) => LiquidityManager.poolInfo(poolId)),
  );
  const depositToken = isWrapped
    ? poolInfos[0].wrappedAsset
    : poolInfos[0].underlyingAsset;
  const [positionId, positionAmount] = await Promise.all([
    LiquidityManager.nextPositionId(),
    convertToCurrencyDecimals(depositToken, amount),
  ]);

  if (expectedResult === "success") {
    const userAddress = await user.getAddress();
    const token = ERC20__factory.connect(depositToken, user);
    const balanceBefore = await token.balanceOf(userAddress);

    const txResult = await postTxHandler(
      LiquidityManager.connect(user).openPosition(
        positionAmount,
        isWrapped,
        poolIds,
      ),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const { poolData, tokenData, timestamp } = await getContractsData(
      testEnv,
      poolIds,
      positionId,
      "position",
    );

    const expectedPoolData = calcExpectedPoolDataAfterOpenPosition(
      positionAmount,
      isWrapped,
      poolIds,
      poolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    const expectedPositionData = calcExpectedPositionDataAfterOpenPosition(
      positionAmount,
      isWrapped,
      poolIds,
      poolData,
      expectedPoolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    const balanceAfter = await token.balanceOf(userAddress);
    expect(balanceAfter).to.almostEqual(balanceBefore.sub(positionAmount));

    poolData.forEach((data, i) => expectEqual(data, expectedPoolData[i]));
    expectEqual(tokenData, expectedPositionData);
  } else {
    await expect(
      LiquidityManager.connect(user).openPosition(
        positionAmount,
        isWrapped,
        poolIds,
      ),
      expectedResult,
    ).to.be.reverted;
  }
}

export async function addLiquidity(
  testEnv: TestEnv,
  user: Wallet,
  positionId: BigNumberish,
  amount: BigNumberish,
  isWrapped: boolean,
  expectedResult: "success" | string,
  timeTravel?: TimeTravelOptions,
) {
  const { LiquidityManager } = testEnv.contracts;

  const positionInfo = await LiquidityManager.positionInfo(positionId);

  const poolInfos = await Promise.all(
    positionInfo.poolIds.map((poolId) => LiquidityManager.poolInfo(poolId)),
  );
  const depositToken = isWrapped
    ? poolInfos[0].wrappedAsset
    : poolInfos[0].underlyingAsset;
  const amountToAdd = await convertToCurrencyDecimals(depositToken, amount);

  if (expectedResult === "success") {
    const userAddress = await user.getAddress();
    const token = ERC20__factory.connect(depositToken, user);
    const balanceBefore = await token.balanceOf(userAddress);

    const txResult = await postTxHandler(
      LiquidityManager.connect(user).addLiquidity(
        positionId,
        amountToAdd,
        isWrapped,
      ),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const { poolData, tokenData, timestamp } = await getContractsData(
      testEnv,
      positionInfo.poolIds,
      positionId,
      "position",
    );

    const expectedPoolData = calcExpectedPoolDataAfterAddLiquidity(
      amountToAdd,
      isWrapped,
      positionInfo.poolIds,
      poolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedPositionDataAfterAddLiquidity(
      amountToAdd,
      isWrapped,
      positionInfo.poolIds,
      poolData,
      expectedPoolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    const balanceAfter = await token.balanceOf(userAddress);
    const strategyRewardsAdded = isWrapped ? 0 : positionInfo.strategyRewards;
    const coverRewardsAdded =
      poolInfos[0].paymentAsset.toLowerCase() ===
      poolInfos[0].underlyingAsset.toLowerCase()
        ? positionInfo.coverRewards.reduce(
            (acc, el) => acc.add(el),
            BigNumber.from(0),
          )
        : 0;
    expect(balanceAfter).to.almostEqual(
      balanceBefore
        .sub(amountToAdd)
        .add(strategyRewardsAdded)
        .add(coverRewardsAdded),
    );

    poolData.forEach((data, i) => expectEqual(data, expectedPoolData[i]));
    expectEqual(tokenData, expectedTokenData);
  } else {
    await expect(
      LiquidityManager.connect(user).addLiquidity(
        positionId,
        amountToAdd,
        isWrapped,
      ),
      expectedResult,
    ).to.be.reverted;
  }
}

export async function commitRemoveLiquidity(
  testEnv: TestEnv,
  user: Wallet,
  positionId: BigNumberish,
  expectedResult: "success" | string,
  timeTravel?: TimeTravelOptions,
) {
  const { LiquidityManager } = testEnv.contracts;

  const positionInfo = await LiquidityManager.positionInfo(positionId);

  if (expectedResult === "success") {
    const txResult = await postTxHandler(
      LiquidityManager.connect(user).commitRemoveLiquidity(positionId),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const { poolData, tokenData, timestamp } = await getContractsData(
      testEnv,
      positionInfo.poolIds,
      positionId,
      "position",
    );

    const expectedPoolData = calcExpectedPoolDataAfterCommitRemoveLiquidity(
      positionInfo,
      poolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData =
      calcExpectedPositionDataAfterCommitRemoveLiquidity(
        positionInfo,
        poolData,
        expectedPoolData,
        tokenData,
        txTimestamp,
        timestamp,
      );

    poolData.forEach((data, i) => expectEqual(data, expectedPoolData[i]));
    expectEqual(tokenData, expectedTokenData);
  } else {
    await expect(
      LiquidityManager.commitRemoveLiquidity(positionId),
      expectedResult,
    ).to.be.reverted;
  }
}

export async function uncommitRemoveLiquidity(
  testEnv: TestEnv,
  positionId: BigNumberish,
  expectedResult: "success" | string,
  timeTravel?: TimeTravelOptions,
) {
  const { LiquidityManager } = testEnv.contracts;

  const positionInfo = await LiquidityManager.positionInfo(positionId);

  if (expectedResult === "success") {
    const txResult = await postTxHandler(
      LiquidityManager.connect(user).uncommitRemoveLiquidity(positionId),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const { poolData, tokenData, timestamp } = await getContractsData(
      testEnv,
      positionInfo.poolIds,
      positionId,
      "position",
    );

    const expectedPoolData = calcExpectedPoolDataAfterUncommitRemoveLiquidity(
      positionInfo,
      poolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData =
      calcExpectedPositionDataAfterUncommitRemoveLiquidity(
        positionInfo,
        poolData,
        expectedPoolData,
        tokenData,
        txTimestamp,
        timestamp,
      );

    poolData.forEach((data, i) => expectEqual(data, expectedPoolData[i]));
    expectEqual(tokenData, expectedTokenData);
  } else {
    await expect(
      LiquidityManager.uncommitRemoveLiquidity(positionId),
      expectedResult,
    ).to.be.reverted;
  }
}

export async function takeInterests(
  testEnv: TestEnv,
  user: Wallet,
  positionId: BigNumberish,
  expectedResult: "success" | string,
  timeTravel?: TimeTravelOptions,
) {
  const { LiquidityManager } = testEnv.contracts;

  const positionInfo = await LiquidityManager.positionInfo(positionId);

  if (expectedResult === "success") {
    const txResult = await postTxHandler(
      LiquidityManager.connect(user).takeInterests(positionId),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const { poolData, tokenData, timestamp } = await getContractsData(
      testEnv,
      positionInfo.poolIds,
      positionId,
      "position",
    );

    const expectedPoolData = calcExpectedPoolDataAfterTakeInterests(
      positionInfo,
      poolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedPositionDataAfterTakeInterests(
      positionInfo,
      poolData,
      expectedPoolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    poolData.forEach((data, i) => expectEqual(data, expectedPoolData[i]));
    expectEqual(tokenData, expectedTokenData);
  } else {
    await expect(LiquidityManager.takeInterests(positionId), expectedResult).to
      .be.reverted;
  }
}

export async function removeLiquidity(
  testEnv: TestEnv,
  user: Wallet,
  positionId: BigNumberish,
  amount: BigNumberish,
  keepWrapped: boolean,
  expectedResult: "success" | string,
  timeTravel?: TimeTravelOptions,
) {
  const { LiquidityManager } = testEnv.contracts;

  const positionInfoBefore = await LiquidityManager.positionInfo(positionId);
  const poolInfosBefore = await Promise.all(
    positionInfoBefore.poolIds.map((poolId) =>
      LiquidityManager.poolInfo(poolId),
    ),
  );
  const amountToRemove = await convertToCurrencyDecimals(
    poolInfosBefore[0].underlyingAsset,
    amount,
  );

  if (expectedResult === "success") {
    const txResult = await postTxHandler(
      LiquidityManager.connect(user).removeLiquidity(
        positionId,
        amountToRemove,
        keepWrapped,
      ),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const { poolData, tokenData, timestamp } = await getContractsData(
      testEnv,
      positionInfoBefore.poolIds,
      positionId,
      "position",
    );

    const expectedPoolData = calcExpectedPoolDataAfterRemoveLiquidity(
      amountToRemove,
      keepWrapped,
      poolInfosBefore,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedPositionDataAfterRemoveLiquidity(
      amountToRemove,
      keepWrapped,
      poolInfosBefore,
      positionInfoBefore,
      expectedPoolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    poolData.forEach((data, i) => expectEqual(data, expectedPoolData[i]));
    expectEqual(tokenData, expectedTokenData);
  } else {
    await expect(
      LiquidityManager.removeLiquidity(positionId, amountToRemove, keepWrapped),
      expectedResult,
    ).to.be.reverted;
  }
}

export async function openCover(
  testEnv: TestEnv,
  user: Wallet,
  poolId: BigNumberish,
  coverAmount: BigNumberish,
  premiumsAmount: BigNumberish,
  expectedResult: "success" | string,
  timeTravel?: TimeTravelOptions,
) {
  const { LiquidityManager } = testEnv.contracts;

  const poolInfo = await LiquidityManager.poolInfo(poolId);
  const [amount, premiums] = await Promise.all([
    convertToCurrencyDecimals(poolInfo.underlyingAsset, coverAmount),
    convertToCurrencyDecimals(poolInfo.paymentAsset, premiumsAmount),
  ]);

  if (expectedResult === "success") {
    const coverId = await LiquidityManager.nextCoverId();
    const userAddress = await user.getAddress();
    const paymentToken = ERC20__factory.connect(poolInfo.paymentAsset, user);

    const { poolData: poolDataBefore, tokenData: tokenDataBefore } =
      await getContractsData(testEnv, [poolId], coverId, "cover");
    const balanceBefore = await paymentToken.balanceOf(userAddress);

    const txResult = await postTxHandler(
      LiquidityManager.connect(user).openCover(poolId, amount, premiums),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const { poolData, tokenData, timestamp } = await getContractsData(
      testEnv,
      [poolId],
      coverId,
      "cover",
    );

    const expectedPoolData = calcExpectedPoolDataAfterOpenCover(
      amount,
      premiums,
      poolDataBefore,
      tokenDataBefore,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedCoverDataAfterOpenCover(
      amount,
      premiums,
      poolDataBefore,
      expectedPoolData,
      tokenDataBefore,
      txTimestamp,
      timestamp,
    );

    const balanceAfter = await paymentToken.balanceOf(userAddress);

    expect(balanceAfter).to.almostEqual(balanceBefore.sub(premiums));
    expectEqual(poolData, expectedPoolData);
    expectEqual(tokenData, expectedTokenData);
  } else if (expectedResult === "revert") {
    await expect(
      LiquidityManager.connect(user).openCover(poolId, amount, premiums),
      expectedResult,
    ).to.be.reverted;
  }
}

export async function updateCover(
  testEnv: TestEnv,
  user: Wallet,
  coverId: BigNumberish,
  coverToAdd: BigNumberish,
  coverToRemove: BigNumberish,
  premiumsToAdd: BigNumberish,
  premiumsToRemove: BigNumberish,
  expectedResult: "success" | string,
  timeTravel?: TimeTravelOptions,
) {
  const { LiquidityManager } = testEnv.contracts;

  const coverInfoBefore = await LiquidityManager.coverInfo(coverId);
  const poolInfo = await LiquidityManager.poolInfo(coverInfoBefore.poolId);
  const [
    coverToAddAmount,
    coverToRemoveAmount,
    premiumsToAddAmount,
    premiumsToRemoveAmount,
  ] = await Promise.all([
    convertToCurrencyDecimals(poolInfo.underlyingAsset, coverToAdd),
    convertToCurrencyDecimals(poolInfo.underlyingAsset, coverToRemove),
    convertToCurrencyDecimals(poolInfo.paymentAsset, premiumsToAdd),
    convertToCurrencyDecimals(poolInfo.paymentAsset, premiumsToRemove),
  ]);

  if (expectedResult === "success") {
    const userAddress = await user.getAddress();
    const paymentToken = ERC20__factory.connect(poolInfo.paymentAsset, user);
    const balanceBefore = await paymentToken.balanceOf(userAddress);

    const txResult = await postTxHandler(
      LiquidityManager.connect(user).updateCover(
        coverId,
        coverToAddAmount,
        coverToRemoveAmount,
        premiumsToAddAmount,
        premiumsToRemoveAmount,
      ),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const { poolData, tokenData, timestamp } = await getContractsData(
      testEnv,
      [coverInfoBefore.poolId],
      coverId,
      "cover",
    );

    const expectedPoolData = calcExpectedPoolDataAfterUpdateCover(
      coverToAddAmount,
      coverToRemoveAmount,
      premiumsToAddAmount,
      premiumsToRemoveAmount,
      coverInfoBefore,
      poolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedCoverDataAfterUpdateCover(
      coverToAddAmount,
      coverToRemoveAmount,
      premiumsToAddAmount,
      premiumsToRemoveAmount,
      coverInfoBefore,
      poolData,
      expectedPoolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    const balanceAfter = await paymentToken.balanceOf(userAddress);

    expect(balanceAfter).to.almostEqual(balanceBefore.sub(premiumsToAddAmount));
    expectEqual(poolData, expectedPoolData);
    expectEqual(tokenData, expectedTokenData);
  } else if (expectedResult === "revert") {
    await expect(
      LiquidityManager.connect(user).updateCover(
        coverId,
        coverToAddAmount,
        coverToRemoveAmount,
        premiumsToAddAmount,
        premiumsToRemoveAmount,
      ),
      expectedResult,
    ).to.be.reverted;
  }
}

export async function initiateClaim(
  testEnv: TestEnv,
  user: Wallet,
  coverId: BigNumberish,
  amountClaimed: BigNumberish,
  ipfsMetaEvidenceCid: string,
  signature: string,
  expectedResult: "success" | string,
  timeTravel?: TimeTravelOptions,
) {
  const { LiquidityManager, ClaimManager } = testEnv.contracts;

  const coverInfoBefore = await LiquidityManager.coverInfo(coverId);
  const poolInfo = await LiquidityManager.poolInfo(coverInfoBefore.poolId);
  const amountClaimedAmount = await convertToCurrencyDecimals(
    poolInfo.underlyingAsset,
    amountClaimed,
  );

  if (expectedResult === "success") {
    const txResult = await postTxHandler(
      ClaimManager.connect(user).initiateClaim(
        coverId,
        amountClaimedAmount,
        ipfsMetaEvidenceCid,
        signature,
      ),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const { poolData, tokenData, timestamp } = await getContractsData(
      testEnv,
      [coverInfoBefore.poolId],
      coverId,
      "cover",
    );

    const expectedPoolData = calcExpectedPoolDataAfterInitiateClaim(
      amountClaimedAmount,
      coverInfoBefore,
      poolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedCoverDataAfterInitiateClaim(
      amountClaimedAmount,
      coverInfoBefore,
      poolData,
      expectedPoolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    expectEqual(poolData, expectedPoolData);
    expectEqual(tokenData, expectedTokenData);
  } else if (expectedResult === "revert") {
    await expect(
      ClaimManager.connect(user).initiateClaim(
        coverId,
        amountClaimedAmount,
        ipfsMetaEvidenceCid,
        signature,
      ),
      expectedResult,
    ).to.be.reverted;
  }
}

export async function withdrawCompensation(
  testEnv: TestEnv,
  user: Wallet,
  claimId: BigNumberish,
  expectedResult: "success" | string,
  timeTravel?: TimeTravelOptions,
) {
  const { LiquidityManager, ClaimManager } = testEnv.contracts;

  const claimInfo = await ClaimManager.claimInfo(claimId);
  const [coverInforBefore, poolInfoBefore] = await Promise.all([
    LiquidityManager.coverInfo(claimInfo.coverId),
    LiquidityManager.poolInfo(claimInfo.poolId),
  ]);

  if (expectedResult === "success") {
    const txResult = await postTxHandler(
      ClaimManager.connect(user).withdrawCompensation(claimId),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const { poolData, tokenData, timestamp } = await getContractsData(
      testEnv,
      [claimInfo.poolId],
      claimId,
      "cover",
    );

    const expectedPoolData = calcExpectedPoolDataAfterWithdrawCompensation(
      claimInfoBefore,
      poolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedCoverDataAfterWithdrawCompensation(
      claimInfoBefore,
      poolData,
      expectedPoolData,
      tokenData,
      txTimestamp,
      timestamp,
    );

    expectEqual(poolData, expectedPoolData);
    expectEqual(tokenData, expectedTokenData);
  } else if (expectedResult === "revert") {
    await expect(
      ClaimManager.connect(user).withdrawCompensation(claimId),
      expectedResult,
    ).to.be.reverted;
  }
}

// @bw need calcs in claim manager
// export async function disputeClaim(testEnv: TestEnv, user: Wallet) {}
// export async function rule(testEnv: TestEnv, user: Wallet) {}
// export async function overrule(testEnv: TestEnv, user: Wallet) {}
