import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_updateConfig() {
  context("updateConfig", function () {
    before(async function () {
      this.args = {};
    });

    it("should update the withdraw delay and maximum leverage", async function () {
      // Update the configuration
      await expect(
        this.contracts.LiquidityManager.updateConfig(
          this.args.newWithdrawDelay,
          this.args.newMaxLeverage,
        ),
      ).to.not.throw;

      // Retrieve the updated configuration
      const updatedWithdrawDelay =
        await this.contracts.LiquidityManager.withdrawDelay();
      const updatedMaxLeverage =
        await this.contracts.LiquidityManager.maxLeverage();

      // Check if the configuration updates are applied correctly
      expect(updatedWithdrawDelay).to.equal(this.args.newWithdrawDelay);
      expect(updatedMaxLeverage).to.equal(this.args.newMaxLeverage);
    });

    it("should only allow the owner to update the configuration", async function () {
      // Attempt to update the configuration by a non-owner
      await expect(
        this.contracts.LiquidityManager.connect(
          this.signers.nonOwner,
        ).updateConfig(this.args.newWithdrawDelay, this.args.newMaxLeverage),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow changing the withdraw delay independently", async function () {
      // Update only the withdraw delay
      await this.contracts.LiquidityManager.updateConfig(
        this.args.newWithdrawDelay,
        this.args.initialMaxLeverage, // Keep the initial max leverage
      );

      // Retrieve the updated withdraw delay
      const updatedWithdrawDelay =
        await this.contracts.LiquidityManager.withdrawDelay();

      // Check if only the withdraw delay is updated
      expect(updatedWithdrawDelay).to.equal(this.args.newWithdrawDelay);
    });

    it("should allow changing the maximum leverage independently", async function () {
      // Update only the maximum leverage
      await this.contracts.LiquidityManager.updateConfig(
        this.args.initialWithdrawDelay, // Keep the initial withdraw delay
        this.args.newMaxLeverage,
      );

      // Retrieve the updated maximum leverage
      const updatedMaxLeverage =
        await this.contracts.LiquidityManager.maxLeverage();

      // Check if only the maximum leverage is updated
      expect(updatedMaxLeverage).to.equal(this.args.newMaxLeverage);
    });
  });
}
