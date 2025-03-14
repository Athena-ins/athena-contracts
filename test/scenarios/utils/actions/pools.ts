import { expect } from "chai";
import { expectEqual } from "../../../helpers/chai/almostEqualState";
import { poolInfoFormat } from "../../../helpers/dataFormat";
import { postTxHandler } from "../../../helpers/hardhat";
import { calcExpectedPoolDataAfterCreatePool } from "../../../helpers/calculations";
import { getTxCostAndTimestamp } from "./helpers";
// Types
import { BigNumber, Wallet } from "ethers";
import { TestEnv } from "../../../context";

// ======= ACTIONS ======= //

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
