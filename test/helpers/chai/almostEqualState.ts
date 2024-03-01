import chai from "chai";
import { BigNumber } from "ethers";
// Types
import { PoolInfo, PositionInfo, CoverInfo } from "../types";

const { expect } = chai;

declare global {
  export namespace Chai {
    interface Assertion {
      almostEqualState(input: PoolInfo | PositionInfo | CoverInfo): void;
    }
  }
}

const DEVIATION_BASE = 100_000000;
const DEFAULT_DEVIATION = 0;

function checkKey(
  this: Chai.AssertionStatic & {
    _obj: PoolInfo | PositionInfo | CoverInfo;
  },
  key: any,
  actualKey: any,
  expectedKey: any,
  deviationAllowed: number,
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

  if (
    deviationAllowed !== DEFAULT_DEVIATION &&
    BigNumber.isBigNumber(actualKey)
  ) {
    const percentage = `${deviationAllowed.toFixed(
      DEVIATION_BASE.toString().length - 2,
    )}%`;

    const different = actualKey.gt(expectedKey)
      ? actualKey.sub(expectedKey)
      : expectedKey.sub(actualKey);

    const allowedDifference = expectedKey
      .mul(Math.floor(DEVIATION_BASE * deviationAllowed))
      .div(DEVIATION_BASE);

    this.assert(
      different.lte(allowedDifference),
      `expected #{act} to be within ${percentage} of #{exp} for property ${key}`,
      `expected #{act} to be within ${percentage} of #{exp} for property ${key}`,
      expectedKey,
      actualKey,
    );
  } else if (BigNumber.isBigNumber(actualKey)) {
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
      const checkKeyContext = checkKey.bind(this);

      const expected = input as any;
      const actual = this._obj;
      const keys = Object.keys(actual);

      let inputType = "PoolInfo";
      if (expected.hasOwnProperty("dailyCost")) inputType = "CoverInfo";
      if (expected.hasOwnProperty("supplied")) inputType = "PositionInfo";
      if (expected.hasOwnProperty("claimant")) inputType = "ClaimInfo";

      for (const key of keys) {
        let deviationAllowed = DEFAULT_DEVIATION;

        // For certain keys we will use a different deviationAllowed
        if (key === "premiumsLeft") {
          deviationAllowed = 0.00001;
        }
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
            checkKeyContext(
              `${inputType}.${key}[${i}]`,
              actual[key][i],
              expected[key][i],
              deviationAllowed,
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
            checkKeyContext(
              `${inputType}.${key}.${actualKeys[i]}`,
              actual[key][actualKeys[i]],
              expected[key][expectedKeys[i]],
              deviationAllowed,
            );
          }
        } else {
          // Else run a simple check

          checkKeyContext(
            `${inputType}.${key}`,
            actual[key],
            expected[key],
            deviationAllowed,
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
