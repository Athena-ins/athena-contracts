import { expect } from "chai";
import { expectEqual } from "../../../helpers/chai/almostEqualState";
import {
  poolInfoFormat,
  positionInfoFormat,
} from "../../../helpers/dataFormat";
import {
  convertToCurrencyDecimals,
  postTxHandler,
  setNextBlockTimestamp,
} from "../../../helpers/hardhat";
import {
  //
  calcExpectedPoolDataAfterAddLiquidity,
  calcExpectedPoolDataAfterCommitRemoveLiquidity,
  calcExpectedPoolDataAfterOpenPosition,
  calcExpectedPoolDataAfterRemoveLiquidity,
  calcExpectedPoolDataAfterTakeInterests,
  calcExpectedPoolDataAfterUncommitRemoveLiquidity,
  //
  calcExpectedPositionDataAfterAddLiquidity,
  calcExpectedPositionDataAfterCommitRemoveLiquidity,
  calcExpectedPositionDataAfterOpenPosition,
  calcExpectedPositionDataAfterRemoveLiquidity,
  calcExpectedPositionDataAfterTakeInterests,
  calcExpectedPositionDataAfterUncommitRemoveLiquidity,
} from "../../../helpers/utils/calculations";
import { getTxCostAndTimestamp, getContractsData } from "./helpers";
// Types
import { BigNumber, BigNumberish, Wallet } from "ethers";
import { ERC20__factory } from "../../../../typechain";
import { TestEnv } from "../../../context";
import { TimeTravelOptions } from "../../../helpers/hardhat";

// ======= ACTIONS ======= //

