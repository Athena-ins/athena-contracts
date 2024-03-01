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

      const difference = expected.gt(actual)
        ? expected.sub(actual)
        : actual.sub(expected);

      this.assert(
        difference.lte(5),
        `expected #{act} to be almost equal #{exp}`,
        `expected #{act} to be different from #{exp}`,
        expected.toString(),
        actual.toString(),
      );
    },
  );
});
