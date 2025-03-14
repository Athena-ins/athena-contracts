import { expect } from "chai";
import { expectEqual } from "../../../helpers/chai/almostEqualState";
import { coverInfoFormat, poolInfoFormat } from "../../../helpers/dataFormat";
import {
  convertToCurrencyDecimals,
  postTxHandler,
  setNextBlockTimestamp,
} from "../../../helpers/hardhat";
import {
  calcExpectedCoverDataAfterOpenCover,
  calcExpectedCoverDataAfterUpdateCover,
  calcExpectedPoolDataAfterOpenCover,
  calcExpectedPoolDataAfterUpdateCover,
} from "../../../helpers/calculations";
import { getTxCostAndTimestamp, getEntityData } from "./helpers";
// Types
import { BigNumberish, Wallet, constants } from "ethers";
import { ERC20__factory } from "../../../../typechain";
import { TestEnv } from "../../../context";
import { TimeTravelOptions } from "../../../helpers/hardhat";

// ======= ACTIONS ======= //

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
      entityDatas: [tokenDataAfter],
      timestamp,
    } = await getEntityData(
      testEnv,
      [poolId],
      [{ id: coverId, type: "cover" }],
    );

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
      entityDatas: [tokenDataAfter],
      timestamp,
    } = await getEntityData(
      testEnv,
      [tokenDataBefore.poolId],
      [{ id: coverId, type: "cover" }],
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
