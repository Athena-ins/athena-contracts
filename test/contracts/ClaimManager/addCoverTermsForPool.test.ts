import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function ClaimManager_addCoverTermsForPool() {
  describe("addCoverTermsForPool Functionality", function (this: Arguments) {
    beforeEach(async function (this: Arguments) {
      this.args = {
        nonOwnerAccount: this.signers.user,
        poolId: 0,
        ipfsAgreementCid: "QmY5W9p5B6q2Z5kXs3mZz2b6z3Z5kXs3mZz2b6z",
        newPoolId: 1,
        newIpfsAgreementCid: "QmY5W9p5B6q2Z5kXs3mZz2b6z3Z5kXs3mZz2b6z",
        existingPoolId: 2,
        oldIpfsAgreementCid: "QmY5W9p5B6q2Z5kXs3mZz2b6z3Z5kXs3mZz2b6z",
        updatedIpfsAgreementCid: "QmY5W9p5B6q2Z5kXs3mZz2b6z3Z5kXs3mZz2b6z",
      };
    });

    it("should revert if called by a non-owner account", async function (this: Arguments) {
      // Attempt to call addCoverTermsForPool by a non-owner account
      expect(
        await this.contract.addCoverTermsForPool(
          this.args.poolId,
          this.args.ipfsAgreementCid,
          { from: this.args.nonOwnerAccount },
        ),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should successfully update the terms for a new pool", async function (this: Arguments) {
      // Call addCoverTermsForPool with new poolId and ipfsAgreementCid
      const tx = await this.contract.addCoverTermsForPool(
        this.args.newPoolId,
        this.args.newIpfsAgreementCid,
        { from: this.args.ownerAccount },
      );

      // Wait for the transaction to be mined
      await tx.wait();

      // Check if the poolIdToCoverTerms mapping has been updated
      const storedCid = await this.contract.poolIdToCoverTerms(
        this.args.newPoolId,
      );
      expect(storedCid).to.equal(this.args.newIpfsAgreementCid);
    });

    it("should successfully overwrite existing terms for an existing pool", async function (this: Arguments) {
      // First add a term to be overwritten
      await this.contract.addCoverTermsForPool(
        this.args.existingPoolId,
        this.args.oldIpfsAgreementCid,
        { from: this.args.ownerAccount },
      );

      // Call addCoverTermsForPool to overwrite the term
      const tx = await this.contract.addCoverTermsForPool(
        this.args.existingPoolId,
        this.args.updatedIpfsAgreementCid,
        { from: this.args.ownerAccount },
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
