import { BigNumber } from "ethers";
import chai from "chai";

function almostEqualAssertion(
  this: any,
  expected: any,
  actual: any,
  message: string,
): any {
  this.assert(
    expected.plus(BigNumber.from(1)).eq(actual) ||
      expected.plus(BigNumber.from(2)).eq(actual) ||
      actual.plus(BigNumber.from(1)).eq(expected) ||
      actual.plus(BigNumber.from(2)).eq(expected) ||
      expected.eq(actual),
    `${message} expected #{act} to be almost equal #{exp}`,
    `${message} expected #{act} to be different from #{exp}`,
    expected.toString(),
    actual.toString(),
  );
}

export function almostEqual() {
  return function (chai: any, utils: any) {
    chai.Assertion.overwriteMethod("almostEqual", function (original: any) {
      return function (this: any, value: any, message: string) {
        if (utils.flag(this, "BigNumber")) {
          var expected = BigNumber.from(value);
          var actual = BigNumber.from(this._obj);
          almostEqualAssertion.apply(this, [expected, actual, message]);
        } else {
          original.apply(this, arguments);
        }
      };
    });
  };
}
