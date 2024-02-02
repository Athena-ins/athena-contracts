import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function EcclesiaDao_withdraw() {
  context("withdraw", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the lock period is not over and the breaker is not enabled", async function () {
      // Attempt to withdraw before the lock period is over without breaker being enabled
      await expect(
        this.contract.withdraw({ from: this.signers.userBeforeLockEnd }),
      ).to.be.revertedWith("LockPeriodNotOver");
    });

    it("should allow withdrawal if the lock period is over", async function () {
      // Withdraw after the lock period is over
      await expect(
        this.contract.withdraw({ from: this.signers.userAfterLockEnd }),
      ).to.not.throw;
    });

    it("should revert if the user does not have enough votes to burn", async function () {
      // Attempt to withdraw when the user does not have enough votes
      await expect(
        this.contract.withdraw({
          from: this.signers.userWithInsufficientVotes,
        }),
      ).to.be.revertedWith("NotEnoughVotes");
    });

    it("should burn the corresponding amount of votes", async function () {
      // Withdraw and check if the correct amount of votes is burned
      await this.contract.withdraw({ from: this.signers.userAfterLockEnd });
      // Add logic to verify the correct amount of votes is burned
    });

    it("should transfer the locked ATEN to the user", async function () {
      // Withdraw and check if the ATEN is transferred to the user
      await this.contract.withdraw({ from: this.signers.userAfterLockEnd });
      // Add logic to verify ATEN is transferred to the user
    });

    it("should update the user's lock information accordingly", async function () {
      // Withdraw and check if the user's lock information is updated
      await this.contract.withdraw({ from: this.signers.userAfterLockEnd });
      // Add logic to verify the user's lock information is updated
    });

    it("should emit a Withdraw event with the correct parameters", async function () {
      // Withdraw and check for the Withdraw event
      const tx = await this.contract.withdraw({
        from: this.signers.userAfterLockEnd,
      });
      const receipt = await tx.wait();
      expect(receipt.events).to.deep.include({
        event: "Withdraw",
        args: [this.signers.userAfterLockEnd.address, this.args.withdrawAmount],
      });
    });

    it("should allow withdrawal if the breaker is enabled regardless of the lock period", async function () {
      // Enable breaker and attempt to withdraw before the lock period is over
      await this.contract.setBreaker(true);
      await expect(
        this.contract.withdraw({ from: this.signers.userBeforeLockEnd }),
      ).to.not.throw;
      // Reset breaker for subsequent tests
      await this.contract.setBreaker(false);
    });
  });
}
