import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_addCoverTermsForPool() {
  describe("addCoverTermsForPool Functionality", function () {
    beforeEach(async function () {
      // Common setup before each test, e.g., deploying contracts
    });

    it("should revert if called by a non-owner account", async function () {
      // Attempt to call addCoverTermsForPool by a non-owner account
      await expect(
        this.contract.addCoverTermsForPool(
          this.args.poolId,
          this.args.ipfsAgreementCid,
          { from: nonOwnerAccount },
        ),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should successfully update the terms for a new pool", async function () {
      // Call addCoverTermsForPool with new poolId and ipfsAgreementCid
      const tx = await this.contract.addCoverTermsForPool(
        this.args.newPoolId,
        this.args.newIpfsAgreementCid,
        { from: ownerAccount },
      );

      // Wait for the transaction to be mined
      await tx.wait();

      // Check if the poolIdToCoverTerms mapping has been updated
      const storedCid = await this.contract.poolIdToCoverTerms(
        this.args.newPoolId,
      );
      expect(storedCid).to.equal(this.args.newIpfsAgreementCid);
    });

    it("should successfully overwrite existing terms for an existing pool", async function () {
      // First add a term to be overwritten
      await this.contract.addCoverTermsForPool(
        this.args.existingPoolId,
        this.args.oldIpfsAgreementCid,
        { from: ownerAccount },
      );

      // Call addCoverTermsForPool to overwrite the term
      const tx = await this.contract.addCoverTermsForPool(
        this.args.existingPoolId,
        this.args.updatedIpfsAgreementCid,
        { from: ownerAccount },
      );

      // Wait for the transaction to be mined
      await tx.wait();

      // Check if the poolIdToCoverTerms mapping has been updated
      const storedCid = await this.contract.poolIdToCoverTerms(
        this.args.existingPoolId,
      );
      expect(storedCid).to.equal(this.args.updatedIpfsAgreementCid);
    });
  });
}
