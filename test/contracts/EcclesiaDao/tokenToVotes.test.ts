import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function EcclesiaDao_tokenToVotes() {
  context("tokenToVotes", function () {
    before(async function () {
      this.args = {};
    });

    it("should return zero votes for zero ATEN amount", async function () {
      // Convert zero ATEN to votes
      const votes = await this.contract.tokenToVotes(0, this.args.lockDuration);
      expect(votes).to.equal(0);
    });

    it("should return fewer votes than ATEN for lock duration smaller than EQUILIBRIUM_LOCK", async function () {
      // Convert ATEN to votes for a duration smaller than EQUILIBRIUM_LOCK
      const votes = await this.contract.tokenToVotes(
        this.args.atenAmount,
        this.args.durationSmallerThanEquilibrium,
      );
      expect(votes).to.be.below(this.args.atenAmount);
    });

    it("should return equal votes to ATEN for lock duration equal to EQUILIBRIUM_LOCK", async function () {
      // Convert ATEN to votes for a duration equal to EQUILIBRIUM_LOCK
      const votes = await this.contract.tokenToVotes(
        this.args.atenAmount,
        EQUILIBRIUM_LOCK,
      );
      expect(votes).to.equal(this.args.atenAmount);
    });

    it("should return more votes than ATEN for lock duration larger than EQUILIBRIUM_LOCK", async function () {
      // Convert ATEN to votes for a duration larger than EQUILIBRIUM_LOCK
      const votes = await this.contract.tokenToVotes(
        this.args.atenAmount,
        this.args.durationLargerThanEquilibrium,
      );
      expect(votes).to.be.above(this.args.atenAmount);
    });

    it("should correctly apply the weight bias based on lock duration", async function () {
      // Convert ATEN to votes for different lock durations and check if the bias is correctly applied
      const shortDurationVotes = await this.contract.tokenToVotes(
        this.args.atenAmount,
        this.args.shortDuration,
      );
      const longDurationVotes = await this.contract.tokenToVotes(
        this.args.atenAmount,
        this.args.longDuration,
      );
      // Expect more votes for longer duration due to the weight bias
      expect(longDurationVotes).to.be.above(shortDurationVotes);
    });

    it("should adhere to the maximum votes cap for extremely long durations", async function () {
      // Convert ATEN to votes for a duration longer than MAX_LOCK and check if it adheres to the maximum votes cap
      const extremeDurationVotes = await this.contract.tokenToVotes(
        this.args.atenAmount,
        this.args.extremeDuration,
      );
      const maxDurationVotes = await this.contract.tokenToVotes(
        this.args.atenAmount,
        MAX_LOCK,
      );
      expect(extremeDurationVotes).to.equal(maxDurationVotes);
    });
  });
}
