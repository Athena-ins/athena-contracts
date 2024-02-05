import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool_getPremiumRate() {
  context("getPremiumRate", function () {
    before(async function () {
      this.args = {};
    });

    it("should return the base rate when utilization rate is below optimal utilization", async function () {
      // Calculate premium rate with utilization rate below optimal utilization
      const utilizationRate = this.args.utilizationRateBelowOptimal;
      const premiumRate =
        await this.contracts.TestableVirtualPool.getPremiumRate(
          utilizationRate,
        );

      // The expected premium rate is the base rate plus proportional slope 1 rate
      const expectedPremiumRate =
        this.args.formula.r0 +
        this.args.formula.rSlope1.rayMul(
          utilizationRate.rayDiv(this.args.formula.uOptimal),
        );

      // Check if the calculated premium rate matches the expected value
      expect(premiumRate).to.equal(expectedPremiumRate);
    });

    it("should return the increased rate when utilization rate is between optimal utilization and full utilization", async function () {
      // Calculate premium rate with utilization rate between optimal and full utilization
      const utilizationRate = this.args.utilizationRateBetweenOptimalAndFull;
      const premiumRate =
        await this.contracts.TestableVirtualPool.getPremiumRate(
          utilizationRate,
        );

      // The expected premium rate is base rate plus slope 1 rate plus proportional slope 2 rate
      const expectedPremiumRate =
        this.args.formula.r0 +
        this.args.formula.rSlope1 +
        this.args.formula.rSlope2.rayMul(
          (utilizationRate - this.args.formula.uOptimal).rayDiv(
            FULL_UTILIZATION_RATE - this.args.formula.uOptimal,
          ),
        );

      // Check if the calculated premium rate matches the expected value
      expect(premiumRate).to.equal(expectedPremiumRate);
    });

    it("should return the capped rate when utilization rate is at full utilization", async function () {
      // Calculate premium rate with utilization rate at full utilization
      const utilizationRate = FULL_UTILIZATION_RATE;
      const premiumRate =
        await this.contracts.TestableVirtualPool.getPremiumRate(
          utilizationRate,
        );

      // The expected premium rate is base rate plus slope 1 rate plus slope 2 rate
      const expectedPremiumRate =
        this.args.formula.r0 +
        this.args.formula.rSlope1 +
        this.args.formula.rSlope2;

      // Check if the calculated premium rate matches the expected value
      expect(premiumRate).to.equal(expectedPremiumRate);
    });
  });
}
