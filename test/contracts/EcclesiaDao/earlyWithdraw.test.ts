import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function EcclesiaDao_earlyWithdraw() {
  context("earlyWithdraw", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if the user does not have an existing lock", async function (this: Arguments) {
      // Attempt to early withdraw without an existing lock
      expect(
        await this.contract.earlyWithdraw(this.args.amount, {
          from: this.signers.userWithoutLock,
        }),
      ).to.be.revertedWith("LockDoesNotExist");
    });

    it("should revert if the lock has already expired", async function (this: Arguments) {
      // Attempt to early withdraw after the lock has expired
      expect(
        await this.contract.earlyWithdraw(this.args.amount, {
          from: this.signers.userWithExpiredLock,
        }),
      ).to.be.revertedWith("LockExpired");
    });

    it("should revert if the withdrawal amount exceeds the locked amount", async function (this: Arguments) {
      // Attempt to withdraw an amount greater than the locked amount
      expect(
        await this.contract.earlyWithdraw(this.args.amountGreaterThanLocked, {
          from: this.signers.userWithValidLock,
        }),
      ).to.be.revertedWith("BadAmount");
    });

    it("should revert if the breaker is enabled", async function (this: Arguments) {
      // Attempt to early withdraw when the breaker is enabled
      await this.contract.setBreaker(true);
      expect(
        await this.contract.earlyWithdraw(this.args.amount, {
          from: this.signers.userWithValidLock,
        }),
      ).to.be.revertedWith("UnnecessaryEarlyWithdraw");
      await this.contract.setBreaker(false); // Reset the breaker for subsequent tests
    });

    it("should revert if the user does not have enough votes to burn", async function (this: Arguments) {
      // Attempt to early withdraw when the user does not have enough votes
      expect(
        await this.contract.earlyWithdraw(this.args.amount, {
          from: this.signers.userWithInsufficientVotes,
        }),
      ).to.be.revertedWith("NotEnoughVotes");
    });

    it("should burn the corresponding amount of votes", async function (this: Arguments) {
      // Early withdraw and check if the correct amount of votes is burned
      await this.contract.earlyWithdraw(this.args.amount, {
        from: this.signers.userWithValidLock,
      });
      // Add logic to verify the correct amount of votes is burned
    });

    it("should apply the correct penalty fees and distribute them", async function (this: Arguments) {
      // Early withdraw and verify the correct penalty fees are applied and distributed
      await this.contract.earlyWithdraw(this.args.amount, {
        from: this.signers.userWithValidLock,
      });
      // Add logic to verify the penalty fees and their distribution
    });

    it("should transfer the remaining ATEN back to the user after deducting the penalty", async function (this: Arguments) {
      // Early withdraw and check if the remaining ATEN is transferred back to the user
      await this.contract.earlyWithdraw(this.args.amount, {
        from: this.signers.userWithValidLock,
      });
      // Add logic to verify the transfer of remaining ATEN to the user
    });

    it("should emit an EarlyWithdraw event with the correct parameters", async function (this: Arguments) {
      // Early withdraw and check for the EarlyWithdraw event
      const tx = await this.contract.earlyWithdraw(this.args.amount, {
        from: this.signers.userWithValidLock,
      });
      const receipt = await tx.wait();

      expect(receipt.events).to.deep.include({
        event: "EarlyWithdraw",
        args: [
          this.signers.userWithValidLock.address,
          this.args.amount,
          block.timestamp,
        ],
      });
    });
  });
}
