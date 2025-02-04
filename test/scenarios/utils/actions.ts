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
  //
  calcExpectedClaimDataAfterSubmitEvidence,
} from "../../helpers/utils/calculations";
import {
  getCurrentTime,
  postTxHandler,
  setNextBlockTimestamp,
  convertToCurrencyDecimals,
} from "../../helpers/hardhat";
import { expectEqual } from "../../helpers/chai/almostEqualState";
import {
  poolInfoFormat,
  positionInfoFormat,
  coverInfoFormat,
  claimInfoFormat,
} from "../../helpers/dataFormat";
import {
  PoolInfo,
  PositionInfoObject,
  CoverInfoObject,
  ClaimInfoObject,
  PoolInfoObject,
} from "../../helpers/types";
// Types
import {
  BigNumber,
  BigNumberish,
  ContractReceipt,
  Wallet,
  constants,
} from "ethers";
import { TestEnv } from "../../context";
import { TimeTravelOptions } from "../../helpers/hardhat";
import { ERC20__factory } from "../../../typechain";

export const getTxCostAndTimestamp = async (tx: ContractReceipt) => {
  if (!tx.blockNumber || !tx.transactionHash || !tx.cumulativeGasUsed) {
    throw new Error("No tx blocknumber");
  }
  const txTimestamp = (await hre.ethers.provider.getBlock(tx.blockNumber))
    .timestamp;

  const txInfo = await hre.ethers.provider.getTransaction(tx.transactionHash);
  if (!txInfo?.gasPrice) throw new Error("No tx info");
  const txCost = BigNumber.from(tx.cumulativeGasUsed.toString()).mul(
    txInfo.gasPrice.toString(),
  );

  return { txCost, txTimestamp };
};

type ContractsDataState = {
  poolData: PoolInfoObject[];
  tokenData: PositionInfoObject | CoverInfoObject | ClaimInfoObject;
  timestamp: number;
};

export async function getContractsData(
  testEnv: TestEnv,
  poolIds: BigNumberish[],
  tokenId: BigNumberish,
  tokenType: "claim",
): Promise<
  ContractsDataState & {
    tokenData: ClaimInfoObject;
  }
>;

export async function getContractsData(
  testEnv: TestEnv,
  poolIds: BigNumberish[],
  tokenId: BigNumberish,
  tokenType: "position",
): Promise<
  ContractsDataState & {
    tokenData: PositionInfoObject;
  }
>;

export async function getContractsData(
  testEnv: TestEnv,
  poolIds: BigNumberish[],
  tokenId: BigNumberish,
  tokenType: "cover",
): Promise<
  ContractsDataState & {
    tokenData: CoverInfoObject;
  }
>;

export async function getContractsData(
  testEnv: TestEnv,
  poolIds: BigNumberish[],
  tokenId: BigNumberish,
  tokenType: "cover" | "position" | "claim",
): Promise<ContractsDataState> {
  const { LiquidityManager, ClaimManager } = testEnv.contracts;

  const poolData = await Promise.all(
    poolIds.map((poolId) =>
      LiquidityManager.poolInfo(poolId).then((data) => poolInfoFormat(data)),
    ),
  );

  let tokenDataPromise: Promise<
    PositionInfoObject | CoverInfoObject | ClaimInfoObject
  >;
  if (tokenType === "cover") {
    tokenDataPromise = LiquidityManager.coverInfo(tokenId).then((data) =>
          coverInfoFormat(data),
    );
  } else if (tokenType === "position") {
    tokenDataPromise = LiquidityManager.positionInfo(tokenId).then((data) =>
          positionInfoFormat(data),
    );
  } else {
    tokenDataPromise = ClaimManager.claimInfo(tokenId).then((data) =>
      claimInfoFormat(data),
    );
  }

  const [tokenData, timestamp] = await Promise.all([
    tokenDataPromise,
    getCurrentTime(),
  ]);

  return {
    poolData,
    tokenData,
    timestamp,
  };
}

// ======= ACTIONS ======= //

export async function waitFor(timeTravel: TimeTravelOptions) {
  if (timeTravel) {
    await setNextBlockTimestamp(timeTravel);
  }
}

