import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_initiateClaim() {
  context("initiateClaim", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if called by a non-cover owner", async function () {
      // Attempt to initiate a claim as a non-cover owner
      expect(
        await this.contract.initiateClaim(
          this.args.coverId,
          this.args.amountClaimed,
          this.args.ipfsMetaEvidenceCid,
          this.args.signature,
          { value: this.args.stake, from: this.signers.nonOwner },
        ),
      ).to.be.revertedWith("OnlyCoverOwner");
    });

    it("should revert if the IPFS meta-evidence CID is not authenticated", async function () {
      // Attempt to initiate a claim with an unauthenticated meta-evidence CID
      expect(
        await this.contract.initiateClaim(
          this.args.coverId,
          this.args.amountClaimed,
          this.args.invalidIpfsMetaEvidenceCid,
          this.args.signature,
          { value: this.args.stake },
        ),
      ).to.be.revertedWith("InvalidMetaEvidence");
    });

    it("should revert if the claimed amount is zero", async function () {
      // Attempt to initiate a claim with a zero claimed amount
      expect(
        await this.contract.initiateClaim(
          this.args.coverId,
          0,
          this.args.ipfsMetaEvidenceCid,
          this.args.signature,
          { value: this.args.stake },
        ),
      ).to.be.revertedWith("CannotClaimZero");
    });

    it("should revert if there is not enough ETH for arbitration and collateral", async function () {
      // Attempt to initiate a claim with insufficient ETH for arbitration and collateral
      expect(
        await this.contract.initiateClaim(
          this.args.coverId,
          this.args.amountClaimed,
          this.args.ipfsMetaEvidenceCid,
          this.args.signature,
          { value: this.args.insufficientStake },
        ),
      ).to.be.revertedWith("NotEnoughEthForClaim");
    });

    it("should revert if there is a previous claim still ongoing for the cover", async function () {
      // Attempt to initiate a claim when there is an ongoing claim for the cover
      expect(
        await this.contract.initiateClaim(
          this.args.coverIdWithOngoingClaim,
          this.args.amountClaimed,
          this.args.ipfsMetaEvidenceCid,
          this.args.signature,
          { value: this.args.stake },
        ),
      ).to.be.revertedWith("PreviousClaimStillOngoing");
    });

    it("should successfully initiate a new claim", async function () {
      // Successfully initiate a new claim
      expect(
        await this.contract.initiateClaim(
          this.args.coverId,
          this.args.amountClaimed,
          this.args.ipfsMetaEvidenceCid,
          this.args.signature,
          { value: this.args.stake },
        ),
      ).to.not.throw;
    });

    it("should correctly update the claim data in the contract", async function () {
      // Initiate a new claim and check the claim data
      await this.contract.initiateClaim(
        this.args.coverId,
        this.args.amountClaimed,
        this.args.ipfsMetaEvidenceCid,
        this.args.signature,
        { value: this.args.stake },
      );

      const newClaimId = (await this.contract.nextClaimId()) - 1;
      const newClaim = await this.contract.claims(newClaimId);

      expect(newClaim.coverId).to.equal(this.args.coverId);
      expect(newClaim.amount).to.equal(this.args.amountClaimed);
      expect(newClaim.deposit).to.equal(this.args.stake);
      // Check other claim data as needed
    });

    it("should emit a ClaimCreated event with correct parameters", async function () {
      // Initiate a claim and check for the ClaimCreated event emission
      const tx = await this.contract.initiateClaim(
        this.args.coverId,
        this.args.amountClaimed,
        this.args.ipfsMetaEvidenceCid,
        this.args.signature,
        { value: this.args.stake },
      );
      const receipt = await tx.wait();

      const claimCreatedEvent = receipt.events.find(
        (event) => event.event === "ClaimCreated",
      );
      expect(claimCreatedEvent.args).to.deep.equal([
        this.signers.owner.address,
        this.args.coverId,
        this.args.nextClaimId,
      ]);
    });

    it("should emit a MetaEvidence event with correct parameters", async function () {
      // Initiate a claim and check for the MetaEvidence event emission
      const tx = await this.contract.initiateClaim(
        this.args.coverId,
        this.args.amountClaimed,
        this.args.ipfsMetaEvidenceCid,
        this.args.signature,
        { value: this.args.stake },
      );
      const receipt = await tx.wait();

      const metaEvidenceEvent = receipt.events.find(
        (event) => event.event === "MetaEvidence",
      );
      expect(metaEvidenceEvent.args).to.deep.equal([
        this.args.nextClaimId,
        this.args.ipfsMetaEvidenceCid,
      ]);
    });
  });
}
