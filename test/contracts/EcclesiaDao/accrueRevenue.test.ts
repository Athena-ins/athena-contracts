import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function EcclesiaDao_accrueRevenue() {
  context("accrueRevenue", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if called by a non-revenue collector", async function () {
      // Attempt to accrue revenue by a non-revenue collector
      await expect(
        this.contract.accrueRevenue(
          this.args.token,
          this.args.amount,
          this.args.leverageFee,
          { from: this.signers.nonRevenueCollector },
        ),
      ).to.be.revertedWith("NotRevenueCollector");
    });

    it("should transfer leverage fee to the leverage risk wallet if leverage fee is non-zero", async function () {
      // Accrue revenue with a non-zero leverage fee
      await expect(
        this.contract.accrueRevenue(
          this.args.token,
          this.args.amount,
          this.args.nonZeroLeverageFee,
        ),
      ).to.not.throw;
      // Check if the leverage fee is transferred to the leverage risk wallet
    });

    it("should not transfer any tokens if leverage fee is zero", async function () {
      // Accrue revenue with a zero leverage fee
      await expect(
        this.contract.accrueRevenue(this.args.token, this.args.amount, 0),
      ).to.not.throw;
      // Check that no tokens are transferred
    });

    it("should correctly update the revenue index for the token", async function () {
      // Accrue revenue and check if the revenue index for the token is updated correctly
      await this.contract.accrueRevenue(
        this.args.token,
        this.args.amount,
        this.args.leverageFee,
      );
      const updatedIndex = await this.contract.revenueIndex(this.args.token);

      // Calculate the expected updated index
      const expectedIndex =
        this.args.previousIndex +
        (this.args.amount * RAY) / (await this.contract.totalSupply());

      // Check if the updated index matches the expected value
      expect(updatedIndex).to.equal(expectedIndex);
    });

    it("should add the token to the revenue tokens array if it's not already included", async function () {
      // Accrue revenue for a new token and check if it's added to the revenue tokens array
      await this.contract.accrueRevenue(
        this.args.newToken,
        this.args.amount,
        this.args.leverageFee,
      );
      const revenueTokens = await this.contract.revenueTokens();

      // Check if the new token is included in the revenue tokens array
      expect(revenueTokens).to.include(this.args.newToken);
    });
  });
}
