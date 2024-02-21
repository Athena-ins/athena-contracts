import hre, { ethers } from "hardhat";
import { expect } from "chai";
import {
  calcExpectedPoolDataAfterCreatePool,
  calcExpectedPoolDataAfterOpenCover,
  calcExpectedCoverDataAfterOpenCover,
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
  poolId: BigNumberish,
  tokenId: BigNumberish,
  tokenType: "cover" | "position",
) {
  const LiquidityManager = testEnv.contracts.LiquidityManager;

  const [poolData, tokenData, timestamp] = await Promise.all([
    LiquidityManager.poolInfo(poolId),
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
  const tokenAddress =
    tokenName === "USDT"
      ? testEnv.contracts.TetherToken.address
      : testEnv.contracts.AthenaToken.address;
  const token = ERC20__factory.connect(tokenAddress, to);
  const toAddress = await to.getAddress();

  const balanceBefore = await token.balanceOf(toAddress);

  await (tokenName === "USDT"
    ? testEnv.helpers.getUsdt(
        toAddress,
        ethers.utils.parseUnits(amount.toString(), 6),
      )
    : testEnv.helpers.getAten(
        toAddress,
        ethers.utils.parseUnits(amount.toString(), 18),
      ));

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
  const tokenAddress =
    tokenName === "USDT"
      ? testEnv.contracts.TetherToken.address
      : testEnv.contracts.AthenaToken.address;
  const token = ERC20__factory.connect(tokenAddress, from);
  const fromAddress = await from.getAddress();

  const allowanceBefore = await token.allowance(fromAddress, spender);

  await (tokenName === "USDT"
    ? testEnv.helpers.approveUsdt(
        from,
        spender,
        ethers.utils.parseUnits(amount.toString(), 6),
      )
    : testEnv.helpers.approveAten(
        from,
        spender,
        ethers.utils.parseUnits(amount.toString(), 18),
      ));

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
) {
  const { LiquidityManager, StrategyManager } = testEnv.contracts;

  const poolId = await LiquidityManager.nextPoolId();

  const { timestamp } = await postTxHandler(
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
    timestamp,
  );

  expectEqual(poolData, expectedPoolData);
}

export async function openPosition(testEnv: TestEnv) {}
export async function addLiquidity(testEnv: TestEnv) {}
export async function commitRemoveLiquidity(testEnv: TestEnv) {}
export async function uncommitRemoveLiquidity(testEnv: TestEnv) {}
export async function takeInterests(testEnv: TestEnv) {}
export async function removeLiquidity(testEnv: TestEnv) {}

export async function openCover(
  testEnv: TestEnv,
  poolId: BigNumberish,
  coverAmount: BigNumberish,
  premiumsAmount: BigNumberish,
  user: Wallet,
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
      await getContractsData(testEnv, poolId, coverId, "cover");
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
      poolId,
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

export async function updateCover(testEnv: TestEnv) {}
export async function initiateClaim(testEnv: TestEnv) {}
export async function disputeClaim(testEnv: TestEnv) {}
export async function rule(testEnv: TestEnv) {}
export async function overrule(testEnv: TestEnv) {}
export async function withdrawCompensation(testEnv: TestEnv) {}
