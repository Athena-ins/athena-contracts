import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function ClaimManager_arbitrationCost() {
  context("arbitrationCost", function (this: Arguments) {
    beforeEach(async function (this: Arguments) {
      // Common setup before each test
    });

    it("should return the correct arbitration cost", async function (this: Arguments) {
      // Call the arbitrationCost function
      const cost = await this.contract.arbitrationCost();

      // Get the expected cost directly from the arbitrator contract
      const expectedCost = await this.arbitrator.arbitrationCost(
        this.args.klerosExtraData,
      );

      // Check if the returned cost matches the expected cost
      expect(cost).to.equal(expectedCost);
    });
  });
}
