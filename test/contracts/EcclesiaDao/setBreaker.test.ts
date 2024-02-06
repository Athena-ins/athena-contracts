import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function EcclesiaDao_setBreaker() {
  context("setBreaker", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if called by a non-owner", async function () {
      // Attempt to set the breaker by a non-owner
      expect(
        await this.contract.setBreaker(this.args.breakerValue, {
          from: this.signers.nonOwner,
        }),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should successfully set the breaker to true", async function () {
      // Set the breaker to true
      expect(await this.contract.setBreaker(true, { from: this.signers.owner }))
        .to.not.throw;

      // Verify the breaker is set to true
      const currentBreakerStatus = await this.contract.breaker();
      expect(currentBreakerStatus).to.equal(true);
    });

    it("should successfully set the breaker to false", async function () {
      // Set the breaker to false
      expect(
        await this.contract.setBreaker(false, { from: this.signers.owner }),
      ).to.not.throw;

      // Verify the breaker is set to false
      const currentBreakerStatus = await this.contract.breaker();
      expect(currentBreakerStatus).to.equal(false);
    });

    it("should emit a SetBreaker event with the correct parameters", async function () {
      // Set the breaker and check for the SetBreaker event
      const tx = await this.contract.setBreaker(this.args.breakerValue, {
        from: this.signers.owner,
      });
      const receipt = await tx.wait();

      expect(receipt.events).to.deep.include({
        event: "SetBreaker",
        args: [this.args.breakerValue],
      });
    });
  });
}
