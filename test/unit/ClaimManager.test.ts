import { utils } from "ethers";
import { expect } from "chai";
import {
  setNextBlockTimestamp,
  postTxHandler,
  getCurrentTime,
} from "../helpers/hardhat";
import { poolInfoFormat, claimInfoFormat } from "../helpers/dataFormat";
import { BigNumber } from "ethers";

const { parseUnits } = utils;

interface Arguments extends Mocha.Context {
  args: {
    poolId: number;
    lpAmount: BigNumber;
    coverAmount: BigNumber;
    coverPremiums: BigNumber;
    claimAmount: BigNumber;
    evidenceUploadPeriod: number;
    challengePeriod: number;
    overrulePeriod: number;
  };
}

export function ClaimManagerTest() {
  context("Claim Manager Test", function () {
    this.timeout(600_000);

    before(async function (this: Arguments) {
      // Initialize test arguments
      this.args = {
        poolId: 0,
        lpAmount: parseUnits("5000", 6),
        coverAmount: parseUnits("1000", 6),
        coverPremiums: parseUnits("200", 6),
        claimAmount: parseUnits("500", 6),
        evidenceUploadPeriod: 7 * 24 * 60 * 60, // 7 days
        challengePeriod: 10 * 24 * 60 * 60, // 10 days
        overrulePeriod: 5 * 24 * 60 * 60, // 5 days
      };
    });

    describe("Initial setup", function () {
      it("can create a test pool", async function (this: Arguments) {
        const poolId = this.args.poolId;
        const { uOptimal, r0, rSlope1, rSlope2 } =
          this.protocolConfig.poolFormula;

        await postTxHandler(
          this.contracts.LiquidityManager.createPool(
            this.contracts.CircleToken.address,
            0, // Aave strategy ID
            0,
            uOptimal,
            r0,
            rSlope1,
            rSlope2,
            [],
          ),
        );

        const poolInfo = await this.contracts.LiquidityManager.poolInfo(poolId);
        expect(poolInfo.paymentAsset.toLowerCase()).to.equal(
          this.contracts.CircleToken.address.toLowerCase(),
        );
      });

      it("accepts LP deposits", async function (this: Arguments) {
        expect(
          await this.helpers.openPosition(
            this.signers.user0,
            this.args.lpAmount,
            false,
            [this.args.poolId],
          ),
        ).to.not.throw;

        const positionInfo =
          await this.contracts.LiquidityManager.positionInfo(0);

        expect(positionInfo.supplied).to.equal(this.args.lpAmount);
      });

      it("allows a user to buy cover", async function (this: Arguments) {
        expect(
          await this.helpers.openCover(
            this.signers.user1,
            this.args.poolId,
            this.args.coverAmount,
            this.args.coverPremiums,
          ),
        ).to.not.throw;

        const coverInfo = await this.contracts.LiquidityManager.coverInfo(0);
        expect(coverInfo.coverAmount).to.equal(this.args.coverAmount);
        expect(coverInfo.isActive).to.be.true;
      });
    });

    describe("Basic claim process", function () {
      it("allows cover holder to initiate a claim", async function (this: Arguments) {
        const arbitrationCost =
          await this.contracts.ClaimManager.arbitrationCost();
        const claimCollateral =
          await this.contracts.ClaimManager.claimCollateral();
        const requiredDeposit = arbitrationCost.add(claimCollateral);

        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user1).initiateClaim(
            0, // coverId
            this.args.claimAmount,
            { value: requiredDeposit },
          ),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(0);
        expect(claimInfo.claimant).to.equal(this.signers.user1.address);
        expect(claimInfo.coverId).to.equal(0);
        expect(claimInfo.amount).to.equal(this.args.claimAmount);
        expect(claimInfo.status).to.equal(0); // Initiated
      });

      it("allows claimant to submit evidence", async function (this: Arguments) {
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).submitEvidenceForClaim(
            0, // claimId
            ["QmTestEvidence1", "QmTestEvidence2"],
          ),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(0);
        expect(claimInfo.evidence.length).to.equal(2);
        expect(claimInfo.evidence[0]).to.equal("QmTestEvidence1");
        expect(claimInfo.evidence[1]).to.equal("QmTestEvidence2");
      });

      it("allows challenge from another user", async function (this: Arguments) {
        const arbitrationCost =
          await this.contracts.ClaimManager.arbitrationCost();

        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user2).disputeClaim(
            0, // claimId
            { value: arbitrationCost },
          ),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(0);
        expect(claimInfo.prosecutor).to.equal(this.signers.user2.address);
        expect(claimInfo.status).to.equal(3); // Disputed
      });

      it("allows prosecutor to submit counter-evidence", async function (this: Arguments) {
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user2,
          ).submitEvidenceForClaim(
            0, // claimId
            ["QmTestCounterEvidence1"],
          ),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(0);
        expect(claimInfo.counterEvidence.length).to.equal(1);
        expect(claimInfo.counterEvidence[0]).to.equal("QmTestCounterEvidence1");
      });

      it("allows arbitrator to rule on dispute (reject claim)", async function (this: Arguments) {
        await postTxHandler(
          this.contracts.AthenaArbitrator.giveRuling(
            0, // disputeId
            2, // RulingOptions.RejectClaim
          ),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(0);
        expect(claimInfo.status).to.equal(6); // RejectedByCourtDecision
      });
    });

    describe("Appeal process", function () {
      it("allows claimant to appeal a rejected claim", async function (this: Arguments) {
        const appealCost = await this.contracts.ClaimManager.appealCost(0);

        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user1).appeal(
            0, // claimId
            { value: appealCost },
          ),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(0);
        expect(claimInfo.status).to.equal(4); // Appealed
        expect(claimInfo.appeals.length).to.equal(1);
      });

      it("allows additional evidence submission during appeal", async function (this: Arguments) {
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).submitEvidenceForClaim(
            0, // claimId
            ["QmTestAppealEvidence1"],
          ),
        );

        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user2,
          ).submitEvidenceForClaim(
            0, // claimId
            ["QmTestAppealCounterEvidence1"],
          ),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(0);
        expect(claimInfo.evidence.length).to.equal(3);
        expect(claimInfo.counterEvidence.length).to.equal(2);
      });

      it("allows arbitrator to rule on appeal (accept claim)", async function (this: Arguments) {
        await postTxHandler(
          this.contracts.AthenaArbitrator.giveRuling(
            0, // disputeId (same as original dispute)
            1, // RulingOptions.PayClaimant
          ),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(0);
        expect(claimInfo.status).to.equal(7); // AcceptedByCourtDecision
      });

      it("prevents withdrawal before overrule period ends", async function (this: Arguments) {
        await expect(
          this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).withdrawCompensation(0),
        ).to.revertTransactionWith("PeriodNotElapsed");
      });

      it("allows owner to overrule claim decision", async function (this: Arguments) {
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.deployer).overrule(
            0, // claimId
            false, // don't punish claimant
          ),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(0);
        expect(claimInfo.status).to.equal(5); // RejectedByOverrule
      });
    });

    describe("Compensation flow", function () {
      it("allows undisputed claim to be compensated after challenge period", async function (this: Arguments) {
        // Create a new cover
        expect(
          await this.helpers.openCover(
            this.signers.user1,
            this.args.poolId,
            this.args.coverAmount,
            this.args.coverPremiums,
          ),
        ).to.not.throw;

        // Create a claim
        const arbitrationCost =
          await this.contracts.ClaimManager.arbitrationCost();
        const claimCollateral =
          await this.contracts.ClaimManager.claimCollateral();
        const requiredDeposit = arbitrationCost.add(claimCollateral);

        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user1).initiateClaim(
            1, // coverId
            this.args.claimAmount,
            { value: requiredDeposit },
          ),
        );

        // Fast forward past challenge period
        await setNextBlockTimestamp({ days: 11 });

        // Withdraw compensation
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).withdrawCompensation(1),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(1);
        expect(claimInfo.status).to.equal(2); // Compensated
      });

      it("allows accepted claim to be compensated after overrule period", async function (this: Arguments) {
        // Create a new cover
        expect(
          await this.helpers.openCover(
            this.signers.user1,
            this.args.poolId,
            this.args.coverAmount,
            this.args.coverPremiums,
          ),
        ).to.not.throw;

        // Create a claim
        const arbitrationCost =
          await this.contracts.ClaimManager.arbitrationCost();
        const claimCollateral =
          await this.contracts.ClaimManager.claimCollateral();
        const requiredDeposit = arbitrationCost.add(claimCollateral);

        const claimId = await this.contracts.ClaimManager.nextClaimId();
        const disputeId = await this.contracts.AthenaArbitrator.nextDisputeID();

        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user1).initiateClaim(
            2, // coverId
            this.args.claimAmount,
            { value: requiredDeposit },
          ),
        );

        // Challenge the claim
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user2).disputeClaim(
            claimId, // claimId
            { value: arbitrationCost },
          ),
        );

        // Rule in favor of claimant
        await postTxHandler(
          this.contracts.AthenaArbitrator.giveRuling(
            disputeId, // disputeId
            1, // RulingOptions.PayClaimant
          ),
        );

        // Fast forward past overrule period
        await setNextBlockTimestamp({ days: 6 });

        // Withdraw compensation
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).withdrawCompensation(2),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(2);
        expect(claimInfo.status).to.equal(8); // CompensatedAfterDispute
      });

      it("allows prosecutor to withdraw reward for rejected claim", async function (this: Arguments) {
        // Create a new cover
        expect(
          await this.helpers.openCover(
            this.signers.user1,
            this.args.poolId,
            this.args.coverAmount,
            this.args.coverPremiums,
          ),
        ).to.not.throw;

        // Create a claim
        const arbitrationCost =
          await this.contracts.ClaimManager.arbitrationCost();
        const claimCollateral =
          await this.contracts.ClaimManager.claimCollateral();
        const requiredDeposit = arbitrationCost.add(claimCollateral);

        const claimId = await this.contracts.ClaimManager.nextClaimId();
        const disputeId = await this.contracts.AthenaArbitrator.nextDisputeID();

        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user1).initiateClaim(
            3, // coverId
            this.args.claimAmount,
            { value: requiredDeposit },
          ),
        );

        // Challenge the claim
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user2).disputeClaim(
            claimId, // claimId
            { value: arbitrationCost },
          ),
        );

        // Rule against claimant
        await postTxHandler(
          this.contracts.AthenaArbitrator.giveRuling(
            disputeId, // disputeId
            2, // RulingOptions.RejectClaim
          ),
        );

        // Wait for appeal period to end
        const appealPeriod =
          await this.contracts.AthenaArbitrator.appealPeriodDuration();
        await setNextBlockTimestamp({ seconds: Number(appealPeriod) + 100 });

        // Withdraw prosecutor reward
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user2,
          ).withdrawProsecutionReward(3),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(3);
        expect(claimInfo.status).to.equal(9); // ProsecutorPaid
      });
    });

    describe("Multiple appeals process", function () {
      it("handles multiple appeal rounds", async function (this: Arguments) {
        // Create a new cover
        expect(
          await this.helpers.openCover(
            this.signers.user1,
            this.args.poolId,
            this.args.coverAmount,
            this.args.coverPremiums,
          ),
        ).to.not.throw;

        // Create a claim
        const arbitrationCost =
          await this.contracts.ClaimManager.arbitrationCost();
        const claimCollateral =
          await this.contracts.ClaimManager.claimCollateral();
        const requiredDeposit = arbitrationCost.add(claimCollateral);

        const claimId = await this.contracts.ClaimManager.nextClaimId();
        const disputeId = await this.contracts.AthenaArbitrator.nextDisputeID();

        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user1).initiateClaim(
            4, // coverId
            this.args.claimAmount,
            { value: requiredDeposit },
          ),
        );

        // Challenge the claim
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user2).disputeClaim(
            claimId, // claimId
            { value: arbitrationCost },
          ),
        );

        // Rule in favor of claimant
        await postTxHandler(
          this.contracts.AthenaArbitrator.giveRuling(
            disputeId, // disputeId
            1, // RulingOptions.PayClaimant
          ),
        );

        // User2 appeals
        const appealCost = await this.contracts.ClaimManager.appealCost(4);

        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user2).appeal(
            claimId, // claimId
            { value: appealCost },
          ),
        );

        // Verify that prosecutor changed to the appellant
        const claimInfoAfterAppeal =
          await this.contracts.ClaimManager.claimInfo(4);
        expect(claimInfoAfterAppeal.prosecutor).to.equal(
          this.signers.user2.address,
        );

        // Submit evidence for appeal
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).submitEvidenceForClaim(4, ["QmTestMultipleAppealEvidence"]),
        );

        // Rule against claimant on appeal
        await postTxHandler(
          this.contracts.AthenaArbitrator.giveRuling(
            disputeId, // disputeId
            2, // RulingOptions.RejectClaim
          ),
        );

        // User1 appeals again
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user1).appeal(
            claimId, // claimId
            { value: appealCost },
          ),
        );

        // Verify appeal count
        const claimInfoAfterSecondAppeal =
          await this.contracts.ClaimManager.claimInfo(4);
        expect(claimInfoAfterSecondAppeal.appeals.length).to.equal(2);

        // Rule in favor of claimant in final appeal
        await postTxHandler(
          this.contracts.AthenaArbitrator.giveRuling(
            disputeId, // disputeId
            1, // RulingOptions.PayClaimant
          ),
        );

        // Wait for overrule period
        await setNextBlockTimestamp({ days: 6 });

        // Withdraw compensation
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).withdrawCompensation(4),
        );

        const finalClaimInfo = await this.contracts.ClaimManager.claimInfo(4);
        expect(finalClaimInfo.status).to.equal(8); // CompensatedAfterDispute
      });
    });
  });
}
