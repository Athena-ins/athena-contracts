import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool__utilization() {
  context("_utilization", function () {
    before(async function () {
      this.args = {};
    });

    it("should return zero utilization rate if the liquidity is zero", function () {
      // Compute utilization with zero liquidity
      const rate = this.contracts.TestableVirtualPool.utilization(
        this.args.coveredCapital,
        0, // Zero liquidity
      );

      // The expected utilization rate is 0
      expect(rate).to.equal(0);
    });

    it("should return the correct utilization rate when liquidity is available", function () {
      // Compute utilization with non-zero liquidity
      const rate = this.contracts.TestableVirtualPool.utilization(
        this.args.coveredCapital,
        this.args.liquidity,
      );

      // Calculate the expected utilization rate
      const expectedRate = this.args.expectedUtilizationRate;

      // Check if the computed rate matches the expected value
      expect(rate).to.equal(expectedRate);
    });

    it("should cap the utilization rate at 100%", function () {
      // Compute utilization with covered capital exceeding liquidity
      const rate = this.contracts.TestableVirtualPool.utilization(
        this.args.coveredCapitalExceedingLiquidity,
        this.args.liquidity,
      );

      // The utilization rate should be capped at 100%
      expect(rate).to.equal(FULL_UTILIZATION_RATE);
    });
  });
}
