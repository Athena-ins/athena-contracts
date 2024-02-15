import { BigNumber, BigNumberish } from "ethers";
import chai from "chai";

declare global {
  export namespace Chai {
    interface Assertion {
      almostEqual(expected: BigNumberish): Promise<void>;
    }
  }
}

function almostEqualAssertion(
  this: any,
  expected: BigNumber,
  actual: BigNumber,
  message: string,
): any {
  this.assert(
    expected.add(BigNumber.from(1)).eq(actual) ||
      expected.add(BigNumber.from(2)).eq(actual) ||
      actual.add(BigNumber.from(1)).eq(expected) ||
      actual.add(BigNumber.from(2)).eq(expected) ||
      expected.eq(actual),
    `${message} expected #{act} to be almost equal #{exp}`,
    `${message} expected #{act} to be different from #{exp}`,
    expected.toString(),
    actual.toString(),
  );
}

chai.use(function (chai, utils) {
  chai.Assertion.addMethod("almostEqual", function (input: BigNumberish) {
    return function (this: any, value: BigNumberish, message: string) {
      var expected = BigNumber.from(value);
      var actual = BigNumber.from(this._obj);
      almostEqualAssertion.apply(this, [expected, actual, message]);
    };
  });
});
