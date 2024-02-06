import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_changeRequiredCollateral() {
  context("changeRequiredCollateral", function () {
    it("should revert if called by a non-owner", async function () {
      // Attempt to call changeRequiredCollateral by a non-owner account
      expect(
        await this.contract
          .connect(this.signers.nonOwner)
          .changeRequiredCollateral(this.args.newCollateralAmount),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should successfully change the required collateral amount when called by the owner", async function () {
      // Call changeRequiredCollateral by the owner account
      await this.contract.changeRequiredCollateral(
        this.args.newCollateralAmount,
      );

      // Retrieve the updated collateral amount from the contract
      const updatedCollateralAmount = await this.contract.collateralAmount();

      // Check if the collateral amount is updated correctly
      expect(updatedCollateralAmount).to.equal(this.args.newCollateralAmount);
    });

    it("should emit a CollateralAmountChanged event on successful collateral change", async function () {
      // Call changeRequiredCollateral and get transaction receipt
      const tx = await this.contract.changeRequiredCollateral(
        this.args.newCollateralAmount,
      );
      const receipt = await tx.wait();

      // Check if the CollateralAmountChanged event was emitted with the correct parameter
      expect(receipt.events).to.deep.include({
        event: "CollateralAmountChanged",
        args: [this.args.newCollateralAmount],
      });
    });
  });
}