export async function openPosition(
  testEnv: TestEnv,
  user: Wallet,
  depositToken: string,
  amount: BigNumberish,
  isWrapped: boolean,
  poolIds: number[],
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { LiquidityManager, AthenaPositionToken } = testEnv.contracts;

  const [positionId, positionAmount] = await Promise.all([
    AthenaPositionToken.nextPositionId(),
    convertToCurrencyDecimals(depositToken, amount),
  ]);

  if (expectedResult === "success") {
    const poolDataBefore = await Promise.all(
      poolIds.map((poolId) =>
        LiquidityManager.poolInfo(poolId).then((data) => poolInfoFormat(data)),
      ),
    );

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

    const tokenDataBefore = await LiquidityManager.positionInfo(
      positionId,
    ).then((data) => positionInfoFormat(data));

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: poolDataAfter,
      tokenData: tokenDataAfter,
      timestamp,
    } = await getContractsData(testEnv, poolIds, positionId, "position");

    const expectedPoolData = calcExpectedPoolDataAfterOpenPosition(
      positionAmount,
      poolIds,
      poolDataBefore,
      poolDataAfter[0].strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedPositionDataAfterOpenPosition(
      positionAmount,
      poolIds,
      poolDataBefore,
      expectedPoolData,
      tokenDataBefore,
      txTimestamp,
      timestamp,
    );

    const balanceAfter = await token.balanceOf(userAddress);
    expect(balanceAfter).to.almostEqual(balanceBefore.sub(positionAmount));

    poolDataAfter.forEach((data, i) => expectEqual(data, expectedPoolData[i]));
    if (!skipTokenCheck) expectEqual(tokenDataAfter, expectedTokenData);
  } else {
    await expect(
      LiquidityManager.connect(user).openPosition(
        positionAmount,
        isWrapped,
        poolIds,
      ),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function addLiquidity(
  testEnv: TestEnv,
  user: Wallet,
  positionId: BigNumberish,
  depositToken: string,
  amount: BigNumberish,
  isWrapped: boolean,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { LiquidityManager } = testEnv.contracts;

  const amountToAdd = await convertToCurrencyDecimals(depositToken, amount);

  if (expectedResult === "success") {
    const tokenDataBefore = await LiquidityManager.positionInfo(
      positionId,
    ).then((data) => positionInfoFormat(data));
    const poolDataBefore = await Promise.all(
      tokenDataBefore.poolIds.map((poolId) =>
        LiquidityManager.poolInfo(poolId).then((data) => poolInfoFormat(data)),
      ),
    );

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

    const {
      poolData: poolDataAfter,
      tokenData: tokenDataAfter,
      timestamp,
    } = await getContractsData(
      testEnv,
      tokenDataBefore.poolIds,
      positionId,
      "position",
    );

    const expectedPoolData = calcExpectedPoolDataAfterAddLiquidity(
      amountToAdd,
      tokenDataBefore.poolIds,
      poolDataBefore,
      poolDataAfter[0].strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedPositionDataAfterAddLiquidity(
      amountToAdd,
      tokenDataBefore.poolIds,
      poolDataBefore,
      expectedPoolData,
      tokenDataBefore,
      txTimestamp,
      timestamp,
    );

    const balanceAfter = await token.balanceOf(userAddress);
    const strategyRewardsAdded = isWrapped
      ? 0
      : tokenDataBefore.strategyRewards;
    const coverRewardsAdded =
      poolDataBefore[0].paymentAsset.toLowerCase() ===
      poolDataBefore[0].underlyingAsset.toLowerCase()
        ? tokenDataBefore.coverRewards.reduce(
            (acc, el) => acc.add(el),
            BigNumber.from(0),
          )
        : 0;

    // @bw imprecise
    // expect(balanceAfter).to.almostEqual(
    //   balanceBefore
    //     .sub(amountToAdd)
    //     .add(strategyRewardsAdded)
    //     .add(coverRewardsAdded),
    // );

    poolDataAfter.forEach((data, i) => expectEqual(data, expectedPoolData[i]));
    if (!skipTokenCheck) expectEqual(tokenDataAfter, expectedTokenData);
  } else {
    await expect(
      LiquidityManager.connect(user).addLiquidity(
        positionId,
        amountToAdd,
        isWrapped,
      ),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function commitRemoveLiquidity(
  testEnv: TestEnv,
  user: Wallet,
  positionId: BigNumberish,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { LiquidityManager, StrategyManager } = testEnv.contracts;

  if (expectedResult === "success") {
    const tokenDataBefore = await LiquidityManager.positionInfo(
      positionId,
    ).then((data) => positionInfoFormat(data));
    const poolDataBefore = await Promise.all(
      tokenDataBefore.poolIds.map((poolId) =>
        LiquidityManager.poolInfo(poolId).then((data) => poolInfoFormat(data)),
      ),
    );

    const txResult = await postTxHandler(
      LiquidityManager.connect(user).commitRemoveLiquidity(positionId),
    );

    // Since we took profits we need the new liquidity index
    const [newStartStrategyIndex, ...newStartLiquidityIndexes] =
      await Promise.all([
        StrategyManager.getRewardIndex(poolDataBefore[0].strategyId),
        ...tokenDataBefore.poolIds.map((poolId) =>
          LiquidityManager.poolInfo(poolId).then(
            (data) => data.slot0.liquidityIndex,
          ),
        ),
      ]);

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: poolDataAfter,
      tokenData: tokenDataAfter,
      timestamp,
    } = await getContractsData(
      testEnv,
      tokenDataBefore.poolIds,
      positionId,
      "position",
    );

    const expectedPoolData = calcExpectedPoolDataAfterCommitRemoveLiquidity(
      poolDataBefore,
      poolDataAfter[0].strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData =
      calcExpectedPositionDataAfterCommitRemoveLiquidity(
        poolDataBefore,
        expectedPoolData,
        tokenDataBefore,
        newStartStrategyIndex,
        newStartLiquidityIndexes,
        txTimestamp,
        timestamp,
      );

    poolDataAfter.forEach((data, i) => expectEqual(data, expectedPoolData[i]));
    if (!skipTokenCheck) expectEqual(tokenDataAfter, expectedTokenData);
  } else {
    await expect(
      LiquidityManager.connect(user).commitRemoveLiquidity(positionId),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function uncommitRemoveLiquidity(
  testEnv: TestEnv,
  user: Wallet,
  positionId: BigNumberish,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { LiquidityManager, StrategyManager } = testEnv.contracts;

  if (expectedResult === "success") {
    const tokenDataBefore = await LiquidityManager.positionInfo(
      positionId,
    ).then((data) => positionInfoFormat(data));
    const poolDataBefore = await Promise.all(
      tokenDataBefore.poolIds.map((poolId) =>
        LiquidityManager.poolInfo(poolId).then((data) => poolInfoFormat(data)),
      ),
    );

    const txResult = await postTxHandler(
      LiquidityManager.connect(user).uncommitRemoveLiquidity(positionId),
    );

    // Since we took profits we need the new liquidity index
    const [newStartStrategyIndex, ...newStartLiquidityIndexes] =
      await Promise.all([
        StrategyManager.getRewardIndex(poolDataBefore[0].strategyId),
        ...tokenDataBefore.poolIds.map((poolId) =>
          LiquidityManager.poolInfo(poolId).then(
            (data) => data.slot0.liquidityIndex,
          ),
        ),
      ]);

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: poolDataAfter,
      tokenData: tokenDataAfter,
      timestamp,
    } = await getContractsData(
      testEnv,
      tokenDataBefore.poolIds,
      positionId,
      "position",
    );

    const expectedPoolData = calcExpectedPoolDataAfterUncommitRemoveLiquidity(
      poolDataBefore,
      poolDataAfter[0].strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData =
      calcExpectedPositionDataAfterUncommitRemoveLiquidity(
        poolDataBefore,
        expectedPoolData,
        tokenDataBefore,
        newStartStrategyIndex,
        newStartLiquidityIndexes,
        txTimestamp,
        timestamp,
      );

    poolDataAfter.forEach((data, i) => expectEqual(data, expectedPoolData[i]));
    if (!skipTokenCheck) expectEqual(tokenDataAfter, expectedTokenData);
  } else {
    await expect(
      LiquidityManager.connect(user).uncommitRemoveLiquidity(positionId),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function takeInterests(
  testEnv: TestEnv,
  user: Wallet,
  positionId: BigNumberish,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { LiquidityManager } = testEnv.contracts;

  if (expectedResult === "success") {
    const tokenDataBefore = await LiquidityManager.positionInfo(
      positionId,
    ).then((data) => positionInfoFormat(data));
    const poolDataBefore = await Promise.all(
      tokenDataBefore.poolIds.map((poolId) =>
        LiquidityManager.poolInfo(poolId).then((data) => poolInfoFormat(data)),
      ),
    );

    const txResult = await postTxHandler(
      LiquidityManager.connect(user).takeInterests(positionId),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: poolDataAfter,
      tokenData: tokenDataAfter,
      timestamp,
    } = await getContractsData(
      testEnv,
      tokenDataBefore.poolIds,
      positionId,
      "position",
    );

    const expectedPoolData = calcExpectedPoolDataAfterTakeInterests(
      poolDataBefore,
      poolDataAfter[0].strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedPositionDataAfterTakeInterests(
      poolDataBefore,
      expectedPoolData,
      tokenDataBefore,
      txTimestamp,
      timestamp,
    );

    poolDataAfter.forEach((data, i) => expectEqual(data, expectedPoolData[i]));
    if (!skipTokenCheck) expectEqual(tokenDataAfter, expectedTokenData);
  } else {
    await expect(
      LiquidityManager.connect(user).takeInterests(positionId),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function removeLiquidity(
  testEnv: TestEnv,
  user: Wallet,
  positionId: BigNumberish,
  withdrawnToken: string,
  amount: BigNumberish,
  keepWrapped: boolean,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { LiquidityManager } = testEnv.contracts;

  const amountToRemove = await convertToCurrencyDecimals(
    withdrawnToken,
    amount,
  );

  if (expectedResult === "success") {
    const tokenDataBefore = await LiquidityManager.positionInfo(
      positionId,
    ).then((data) => positionInfoFormat(data));
    const poolDataBefore = await Promise.all(
      tokenDataBefore.poolIds.map((poolId) =>
        LiquidityManager.poolInfo(poolId).then((data) => poolInfoFormat(data)),
      ),
    );

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

    const {
      poolData: poolDataAfter,
      tokenData: tokenDataAfter,
      timestamp,
    } = await getContractsData(
      testEnv,
      tokenDataBefore.poolIds,
      positionId,
      "position",
    );

    const expectedPoolData = calcExpectedPoolDataAfterRemoveLiquidity(
      amountToRemove,
      tokenDataBefore.poolIds,
      keepWrapped,
      poolDataBefore,
      poolDataAfter[0].strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedPositionDataAfterRemoveLiquidity(
      amountToRemove,
      keepWrapped,
      poolDataBefore,
      expectedPoolData,
      tokenDataBefore,
      txTimestamp,
      timestamp,
    );

    poolDataAfter.forEach((data, i) => expectEqual(data, expectedPoolData[i]));
    if (!skipTokenCheck) expectEqual(tokenDataAfter, expectedTokenData);
  } else {
    await expect(
      LiquidityManager.connect(user).removeLiquidity(
        positionId,
        amountToRemove,
        keepWrapped,
      ),
    ).to.revertTransactionWith(revertMessage);
  }
}
