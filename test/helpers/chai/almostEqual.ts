import { BigNumber, BigNumberish } from "ethers";
import chai from "chai";

declare global {
  export namespace Chai {
    interface Assertion {
      almostEqual(input: number | string | BigNumber): void;
    }
  }
}

chai.use(function (chai, utils) {
  chai.Assertion.addMethod(
    "almostEqual",
    function (this: Chai.AssertionStatic, input: number | string | BigNumber) {
      if (
        (typeof this._obj !== "number" &&
          typeof this._obj !== "string" &&
          !BigNumber.isBigNumber(this._obj)) ||
        (typeof input !== "number" &&
          typeof input !== "string" &&
          !BigNumber.isBigNumber(input))
      ) {
        throw new Error("almostEqual - Invalid input type");
      }

      var expected = BigNumber.from(input);
      var actual = BigNumber.from(this._obj);
      this.assert(
        expected.add(BigNumber.from(1)).eq(actual) ||
          expected.add(BigNumber.from(2)).eq(actual) ||
          actual.add(BigNumber.from(1)).eq(expected) ||
          actual.add(BigNumber.from(2)).eq(expected) ||
          expected.eq(actual),
        `expected #{act} to be almost equal #{exp}`,
        `expected #{act} to be different from #{exp}`,
        expected.toString(),
        actual.toString(),
      );
    },
  );
});
