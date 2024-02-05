import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool_updatedPremiumRate() {
  context("updatedPremiumRate", function () {
    before(async function () {
      this.args = {};
    });

    it("should correctly compute the updated premium rate with added covered capital", function () {
      // Compute the updated premium rate with added covered capital
      const updatedPremiumRate =
        this.contracts.TestableVirtualPool.updatedPremiumRate(
          this.args.coveredCapitalToAdd,
          0, // No covered capital to remove
        );

      // Calculate expected updated premium rate
      const expectedUpdatedPremiumRate =
        this.args.expectedUpdatedPremiumRateWithAddition; // Calculated based on provided formula

      // Check if the computed value matches the expected value
      expect(updatedPremiumRate).to.equal(expectedUpdatedPremiumRate);
    });

    it("should correctly compute the updated premium rate with removed covered capital", function () {
      // Compute the updated premium rate with removed covered capital
      const updatedPremiumRate =
        this.contracts.TestableVirtualPool.updatedPremiumRate(
          0, // No covered capital to add
          this.args.coveredCapitalToRemove,
        );

      // Calculate expected updated premium rate
      const expectedUpdatedPremiumRate =
        this.args.expectedUpdatedPremiumRateWithRemoval; // Calculated based on provided formula

      // Check if the computed value matches the expected value
      expect(updatedPremiumRate).to.equal(expectedUpdatedPremiumRate);
    });

    it("should increase the premium rate when covered capital is added", function () {
      // Compute the updated premium rate with additional covered capital
      const updatedPremiumRate =
        this.contracts.TestableVirtualPool.updatedPremiumRate(
          this.args.coveredCapitalToAdd,
          0, // No covered capital to remove
        );

      // Check if the updated premium rate is greater than the current premium rate
      expect(updatedPremiumRate).to.be.greaterThan(
        this.args.currentPremiumRate,
      );
    });

    it("should decrease the premium rate when covered capital is removed", function () {
      // Compute the updated premium rate with removed covered capital
      const updatedPremiumRate =
        this.contracts.TestableVirtualPool.updatedPremiumRate(
          0, // No covered capital to add
          this.args.coveredCapitalToRemove,
        );

      // Check if the updated premium rate is less than the current premium rate
      expect(updatedPremiumRate).to.be.lessThan(this.args.currentPremiumRate);
    });

    it("should retain the premium rate if covered capital remains unchanged", function () {
      // Compute the updated premium rate with no change in covered capital
      const updatedPremiumRate =
        this.contracts.TestableVirtualPool.updatedPremiumRate(
          0, // No covered capital to add
          0, // No covered capital to remove
        );

      // Check if the updated premium rate is equal to the current premium rate
      expect(updatedPremiumRate).to.equal(this.args.currentPremiumRate);
    });
  });
}
