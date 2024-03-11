import { BigNumber, ContractTransaction } from "ethers";
import chai from "chai";

export async function getCustomError(
  txPromise: Promise<ContractTransaction>,
  allowRevertWithoutReason = false,
): Promise<string> {
  try {
    await txPromise;
    throw Error("Transaction did not throw");
  } catch (err: any) {
    if (err.errorName) {
      return err.errorName;
    }

    if (err.reason?.includes("reverted with custom error")) {
      return err.reason.slice(
        err.reason.indexOf("reverted with custom error") + 28,
        err.reason.length - 3,
      );
    }

    const stringError = JSON.stringify(err);
    if (stringError.includes("reverted with custom error")) {
      const start = stringError.indexOf("reverted with custom error") + 28;
      return stringError.slice(start, stringError.indexOf("(", start));
    }

    if (allowRevertWithoutReason) {
      return "Transaction reverted without a reason string";
    }

    throw Error(`Transaction did not revert with custom error: ${err}`);
  }
}

declare global {
  export namespace Chai {
    interface Assertion {
      revertTransactionWith(input: string | undefined): Promise<void>;
    }
  }
}

chai.use(function (chai, utils) {
  chai.Assertion.addMethod(
    "revertTransactionWith",
    async function (this: Chai.AssertionStatic, input: string | undefined) {
      if (!this._obj.then || typeof input !== "string") {
        throw new Error("almostEqual - Invalid input type");
      }

      // If the input is equal to undefined or "" then expect revert without a reason
      var expected = input || "Transaction reverted without a reason string";
      var actual = await getCustomError(this._obj, !input);

      this.assert(
        expected === actual,
        `expected #{act} tx to revert with #{exp}`,
        `expected #{act} tx to not revert with #{exp}`,
        expected.toString(),
        actual.toString(),
      );
    },
  );
});
