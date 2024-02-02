import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function EcclesiaDao_withdrawETH() {
  context("withdrawETH", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if called by a non-owner", async function () {
      // Attempt to withdraw ETH by a non-owner
      await expect(
        this.contract.withdrawETH({ from: this.signers.nonOwner }),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should successfully withdraw ETH to the owner's address", async function () {
      // Get the initial balance of the contract and the owner
      const initialContractBalance = await ethers.provider.getBalance(
        this.contract.address,
      );
      const initialOwnerBalance = await ethers.provider.getBalance(
        this.signers.owner.address,
      );

      // Withdraw ETH
      const tx = await this.contract.withdrawETH();
      const receipt = await tx.wait();
      const { gasUsed, effectiveGasPrice } = receipt;
      const txCost = gasUsed.mul(effectiveGasPrice);

      // Get the final balance of the contract and the owner
      const finalContractBalance = await ethers.provider.getBalance(
        this.contract.address,
      );
      const finalOwnerBalance = await ethers.provider.getBalance(
        this.signers.owner.address,
      );

      // Check if the contract's balance is now zero
      expect(finalContractBalance).to.equal(0);

      // Check if the owner's balance increased by the initial balance of the contract minus the gas cost
      expect(finalOwnerBalance).to.equal(
        initialOwnerBalance.add(initialContractBalance).sub(txCost),
      );
    });

    it("should emit no events", async function () {
      // Withdraw ETH and check that no events are emitted
      const tx = await this.contract.withdrawETH();
      const receipt = await tx.wait();

      expect(receipt.events.length).to.equal(0);
    });
  });
}
