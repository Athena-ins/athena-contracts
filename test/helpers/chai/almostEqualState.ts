import chai from "chai";
import { BigNumber } from "ethers";
// Types
import { PoolInfo, PositionInfo, CoverInfo, ClaimInfo } from "../types";

const { expect } = chai;

type StructuredAthenaData = PoolInfo | PositionInfo | CoverInfo | ClaimInfo;

declare global {
  export namespace Chai {
    interface Assertion {
      almostEqualState(input: StructuredAthenaData): void;
    }
  }
}

const DEVIATION_BASE = 100_000000;

function checkKey(
  this: Chai.AssertionStatic & {
    _obj: StructuredAthenaData;
  },
  key: string,
  path: any,
  actualKey: any,
  expectedKey: any,
) {
  if (key === "lastOnchainUpdateTimestamp" || key === "strategyRewardRate") {
    // skipping consistency check on accessory data
    return;
  }

  expect(
    actualKey != undefined,
    `Property ${path} is undefined in the actual data`,
  );
  expect(
    expectedKey != undefined,
    `Property ${path} is undefined in the expected data`,
  );

  if (
    expectedKey === null ||
    actualKey === null ||
    expectedKey === undefined ||
    actualKey === undefined
  ) {
    console.log(
      "Found a null value for Key ",
      path,
      " value ",
      expectedKey,
      actualKey,
    );
  }

  let deviationAllowed = 0;
  let deviationType: "percentage" | "absolute" | undefined;

  // For certain keys we will use a difference deviationAllowed
  if (key === "premiumsLeft") {
    deviationAllowed = 0.12;
    deviationType = "percentage";
  }
  if (key === "lastUpdateTimestamp") {
    deviationAllowed = 40;
    deviationType = "absolute";
  }

  if (
    deviationAllowed !== 0 &&
    Math.floor(DEVIATION_BASE * deviationAllowed) === 0
  )
    throw Error("Allowed deviation is too small");

  if (deviationAllowed !== 0) {
    const diff =
      deviationType === "absolute"
        ? deviationAllowed
        : `${deviationAllowed.toFixed(DEVIATION_BASE.toString().length - 2)}%`;

    if (BigNumber.isBigNumber(actualKey)) {
      const difference = actualKey.gt(expectedKey)
        ? actualKey.sub(expectedKey)
        : expectedKey.sub(actualKey);

      const allowedDifference =
        deviationType === "absolute"
          ? deviationAllowed
          : expectedKey
              .mul(Math.floor(DEVIATION_BASE * deviationAllowed))
              .div(DEVIATION_BASE);

      const actualString = actualKey.toString();
      const expectedString = expectedKey.toString();

      this.assert(
        difference.lte(allowedDifference),
        `expected ${actualString} to be within ${diff} of ${expectedString} for property ${path}`,
        `expected ${actualString} to be within ${diff} of ${expectedString} for property ${path}`,
        expectedKey,
        actualKey,
      );
    } else {
      const difference =
        expectedKey < actualKey
          ? actualKey - expectedKey
          : expectedKey - actualKey;

      const allowedDifference =
        deviationType === "absolute"
          ? deviationAllowed
          : (expectedKey * Math.floor(DEVIATION_BASE * deviationAllowed)) /
            DEVIATION_BASE;

      this.assert(
        difference <= allowedDifference,
        `expected #{act} to be within ${diff} of #{exp} for property ${path}`,
        `expected #{act} to be within ${diff} of #{exp} for property ${path}`,
        expectedKey,
        actualKey,
      );
    }
  } else if (BigNumber.isBigNumber(actualKey)) {
    const actualString = actualKey.toString();
    const expectedString = expectedKey.toString();

    this.assert(
      actualKey.eq(expectedKey) ||
        actualKey.add(1).eq(expectedKey) ||
        actualKey.eq(expectedKey.add(1)) ||
        actualKey.add(2).eq(expectedKey) ||
        actualKey.eq(expectedKey.add(2)) ||
        actualKey.add(3).eq(expectedKey) ||
        actualKey.eq(expectedKey.add(3)),
      `expected ${actualString} to be almost equal or equal ${expectedString} for property ${path}`,
      `expected ${actualString} to be almost equal or equal ${expectedString} for property ${path}`,
      expectedKey,
      actualKey,
    );
  } else if (typeof actualKey === "number" && typeof expectedKey === "number") {
    this.assert(
      actualKey === expectedKey ||
        actualKey + 1 === expectedKey ||
        actualKey === expectedKey + 1 ||
        actualKey + 2 === expectedKey ||
        actualKey === expectedKey + 2 ||
        actualKey + 3 === expectedKey ||
        actualKey === expectedKey + 3,
      `expected ${actualKey} to be almost equal or equal ${expectedKey} for property ${path}`,
      `expected ${actualKey} to be almost equal or equal ${expectedKey} for property ${path}`,
      expectedKey,
      actualKey,
    );
  } else {
    this.assert(
      actualKey !== null &&
        expectedKey !== null &&
        actualKey?.toString() === expectedKey?.toString(),
      `expected #{act} to be equal #{exp} for property ${path}`,
      `expected #{act} to be equal #{exp} for property ${path}`,
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
        _obj: StructuredAthenaData;
      },
      input: StructuredAthenaData,
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
        if (Array.isArray(actual[key])) {
          // For arrays we will check every item

          const actualArray = actual[key];
          if (actualArray.length === 0) return;

          for (let i = 0; i < actualArray.length; i++) {
            checkKeyContext(
              key,
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
            checkKeyContext(
              actualKeys[i],
              `${inputType}.${key}.${actualKeys[i]}`,
              actual[key][actualKeys[i]],
              expected[key][expectedKeys[i]],
            );
          }
        } else {
          // Else run a simple check

          checkKeyContext(
            key,
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
  actual: StructuredAthenaData,
  expected: StructuredAthenaData,
) => {
  expect(actual).to.be.almostEqualState(expected);
};