export async function getTokens(
  testEnv: TestEnv,
  tokenSymbol: string,
  to: Wallet,
  amount: BigNumberish,
) {
  const { TetherToken, AthenaToken, CircleToken } = testEnv.contracts;
  const { getUsdt, getAten, getUsdc } = testEnv.helpers;

  let tokenAddress: string;
  let getterFunction: (
    to: string,
    value: BigNumberish,
  ) => Promise<ContractReceipt>;

  if (tokenSymbol === "USDT")
    [tokenAddress, getterFunction] = [TetherToken.address, getUsdt];
  else if (tokenSymbol === "USDC")
    [tokenAddress, getterFunction] = [CircleToken.address, getUsdc];
  else if (tokenSymbol === "ATEN")
    [tokenAddress, getterFunction] = [AthenaToken.address, getAten];
  else throw Error("Token not found");

  const token = ERC20__factory.connect(tokenAddress, to);
  const toAddress = await to.getAddress();

  const [balanceBefore, weiAmount] = await Promise.all([
    token.balanceOf(toAddress),
    convertToCurrencyDecimals(tokenAddress, amount),
  ]);

  await getterFunction(toAddress, weiAmount);

  const balanceAfter = await token.balanceOf(toAddress);
  expect(balanceAfter).to.equal(balanceBefore.add(weiAmount));
}

export async function approveTokens(
  testEnv: TestEnv,
  tokenSymbol: string,
  from: Wallet,
  spender: string,
  amount: BigNumberish,
) {
  const { TetherToken, AthenaToken, CircleToken } = testEnv.contracts;
  const { approveUsdt, approveAten, approveUsdc } = testEnv.helpers;

  let tokenAddress: string;
  let approveFunction: (
    signer: Wallet,
    spender: string,
    value: BigNumberish,
  ) => Promise<ContractReceipt>;

  if (tokenSymbol === "USDT")
    [tokenAddress, approveFunction] = [TetherToken.address, approveUsdt];
  else if (tokenSymbol === "USDC")
    [tokenAddress, approveFunction] = [CircleToken.address, approveUsdc];
  else if (tokenSymbol === "ATEN")
    [tokenAddress, approveFunction] = [AthenaToken.address, approveAten];
  else throw Error("Token not found");

  const token = ERC20__factory.connect(tokenAddress, from);
  const fromAddress = await from.getAddress();
  const weiAmount = await convertToCurrencyDecimals(tokenAddress, amount);

  await approveFunction(from, spender, weiAmount);

  const allowanceAfter = await token.allowance(fromAddress, spender);
  expect(allowanceAfter).to.equal(weiAmount);
}

