import chai from "chai";
import { BigNumber } from "ethers";
import { LiquidityManager, ClaimManager } from "../../../typechain";
const { expect } = chai;

export type PoolInfoObject = {
  poolId: number;
  feeRate: BigNumber;
  formula: {
    uOptimal: BigNumber;
    r0: BigNumber;
    rSlope1: BigNumber;
    rSlope2: BigNumber;
  };
  slot0: {
    tick: number;
    secondsPerTick: number;
    coveredCapital: BigNumber;
    remainingCovers: BigNumber;
    lastUpdateTimestamp: number;
    liquidityIndex: BigNumber;
  };
  strategyId: number;
  paymentAsset: string;
  underlyingAsset: string;
  wrappedAsset: string;
  isPaused: boolean;
  overlappedPools: number[];
  compensationIds: number[];
  overlappedCapital: BigNumber[];
  utilizationRate: BigNumber;
  totalLiquidity: BigNumber;
  availableLiquidity: BigNumber;
  strategyRewardIndex: BigNumber;
};

export type PositionInfoObject = {
  supplied: BigNumber;
  commitWithdrawalTimestamp: number;
  strategyRewardIndex: BigNumber;
  poolIds: number[];
  newUserCapital: BigNumber;
  coverRewards: BigNumber[];
  strategyRewards: BigNumber;
};

export type CoverInfoObject = {
  coverId: number;
  poolId: number;
  coverAmount: BigNumber;
  start: number;
  end: number;
  premiumsLeft: BigNumber;
  dailyCost: BigNumber;
  premiumRate: BigNumber;
};

export type ClaimInfoObject = {
  claimant: string;
  coverId: number;
  poolId: number;
  claimId: number;
  disputeId: number;
  status: number;
  createdAt: number;
  amount: BigNumber;
  challenger: string;
  deposit: BigNumber;
  evidence: string[];
  counterEvidence: string[];
  metaEvidence: string;
  rulingTimestamp: number;
};

type PoolInfo =
  | Awaited<ReturnType<LiquidityManager["poolInfo"]>>
  | PoolInfoObject;
type PositionInfo =
  | Awaited<ReturnType<LiquidityManager["positionInfo"]>>
  | PositionInfoObject;
type CoverInfo =
  | Awaited<ReturnType<LiquidityManager["coverInfo"]>>
  | CoverInfoObject;
type ClaimInfo =
  | Awaited<ReturnType<ClaimManager["claimInfo"]>>
  | ClaimInfoObject;

declare global {
  export namespace Chai {
    interface Assertion {
      almostEqualState(input: PoolInfo | PositionInfo | CoverInfo): void;
    }
  }
}

function checkKey(
  this: Chai.AssertionStatic & {
    _obj: PoolInfo | PositionInfo | CoverInfo;
  },
  key: any,
  actualKey: any,
  expectedKey: any,
) {
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
    this.assert(
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
    this.assert(
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

      const expected = input as any;
      const actual = this._obj;
      const keys = Object.keys(actual);

      let inputType = "PoolInfo";
      if (expected.hasOwnProperty("dailyCost")) inputType = "CoverInfo";
      if (expected.hasOwnProperty("supplied")) inputType = "PositionInfo";
      if (expected.hasOwnProperty("claimant")) inputType = "ClaimInfo";

      this;
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
            checkKey.bind(this)(
              `${inputType}.${key}[${i}]`,
              actual[key][i],
              expected[key][i],
            );
          }
        } else if (
          typeof actual[key] === "object" &&
          !BigNumber.isBigNumber(actual[key])
        ) {
          // For objects that are not big numbers we will check the keys

          const actualKeys: any[] = Object.keys(actual[key]);
          const expectedKeys: any[] = Object.keys(expected[key]);

          for (let i = 0; i < actualKeys.length; i++) {
            checkKey.bind(this)(
              `${inputType}.${key}.${actualKeys[i]}`,
              actual[key][actualKeys[i]],
              expected[key][expectedKeys[i]],
            );
          }
        } else {
          // Else run a simple check

          checkKey.bind(this)(
            `${inputType}.${key}`,
            actual[key],
            expected[key],
          );
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
