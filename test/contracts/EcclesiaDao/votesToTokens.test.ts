import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function EcclesiaDao_votesToTokens() {
  context("votesToTokens", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should correctly convert votes to ATEN for lock durations smaller than EQUILIBRIUM_LOCK", function (this: Arguments) {
      // Convert votes to ATEN for a lock duration smaller than EQUILIBRIUM_LOCK
      const tokens = this.contract.votesToTokens(
        this.args.votes,
        this.args.lockDurationShorterThanEquilibrium,
      );

      // Calculate expected tokens
      const expectedTokens = this.args.expectedTokensForShortDuration;

      // Check if the converted tokens match the expected value
      expect(tokens).to.equal(expectedTokens);
    });

    it("should correctly convert votes to ATEN for lock durations equal to EQUILIBRIUM_LOCK", function (this: Arguments) {
      // Convert votes to ATEN for a lock duration equal to EQUILIBRIUM_LOCK
      const tokens = this.contract.votesToTokens(
        this.args.votes,
        this.args.lockDurationEqualToEquilibrium,
      );

      // Calculate expected tokens
      const expectedTokens = this.args.expectedTokensForEquilibriumDuration;

      // Check if the converted tokens match the expected value
      expect(tokens).to.equal(expectedTokens);
    });

    it("should correctly convert votes to ATEN for lock durations larger than EQUILIBRIUM_LOCK", function (this: Arguments) {
      // Convert votes to ATEN for a lock duration larger than EQUILIBRIUM_LOCK
      const tokens = this.contract.votesToTokens(
        this.args.votes,
        this.args.lockDurationLongerThanEquilibrium,
      );

      // Calculate expected tokens
      const expectedTokens = this.args.expectedTokensForLongDuration;

      // Check if the converted tokens match the expected value
      expect(tokens).to.equal(expectedTokens);
    });

    it("should return zero ATEN when converting zero votes", function (this: Arguments) {
      // Convert zero votes to ATEN
      const tokens = this.contract.votesToTokens(0, this.args.lockDuration);

      // Check if the converted tokens are zero
      expect(tokens).to.equal(0);
    });

    it("should handle edge cases and boundary values correctly", function (this: Arguments) {
      // Test edge cases and boundary values for votes to tokens conversion
      // Add specific edge case scenarios as needed
    });
  });
}