export async function createPool(
  testEnv: TestEnv,
  signer: Wallet,
  paymentAsset: string, // address paymentAsset
  strategyId: number, // uint256 strategyId
  feeRate: BigNumber, // uint256 feeRate
  uOptimal: BigNumber, // uint256 uOptimal
  r0: BigNumber, // uint256 r0
  rSlope1: BigNumber, // uint256 rSlope1
  rSlope2: BigNumber, // uint256 rSlope2
  compatiblePools: number[], // uint64[] compatiblePools
  expectedResult: "success" | "revert",
  revertMessage?: string,
) {
  const { LiquidityManager, StrategyManager } = testEnv.contracts;

  const poolId = await LiquidityManager.nextPoolId();

  if (expectedResult === "success") {
    const txResult = await postTxHandler(
      LiquidityManager.connect(signer).createPool(
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

    const [poolData, strategyTokens, strategyRewardIndex] = await Promise.all([
      LiquidityManager.poolInfo(poolId).then((data) => poolInfoFormat(data)),
      StrategyManager.assets(strategyId),
      StrategyManager.getRewardIndex(strategyId),
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
      strategyRewardIndex,
      txTimestamp,
    );

    expectEqual(poolData, expectedPoolData);
  } else {
    await expect(
      LiquidityManager.connect(signer).createPool(
        paymentAsset,
        strategyId,
        feeRate,
        uOptimal,
        r0,
        rSlope1,
        rSlope2,
        compatiblePools,
      ),
    ).to.revertTransactionWith(revertMessage);
  }
}

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

export async function openCover(
  testEnv: TestEnv,
  user: Wallet,
  poolId: BigNumberish,
  coverToken: string,
  coverAmount: BigNumberish,
  premiumToken: string,
  premiumsAmount: BigNumberish,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { LiquidityManager, AthenaCoverToken } = testEnv.contracts;

  const [amount, premiums] = await Promise.all([
    convertToCurrencyDecimals(coverToken, coverAmount),
    convertToCurrencyDecimals(premiumToken, premiumsAmount),
  ]);

  if (expectedResult === "success") {
    const poolDataBefore = await LiquidityManager.poolInfo(poolId).then(
      (data) => poolInfoFormat(data),
    );

    const coverId = await AthenaCoverToken.nextCoverId();

    const userAddress = await user.getAddress();
    const paymentToken = ERC20__factory.connect(
      poolDataBefore.paymentAsset,
      user,
    );

    const balanceBefore = await paymentToken.balanceOf(userAddress);

    const txResult = await postTxHandler(
      LiquidityManager.connect(user).openCover(poolId, amount, premiums),
    );

    const tokenDataBefore = await LiquidityManager.coverInfo(coverId).then(
      (data) => coverInfoFormat(data),
    );

    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const {
      poolData: [poolDataAfter],
      tokenData: tokenDataAfter,
      timestamp,
    } = await getContractsData(testEnv, [poolId], coverId, "cover");

    const expectedPoolData = calcExpectedPoolDataAfterOpenCover(
      amount,
      premiums,
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
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
    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(tokenDataAfter, expectedTokenData);
  } else if (expectedResult === "revert") {
    await expect(
      LiquidityManager.connect(user).openCover(poolId, amount, premiums),
    ).to.revertTransactionWith(revertMessage);
  }
}

export async function updateCover(
  testEnv: TestEnv,
  user: Wallet,
  coverId: BigNumberish,
  coverToken: string,
  coverToAdd: BigNumberish,
  coverToRemove: BigNumberish,
  premiumToken: string,
  premiumsToAdd: BigNumberish,
  premiumsToRemove: BigNumberish,
  expectedResult: "success" | "revert",
  revertMessage?: string,
  timeTravel?: TimeTravelOptions,
  skipTokenCheck?: boolean,
) {
  const { LiquidityManager } = testEnv.contracts;

  const [
    coverToAddAmount,
    coverToRemoveAmount,
    premiumsToAddAmount,
    premiumsToRemoveAmount,
  ] = await Promise.all([
    convertToCurrencyDecimals(coverToken, coverToAdd),
    convertToCurrencyDecimals(coverToken, coverToRemove),
    convertToCurrencyDecimals(premiumToken, premiumsToAdd),
    convertToCurrencyDecimals(premiumToken, premiumsToRemove),
  ]);

  if (expectedResult === "success") {
    const tokenDataBefore = await LiquidityManager.coverInfo(coverId).then(
      (data) => coverInfoFormat(data),
    );
    const poolDataBefore = await LiquidityManager.poolInfo(
      tokenDataBefore.poolId,
    ).then((data) => poolInfoFormat(data));

    const userAddress = await user.getAddress();
    const paymentToken = ERC20__factory.connect(
      poolDataBefore.paymentAsset,
      user,
    );
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

    const expectedPoolData = calcExpectedPoolDataAfterUpdateCover(
      coverToAddAmount,
      coverToRemoveAmount,
      premiumsToAddAmount,
      premiumsToRemoveAmount,
      tokenDataBefore,
      poolDataBefore,
      poolDataAfter.strategyRewardIndex,
      txTimestamp,
      timestamp,
    );

    const expectedTokenData = calcExpectedCoverDataAfterUpdateCover(
      coverToAddAmount,
      coverToRemoveAmount,
      premiumsToAddAmount,
      premiumsToRemoveAmount,
      poolDataBefore,
      expectedPoolData,
      tokenDataBefore,
      txTimestamp,
      timestamp,
    );

    const balanceAfter = await paymentToken.balanceOf(userAddress);
    if (premiumsToRemoveAmount.eq(constants.MaxUint256)) {
      expect(balanceAfter).to.almostEqual(
        balanceBefore.add(tokenDataBefore.premiumsLeft),
      );
    } else {
      expect(balanceAfter).to.almostEqual(
        balanceBefore.add(premiumsToRemoveAmount).sub(premiumsToAddAmount),
      );
    }

    expectEqual(poolDataAfter, expectedPoolData);
    if (!skipTokenCheck) expectEqual(tokenDataAfter, expectedTokenData);
  } else if (expectedResult === "revert") {
    await expect(
      LiquidityManager.connect(user).updateCover(
        coverId,
        coverToAddAmount,
        coverToRemoveAmount,
        premiumsToAddAmount,
        premiumsToRemoveAmount,
      ),
    ).to.revertTransactionWith(revertMessage);
  }
}

//================================//
//======= CLAIM MANAGEMENT =======//
//================================//

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
