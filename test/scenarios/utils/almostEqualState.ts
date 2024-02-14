import chai from "chai";
import { BigNumber } from "ethers";

const { expect } = chai;

const almostEqualOrEqual = function (
  this: any,
  expected: ReserveData | UserReserveData,
  actual: ReserveData | UserReserveData,
) {
  const keys = Object.keys(actual);

  keys.forEach((key) => {
    if (
      key === "lastUpdateTimestamp" ||
      key === "marketStableRate" ||
      key === "symbol" ||
      key === "aTokenAddress" ||
      key === "decimals" ||
      key === "totalStableDebtLastUpdated"
    ) {
      // skipping consistency check on accessory data
      return;
    }

    this.assert(
      actual[key] != undefined,
      `Property ${key} is undefined in the actual data`,
    );
    expect(
      expected[key] != undefined,
      `Property ${key} is undefined in the expected data`,
    );

    if (expected[key] == null || actual[key] == null) {
      console.log(
        "Found a undefined value for Key ",
        key,
        " value ",
        expected[key],
        actual[key],
      );
    }

    if (actual[key] instanceof BigNumber) {
      const actualValue = (<BigNumber>actual[key]).decimalPlaces(
        0,
        BigNumber.ROUND_DOWN,
      );
      const expectedValue = (<BigNumber>expected[key]).decimalPlaces(
        0,
        BigNumber.ROUND_DOWN,
      );

      this.assert(
        actualValue.eq(expectedValue) ||
          actualValue.plus(1).eq(expectedValue) ||
          actualValue.eq(expectedValue.plus(1)) ||
          actualValue.plus(2).eq(expectedValue) ||
          actualValue.eq(expectedValue.plus(2)) ||
          actualValue.plus(3).eq(expectedValue) ||
          actualValue.eq(expectedValue.plus(3)),
        `expected #{act} to be almost equal or equal #{exp} for property ${key}`,
        `expected #{act} to be almost equal or equal #{exp} for property ${key}`,
        expectedValue.toFixed(0),
        actualValue.toFixed(0),
      );
    } else {
      this.assert(
        actual[key] !== null &&
          expected[key] !== null &&
          actual[key].toString() === expected[key].toString(),
        `expected #{act} to be equal #{exp} for property ${key}`,
        `expected #{act} to be equal #{exp} for property ${key}`,
        expected[key],
        actual[key],
      );
    }
  });
};

chai.use(function (chai: any, utils: any) {
  chai.Assertion.overwriteMethod(
    "almostEqualOrEqual",
    function (original: any) {
      return function (this: any, expected: ReserveData | UserReserveData) {
        const actual = (expected as ReserveData)
          ? <ReserveData>this._obj
          : <UserReserveData>this._obj;

        almostEqualOrEqual.apply(this, [expected, actual]);
      };
    },
  );
});

const expectEqual = (
  actual: UserReserveData | ReserveData,
  expected: UserReserveData | ReserveData,
) => {
  if (!configuration.skipIntegrityCheck) {
    // @ts-ignore
    expect(actual).to.be.almostEqualOrEqual(expected);
  }
};
