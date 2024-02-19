import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function ClaimManager_setKlerosConfiguration() {
  context("setKlerosConfiguration", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if called by a non-owner", async function (this: Arguments) {
      // Attempt to change Kleros configuration as a non-owner
      expect(
        await this.contract.setKlerosConfiguration(
          this.args.newKlerosArbitrator,
          this.args.newSubcourtId,
          this.args.newNbOfJurors,
          { from: this.signers.nonOwner },
        ),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should successfully update the Kleros arbitrator", async function (this: Arguments) {
      // Change Kleros configuration and check if the arbitrator is updated
      await this.contract.setKlerosConfiguration(
        this.args.newKlerosArbitrator,
        this.args.newSubcourtId,
        this.args.newNbOfJurors,
      );

      const updatedArbitrator = await this.contract.arbitrator();
      expect(updatedArbitrator).to.equal(this.args.newKlerosArbitrator);
    });

    it("should successfully update the subcourt ID", async function (this: Arguments) {
      // Change Kleros configuration and check if the subcourt ID is updated
      await this.contract.setKlerosConfiguration(
        this.args.newKlerosArbitrator,
        this.args.newSubcourtId,
        this.args.newNbOfJurors,
      );

      const [updatedSubcourtId] = await this.contract.klerosExtraData();
      expect(updatedSubcourtId).to.equal(this.args.newSubcourtId);
    });

    it("should successfully update the number of jurors", async function (this: Arguments) {
      // Change Kleros configuration and check if the number of jurors is updated
      await this.contract.setKlerosConfiguration(
        this.args.newKlerosArbitrator,
        this.args.newSubcourtId,
        this.args.newNbOfJurors,
      );

      const [, updatedNbOfJurors] = await this.contract.klerosExtraData();
      expect(updatedNbOfJurors).to.equal(this.args.newNbOfJurors);
    });
  });
}
