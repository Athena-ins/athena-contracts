import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function ClaimManager_changePeriods() {
  context("changePeriods", function (this: Arguments) {
    beforeEach(async function (this: Arguments) {
      // Common setup before each test
    });

    it("should revert if called by a non-owner", async function (this: Arguments) {
      // Attempt to call changeRequiredCollateral by a non-owner account
      expect(
        await await this.contract.changePeriods(
          this.args.newChallengePeriod,
          this.args.overrulePeriod,
        ),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should successfully change the challenge period", async function (this: Arguments) {
      // Call changePeriods with new challenge period
      await this.contract.changePeriods(
        this.args.newChallengePeriod,
        this.args.overrulePeriod,
      );

      // Retrieve the updated challenge period from the contract
      const updatedChallengePeriod = await this.contract.challengePeriod();

      // Check if the challenge period is updated correctly
      expect(updatedChallengePeriod).to.equal(this.args.newChallengePeriod);
    });

    it("should successfully change the overrule period", async function (this: Arguments) {
      // Call changePeriods with new overrule period
      await this.contract.changePeriods(
        this.args.challengePeriod,
        this.args.newOverrulePeriod,
      );

      // Retrieve the updated overrule period from the contract
      const updatedOverrulePeriod = await this.contract.overrulePeriod();

      // Check if the overrule period is updated correctly
      expect(updatedOverrulePeriod).to.equal(this.args.newOverrulePeriod);
    });

    it("should emit a PeriodsChanged event on successful period change", async function (this: Arguments) {
      // Call changePeriods and get transaction receipt
      const tx = await this.contract.changePeriods(
        this.args.newChallengePeriod,
        this.args.newOverrulePeriod,
      );
      const receipt = await tx.wait();

      // Check if the PeriodsChanged event was emitted with correct parameters
      expect(receipt.events).to.deep.include({
        event: "PeriodsChanged",
        args: [this.args.newChallengePeriod, this.args.newOverrulePeriod],
      });
    });
  });
}
