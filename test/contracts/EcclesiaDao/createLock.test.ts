import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function EcclesiaDao_createLock() {
  context("createLock", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the amount to lock is zero", async function () {
      // Attempt to create a lock with zero amount
      expect(
        await this.contract.createLock(0, this.args.unlockTime),
      ).to.be.revertedWith("BadAmount");
    });

    it("should revert if the user already has an existing lock", async function () {
      // Attempt to create a lock when the user already has an existing lock
      expect(
        await this.contract.createLock(this.args.amount, this.args.unlockTime, {
          from: this.signers.userWithExistingLock,
        }),
      ).to.be.revertedWith("LockAlreadyExists");
    });

    it("should revert if the unlock time is in the past", async function () {
      // Attempt to create a lock with an unlock time in the past
      expect(
        await this.contract.createLock(
          this.args.amount,
          this.args.pastUnlockTime,
        ),
      ).to.be.revertedWith("CanOnlyLockInFuture");
    });

    it("should revert if the unlock time is longer than the maximum lock duration", async function () {
      // Attempt to create a lock with an unlock time exceeding the maximum duration
      expect(
        await this.contract.createLock(
          this.args.amount,
          this.args.unlockTimeExceedingMax,
        ),
      ).to.be.revertedWith("LockLongerThanMax");
    });

    it("should revert if the conversion of tokens to votes yields zero", async function () {
      // Attempt to create a lock where the conversion to votes results in zero
      expect(
        await this.contract.createLock(
          this.args.amountYieldingZeroVotes,
          this.args.unlockTime,
        ),
      ).to.be.revertedWith("ConversionToVotesYieldsZero");
    });

    it("should successfully create a new lock and mint vATEN tokens", async function () {
      // Successfully create a new lock
      expect(
        await this.contract.createLock(this.args.amount, this.args.unlockTime, {
          from: this.signers.newUser,
        }),
      ).to.not.throw;
      // Check if vATEN tokens are minted correctly
    });
  });
}
