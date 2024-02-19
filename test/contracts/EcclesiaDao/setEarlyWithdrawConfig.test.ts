import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function EcclesiaDao_setEarlyWithdrawConfig() {
  context("setEarlyWithdrawConfig", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if called by a non-owner", async function (this: Arguments) {
      // Attempt to set early withdraw configuration by a non-owner
      expect(
        await this.contract.setEarlyWithdrawConfig(
          this.args.newEarlyWithdrawBpsPerDay,
          this.args.newRedistributeBps,
          this.args.newBurnBps,
          this.args.newTreasuryBps,
          this.args.newTreasuryAddr,
          { from: this.signers.nonOwner },
        ),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert if the new early withdraw fee per day exceeds the maximum limit", async function (this: Arguments) {
      // Attempt to set a fee per day that exceeds the maximum limit
      expect(
        await this.contract.setEarlyWithdrawConfig(
          this.args.excessiveFeePerDay,
          this.args.newRedistributeBps,
          this.args.newBurnBps,
          this.args.newTreasuryBps,
          this.args.newTreasuryAddr,
        ),
      ).to.be.revertedWith("FeePerDayTooHigh");
    });

    it("should revert if the sum of fee distribution does not equal 100%", async function (this: Arguments) {
      // Attempt to set a fee distribution that does not sum up to 100%
      expect(
        await this.contract.setEarlyWithdrawConfig(
          this.args.newEarlyWithdrawBpsPerDay,
          this.args.newRedistributeBps,
          this.args.newBurnBps,
          this.args.invalidTotalBps, // Invalid total Bps
          this.args.newTreasuryAddr,
        ),
      ).to.be.revertedWith("InvalidBps");
    });

    it("should revert if the treasury address is zero and treasury Bps is non-zero", async function (this: Arguments) {
      // Attempt to set a non-zero treasury Bps with a zero treasury address
      expect(
        await this.contract.setEarlyWithdrawConfig(
          this.args.newEarlyWithdrawBpsPerDay,
          this.args.newRedistributeBps,
          this.args.newBurnBps,
          this.args.nonZeroTreasuryBps,
          ethers.constants.AddressZero,
        ),
      ).to.be.revertedWith("InvalidTreasuryAddr");
    });

    it("should successfully update the early withdraw configuration", async function (this: Arguments) {
      // Set the new early withdraw configuration
      expect(
        await this.contract.setEarlyWithdrawConfig(
          this.args.newEarlyWithdrawBpsPerDay,
          this.args.newRedistributeBps,
          this.args.newBurnBps,
          this.args.newTreasuryBps,
          this.args.newTreasuryAddr,
        ),
      ).to.not.throw;

      // Verify the updated configuration
      const config = await this.contract.getEarlyWithdrawConfig(); // Replace with the actual function to retrieve the config
      expect(config.earlyWithdrawBpsPerDay).to.equal(
        this.args.newEarlyWithdrawBpsPerDay,
      );
      expect(config.redistributeBps).to.equal(this.args.newRedistributeBps);
      expect(config.burnBps).to.equal(this.args.newBurnBps);
      expect(config.treasuryBps).to.equal(this.args.newTreasuryBps);
      expect(config.treasuryWallet).to.equal(this.args.newTreasuryAddr);
    });

    it("should emit a SetEarlyWithdrawConfig event with the correct parameters", async function (this: Arguments) {
      // Set the new early withdraw configuration and check for the event
      const tx = await this.contract.setEarlyWithdrawConfig(
        this.args.newEarlyWithdrawBpsPerDay,
        this.args.newRedistributeBps,
        this.args.newBurnBps,
        this.args.newTreasuryBps,
        this.args.newTreasuryAddr,
      );
      const receipt = await tx.wait();

      expect(receipt.events).to.deep.include({
        event: "SetEarlyWithdrawConfig",
        args: [
          this.args.newEarlyWithdrawBpsPerDay,
          this.args.newRedistributeBps,
          this.args.newBurnBps,
          this.args.newTreasuryBps,
          this.args.newTreasuryAddr,
        ],
      });
    });
  });
}
