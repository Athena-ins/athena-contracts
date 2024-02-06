import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_changeMetaEvidenceGuardian() {
  context("changeMetaEvidenceGuardian", function () {
    beforeEach(async function () {
      // Common setup before each test
    });

    it("should revert if trying to set the meta-evidence guardian to address zero", async function () {
      // Attempt to set the meta-evidence guardian to the zero address
      expect(
        await this.contract.changeMetaEvidenceGuardian(
          ethers.constants.AddressZero,
        ),
      ).to.be.revertedWith("GuardianSetToAddressZero");
    });

    it("should allow the owner to change the meta-evidence guardian", async function () {
      // Change the meta-evidence guardian by the owner
      expect(
        await this.contract.changeMetaEvidenceGuardian(
          this.args.newMetaEvidenceGuardian,
          { from: this.signers.owner },
        ),
      ).to.not.throw;

      // Verify the change
      const newGuardian = await this.contract.metaEvidenceGuardian();
      expect(newGuardian).to.equal(this.args.newMetaEvidenceGuardian);
    });

    it("should revert if a non-owner tries to change the meta-evidence guardian", async function () {
      // Attempt to change the meta-evidence guardian by a non-owner
      expect(
        await this.contract.changeMetaEvidenceGuardian(
          this.args.newMetaEvidenceGuardian,
          { from: this.signers.notOwner },
        ),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
}
