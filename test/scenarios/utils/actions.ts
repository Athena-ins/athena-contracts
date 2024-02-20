import hre from "hardhat";
import { expect } from "chai";
import {
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
import { BigNumber, BigNumberish, ContractReceipt, Signer } from "ethers";
import { TestEnv } from "../../context";
import { TimeTravelOptions } from "../../helpers/hardhat";

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

export const getContractsData = async (
  poolId: BigNumberish,
  tokenId: BigNumberish,
  tokenType: "cover" | "position",
  testEnv: TestEnv,
) => {
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
};

// ======= ACTIONS ======= //

export async function openCover(
  poolId: BigNumberish,
  coverAmount: BigNumberish,
  premiumsAmount: BigNumberish,
  user: Signer,
  testEnv: TestEnv,
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

    const { poolData: poolDataBefore, tokenData: tokenDataBefore } =
      await getContractsData(poolId, coverId, "cover", testEnv);

    const txResult = await postTxHandler(
      LiquidityManager.connect(user).openCover(poolId, amount, premiums),
    );
    txResult.events;
    const { txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      await setNextBlockTimestamp(timeTravel);
    }

    const { poolData, tokenData, timestamp } = await getContractsData(
      poolId,
      coverId,
      "cover",
      testEnv,
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

    // truffleAssert.eventEmitted(txResult, "CoverOpened", (ev: any) => {
    //   const { _poolId, _coverId, _amount } = ev;
    //   return (
    //     _poolId.eq(poolId) &&
    //     _coverId.eq(tokenData.coverId) &&
    //     _amount.eq(amount)
    //   );
    // });

    expectEqual(poolData, expectedPoolData);
    expectEqual(tokenData, expectedTokenData);
  } else if (expectedResult === "revert") {
    await expect(
      LiquidityManager.connect(user).openCover(poolId, amount, premiums),
      expectedResult,
    ).to.be.reverted;
  }
}

export async function createPool() {}
export async function updateCover() {}
export async function openPosition() {}
export async function addLiquidity() {}
export async function commitRemoveLiquidity() {}
export async function uncommitRemoveLiquidity() {}
export async function removeLiquidity() {}
export async function takeInterests() {}
export async function initiateClaim() {}
export async function disputeClaim() {}
export async function rule() {}
export async function overrule() {}
export async function withdrawCompensation() {}
