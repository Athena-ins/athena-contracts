import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function EcclesiaDao_increaseUnlockTime() {
  context("increaseUnlockTime", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the user does not have an existing lock", async function () {
      // Attempt to increase unlock time for a user without an existing lock
      await expect(
        this.contract.increaseUnlockTime(this.args.newUnlockTime, {
          from: this.signers.userWithoutLock,
        }),
      ).to.be.revertedWith("LockDoesNotExist");
    });

    it("should revert if the user's lock has expired", async function () {
      // Attempt to increase unlock time for a user whose lock has expired
      await expect(
        this.contract.increaseUnlockTime(this.args.newUnlockTime, {
          from: this.signers.userWithExpiredLock,
        }),
      ).to.be.revertedWith("LockExpired");
    });

    it("should revert if the new unlock time is not longer than the current one", async function () {
      // Attempt to increase unlock time to a time not longer than the current one
      await expect(
        this.contract.increaseUnlockTime(this.args.currentUnlockTime, {
          from: this.signers.userWithValidLock,
        }),
      ).to.be.revertedWith("CanOnlyExtendLock");
    });

    it("should revert if the new unlock time is longer than the maximum lock duration", async function () {
      // Attempt to increase unlock time beyond the maximum lock duration
      await expect(
        this.contract.increaseUnlockTime(this.args.exceedingMaxUnlockTime, {
          from: this.signers.userWithValidLock,
        }),
      ).to.be.revertedWith("LockLongerThanMax");
    });

    it("should successfully increase the unlock time", async function () {
      // Increase the unlock time for a user with a valid lock
      await expect(
        this.contract.increaseUnlockTime(this.args.newValidUnlockTime, {
          from: this.signers.userWithValidLock,
        }),
      ).to.not.throw;
    });

    it("should correctly update the user's unlock time and mint additional votes", async function () {
      // Increase unlock time and check if the user's unlock time and votes are updated correctly
      await this.contract.increaseUnlockTime(this.args.newValidUnlockTime, {
        from: this.signers.userWithValidLock,
      });

      // Verify the updated unlock time
      const updatedLock = await this.contract.locks(
        this.signers.userWithValidLock.address,
      );
      expect(updatedLock.end).to.equal(this.args.newValidUnlockTime);

      // Verify the additional votes are minted
      const additionalVotes = await this.contract.balanceOf(
        this.signers.userWithValidLock.address,
      );
      expect(additionalVotes).to.be.greaterThan(this.args.previousVotes);
    });
  });
}
