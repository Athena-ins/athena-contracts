import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function EcclesiaDao_increaseLockAmount() {
  context("increaseLockAmount", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if the amount to increase is zero", async function (this: Arguments) {
      // Attempt to increase the lock amount by zero
      expect(
        await this.contract.increaseLockAmount(0, { from: this.signers.user }),
      ).to.be.revertedWith("BadAmount");
    });

    it("should revert if the user does not have an existing lock", async function (this: Arguments) {
      // Attempt to increase lock amount for a user without an existing lock
      expect(
        await this.contract.increaseLockAmount(this.args.amount, {
          from: this.signers.userWithoutLock,
        }),
      ).to.be.revertedWith("LockDoesNotExist");
    });

    it("should revert if the user's lock has expired", async function (this: Arguments) {
      // Attempt to increase lock amount for a user whose lock has expired
      expect(
        await this.contract.increaseLockAmount(this.args.amount, {
          from: this.signers.userWithExpiredLock,
        }),
      ).to.be.revertedWith("LockExpired");
    });

    it("should successfully increase the lock amount", async function (this: Arguments) {
      // Increase the lock amount for a user with a valid lock
      expect(
        await this.contract.increaseLockAmount(this.args.additionalAmount, {
          from: this.signers.userWithValidLock,
        }),
      ).to.not.throw;
    });

    it("should correctly update the user's locked balance and votes", async function (this: Arguments) {
      // Increase lock amount and check if the user's locked balance and votes are updated correctly
      await this.contract.increaseLockAmount(this.args.additionalAmount, {
        from: this.signers.userWithValidLock,
      });

      // Verify the updated locked balance
      const updatedLock = await this.contract.locks(
        this.signers.userWithValidLock.address,
      );
      expect(updatedLock.amount).to.equal(this.args.totalLockedAmount);

      // Verify the updated votes
      const updatedVotes = await this.contract.balanceOf(
        this.signers.userWithValidLock.address,
      );
      expect(updatedVotes).to.equal(this.args.totalVotes);
    });

    it("should mint additional votes corresponding to the increased amount", async function (this: Arguments) {
      // Increase lock amount and verify additional votes are minted
      await this.contract.increaseLockAmount(this.args.additionalAmount, {
        from: this.signers.userWithValidLock,
      });
      // Add logic to verify additional votes are minted
    });
  });
}
