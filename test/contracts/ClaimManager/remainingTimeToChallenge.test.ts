import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_remainingTimeToChallenge() {
  context("remainingTimeToChallenge", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the claim does not exist", async function () {
      // Attempt to get the remaining time to challenge for a non-existent claim
      expect(
        await this.contract.remainingTimeToChallenge(
          this.args.nonExistentClaimId,
        ),
      ).to.be.revertedWith("ClaimDoesNotExist"); // Use the actual error message
    });

    it("should return 0 if the claim status is not 'Initiated'", async function () {
      // Get the remaining time for a claim not in 'Initiated' status
      const remainingTime = await this.contract.remainingTimeToChallenge(
        this.args.claimIdNotInitiated,
      );

      // Check if the returned value is 0
      expect(remainingTime).to.equal(0);
    });

    it("should return 0 if the challenge period has expired", async function () {
      // Get the remaining time for a claim where the challenge period has expired
      const remainingTime = await this.contract.remainingTimeToChallenge(
        this.args.expiredChallengeClaimId,
      );

      // Check if the returned value is 0
      expect(remainingTime).to.equal(0);
    });

    it("should return the correct remaining time to challenge an 'Initiated' claim", async function () {
      // Get the remaining time for a claim in 'Initiated' status with time left to challenge
      const remainingTime = await this.contract.remainingTimeToChallenge(
        this.args.initiatedClaimIdWithTimeLeft,
      );

      // Calculate the expected remaining time
      const expectedRemainingTime =
        this.args.challengePeriod -
        (block.timestamp - this.args.createdAtOfInitiatedClaim);

      // Check if the returned value matches the expected remaining time
      expect(remainingTime).to.be.closeTo(
        expectedRemainingTime,
        this.args.acceptableTimeDeviation,
      );
    });
  });
}
