import chai from "chai";
import { BigNumber } from "ethers";
import { LiquidityManager } from "../../../typechain";
const { expect } = chai;

type PoolInfo =
  | Awaited<ReturnType<LiquidityManager["poolInfo"]>>
  | {
      poolId: BigNumber;
      feeRate: BigNumber;
      formula: {
        uOptimal: BigNumber;
        r0: BigNumber;
        rSlope1: BigNumber;
        rSlope2: BigNumber;
      };
      slot0: {
        tick: number;
        secondsPerTick: BigNumber;
        coveredCapital: BigNumber;
        remainingCovers: BigNumber;
        lastUpdateTimestamp: BigNumber;
        liquidityIndex: BigNumber;
      };
      strategyId: BigNumber;
      paymentAsset: string;
      underlyingAsset: string;
      wrappedAsset: string;
      isPaused: boolean;
      overlappedPools: BigNumber[];
      compensationIds: BigNumber[];
    };
type PositionInfo =
  | Awaited<ReturnType<LiquidityManager["positionInfo"]>>
  | {
      supplied: BigNumber;
      commitWithdrawalTimestamp: BigNumber;
      rewardIndex: BigNumber;
      poolIds: BigNumber[];
      newUserCapital: BigNumber;
      coverRewards: BigNumber[];
      strategyRewards: BigNumber;
    };
type CoverInfo =
  | Awaited<ReturnType<LiquidityManager["coverInfo"]>>
  | {
      coverId: BigNumber;
      poolId: BigNumber;
      coverAmount: BigNumber;
      start: BigNumber;
      end: BigNumber;
      premiumsLeft: BigNumber;
      dailyCost: BigNumber;
      premiumRate: BigNumber;
    };

declare global {
  export namespace Chai {
    interface Assertion {
      almostEqualState(input: PoolInfo | PositionInfo | CoverInfo): void;
    }
  }
}

chai.use(function (chai, utils) {
  chai.Assertion.addMethod(
    "almostEqualState",
    function (
      this: Chai.AssertionStatic & {
        _obj: PoolInfo | PositionInfo | CoverInfo;
      },
      input: PoolInfo | PositionInfo | CoverInfo,
    ) {
      const assert = this.assert;

      function checkKey(key: any, actualKey: any, expectedKey: any) {
        expect(
          actualKey != undefined,
          `Property ${key} is undefined in the actual data`,
        );
        expect(
          expectedKey != undefined,
          `Property ${key} is undefined in the expected data`,
        );

        if (expectedKey == null || actualKey == null) {
          console.log(
            "Found a undefined value for Key ",
            key,
            " value ",
            expectedKey,
            actualKey,
          );
        }

        if (BigNumber.isBigNumber(actualKey)) {
          assert(
            actualKey.eq(expectedKey) ||
              actualKey.add(1).eq(expectedKey) ||
              actualKey.eq(expectedKey.add(1)) ||
              actualKey.add(2).eq(expectedKey) ||
              actualKey.eq(expectedKey.add(2)) ||
              actualKey.add(3).eq(expectedKey) ||
              actualKey.eq(expectedKey.add(3)),
            `expected #{act} to be almost equal or equal #{exp} for property ${key}`,
            `expected #{act} to be almost equal or equal #{exp} for property ${key}`,
            expectedKey,
            actualKey,
          );
        } else {
          assert(
            actualKey !== null &&
              expectedKey !== null &&
              actualKey.toString() === expectedKey.toString(),
            `expected #{act} to be equal #{exp} for property ${key}`,
            `expected #{act} to be equal #{exp} for property ${key}`,
            expectedKey,
            actualKey,
          );
        }
      }

      const expected = input as any;
      const actual = this._obj;
      const keys = Object.keys(actual);

      for (const key of keys) {
        // if (
        //   key === "feeRate" ||
        //   key === "formula" ||
        //   key === "strategyId" ||
        //   key === "paymentAsset" ||
        //   key === "underlyingAsset" ||
        //   key === "wrappedAsset"
        // ) {
        //   // skipping consistency check on accessory data
        //   return;
        // }

        if (Array.isArray(actual[key])) {
          // For arrays we will check every item

          const actualArray = actual[key];
          if (actualArray.length === 0) return;

          for (let i = 0; i < actualArray.length; i++) {
            checkKey(key, actual[key][i], expected[key][i]);
          }
        } else if (
          typeof actual[key] === "object" &&
          !BigNumber.isBigNumber(actual[key])
        ) {
          // For objects that are not big numbers we will check the keys

          const actualKeys: any[] = Object.keys(actual[key]);
          const expectedKeys: any[] = Object.keys(expected[key]);

          for (let i = 0; i < actualKeys.length; i++) {
            checkKey(
              key,
              actual[key][actualKeys[i]],
              expected[key][expectedKeys[i]],
            );
          }
        } else {
          // Else run a simple check

          checkKey(key, actual[key], expected[key]);
        }
      }
    },
  );
});

export const expectEqual = (
  actual: PoolInfo | PositionInfo | CoverInfo,
  expected: PoolInfo | PositionInfo | CoverInfo,
) => {
  expect(actual).to.be.almostEqualState(expected);
};
