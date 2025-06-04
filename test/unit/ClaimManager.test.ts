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
        // First give the ruling (sets initial ruling but doesn't call rule() yet)
        await postTxHandler(
          this.contracts.AthenaArbitrator.giveRuling(
            0, // disputeId
            2, // RulingOptions.RejectClaim
          ),
        );

        // Wait for appeal period to end
        const appealPeriodDuration =
          await this.contracts.AthenaArbitrator.appealPeriodDuration();
        await setNextBlockTimestamp({
          seconds: Number(appealPeriodDuration) + 10,
        });

        // Execute the ruling (calls rule() on ClaimManager)
        await postTxHandler(
          (this.contracts.AthenaArbitrator as any).executeRuling(0),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(0);
        expect(claimInfo.status).to.equal(6); // RejectedByCourtDecision
      });
    });

    describe("Appeal process", function () {
      it("creates a new claim & dispute it", async function (this: Arguments) {
        // Wait for the previous claim to be finalized
        await setNextBlockTimestamp({ days: 6 });

        // Create a new claim using the same cover
        const arbitrationCost =
          await this.contracts.ClaimManager.arbitrationCost();
        const claimCollateral =
          await this.contracts.ClaimManager.claimCollateral();
        const requiredDeposit = arbitrationCost.add(claimCollateral);

        // Create a new claim
        const claimId = await this.contracts.ClaimManager.nextClaimId();
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user1).initiateClaim(
            0, // coverId - reuse the first cover
            this.args.claimAmount,
            { value: requiredDeposit },
          ),
        );

        // Start a dispute by disputing the claim
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user2).disputeClaim(
            claimId,
            { value: arbitrationCost },
          ),
        );
      });

      it("allows claimant to appeal a rejected claim", async function (this: Arguments) {
        const claimId = 1; // Use the claim we created in the previous test

        // Ruling against the claimant (but don't execute it yet, so they can appeal)
        const disputeId = (await this.contracts.ClaimManager.claimInfo(claimId))
          .disputeId;
        await postTxHandler(
          this.contracts.AthenaArbitrator.giveRuling(
            disputeId, // disputeId
            2, // RulingOptions.RejectClaim
          ),
        );

        // Check if we're in the appeal period
        const [appealPeriodStart, appealPeriodEnd] =
          await this.contracts.AthenaArbitrator.appealPeriod(disputeId);
        const currentTime = await getCurrentTime();

        const currentTimeNum = Number(currentTime);
        const appealPeriodStartNum = Number(appealPeriodStart);
        const appealPeriodEndNum = Number(appealPeriodEnd);

        if (
          currentTimeNum < appealPeriodStartNum ||
          currentTimeNum >= appealPeriodEndNum
        ) {
          // If we're not in the appeal period, move time forward to be in it
          await setNextBlockTimestamp({
            seconds: appealPeriodStartNum - currentTimeNum + 10,
          });
        }

        // Calculate the required appeal cost based on the current ruling
        const appealCost = await this.contracts.AthenaArbitrator.appealCost(
          disputeId,
          "0x",
        );

        // Get the loser multiplier (since claimant lost the case)
        const loserMultiplier =
          await this.contracts.ClaimManager.loserMultiplier();
        const multiplierDivisor = 10000; // MULTIPLIER_DIVISOR constant from contract

        // Calculate total cost including incentives
        const totalAppealCost = appealCost.add(
          appealCost.mul(loserMultiplier).div(multiplierDivisor),
        );

        // Fund appeal from the claimant side (ruling option 1 - pay claimant)
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user1).fundAppeal(
            claimId, // Use the new claim ID
            1, // RulingOptions.PayClaimant
            { value: totalAppealCost },
          ),
        );

        // Fund appeal from the prosecutor side (ruling option 2 - reject claim)
        // The winner multiplier is used since the prosecutor won the case
        const winnerMultiplier =
          await this.contracts.ClaimManager.winnerMultiplier();
        const winnerAppealCost = appealCost.add(
          appealCost.mul(winnerMultiplier).div(multiplierDivisor),
        );

        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user2).fundAppeal(
            claimId, // Use the new claim ID
            2, // RulingOptions.RejectClaim
            { value: winnerAppealCost },
          ),
        );

        const updatedClaimInfo =
          await this.contracts.ClaimManager.claimInfo(claimId);
        expect(updatedClaimInfo.status).to.equal(4); // Appealed
        expect(updatedClaimInfo.appeals.length).to.equal(1);
      });

      it("allows additional evidence submission during appeal", async function (this: Arguments) {
        const claimId = 1; // Use the claim we created in the previous test

        const claimInfoBefore =
          await this.contracts.ClaimManager.claimInfo(claimId);

        // After appealing, both parties can submit evidence
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).submitEvidence(claimId, "QmTestAppealEvidence1"),
        );

        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user2,
          ).submitEvidence(claimId, "QmTestAppealCounterEvidence1"),
        );

        const claimInfoAfter =
          await this.contracts.ClaimManager.claimInfo(claimId);
        // We should have evidence from previous tests + this test
        expect(claimInfoAfter.evidence.length).to.be.greaterThan(
          claimInfoBefore.evidence.length,
        );
        expect(claimInfoAfter.counterEvidence.length).to.be.greaterThan(
          claimInfoBefore.counterEvidence.length,
        );
      });

      it("allows arbitrator to rule on appeal (accept claim)", async function (this: Arguments) {
        const claimId = 1; // Use the claim we created in the previous test

        // Get the dispute ID to ensure we're using the correct one
        const claimInfo = await this.contracts.ClaimManager.claimInfo(claimId);
        const disputeId = claimInfo.disputeId;

        // The dispute has already been ruled on once, and we need to wait for the appeal to be fully created
        // Add a small delay to ensure appeal is processed
        await setNextBlockTimestamp({ seconds: 10 });

        // Rule on the appeal (sets initial ruling but doesn't call rule() yet)
        await postTxHandler(
          this.contracts.AthenaArbitrator.giveRuling(
            disputeId,
            1, // RulingOptions.PayClaimant
          ),
        );

        // Wait for appeal period to end
        const appealPeriodDuration =
          await this.contracts.AthenaArbitrator.appealPeriodDuration();
        await setNextBlockTimestamp({
          seconds: Number(appealPeriodDuration) + 10,
        });

        // Execute the ruling (calls rule() on ClaimManager)
        await postTxHandler(
          (this.contracts.AthenaArbitrator as any).executeRuling(disputeId),
        );

        // Verify the ruling was applied
        const updatedClaimInfo =
          await this.contracts.ClaimManager.claimInfo(claimId);
        expect(updatedClaimInfo.status).to.equal(7); // AcceptedByCourtDecision
      });

      it("prevents withdrawal before overrule period ends", async function (this: Arguments) {
        const claimId = 1; // Use the claim we created in the previous test

        await expect(
          this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).withdrawCompensation(claimId),
        ).to.revertTransactionWith("WithdrawConditionsNotMet");
      });

      it("allows owner to overrule claim decision", async function (this: Arguments) {
        // Wait for the previous claim to be finalized
        await setNextBlockTimestamp({ days: 6 });

        // We should already have a resolved claim from the previous tests

        // Create a new claim on the same cover for testing overrule
        const arbitrationCost =
          await this.contracts.ClaimManager.arbitrationCost();
        const claimCollateral =
          await this.contracts.ClaimManager.claimCollateral();
        const requiredDeposit = arbitrationCost.add(claimCollateral);

        const newClaimId = await this.contracts.ClaimManager.nextClaimId();

        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user1).initiateClaim(
            0, // coverId - reuse the first cover
            this.args.claimAmount,
            { value: requiredDeposit },
          ),
        );

        // Owner can overrule the Initiated claim
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.deployer).overrule(
            newClaimId, // claimId
            false, // don't punish claimant
          ),
        );

        const claimInfo =
          await this.contracts.ClaimManager.claimInfo(newClaimId);
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

        const claimId = await this.contracts.ClaimManager.nextClaimId();

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
          ).withdrawCompensation(claimId),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(claimId);
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

        // Wait for appeal period to end
        const appealPeriodDuration =
          await this.contracts.AthenaArbitrator.appealPeriodDuration();
        await setNextBlockTimestamp({
          seconds: Number(appealPeriodDuration) + 10,
        });

        // Execute the ruling (calls rule() on ClaimManager)
        await postTxHandler(
          (this.contracts.AthenaArbitrator as any).executeRuling(disputeId),
        );

        // Fast forward past overrule period
        await setNextBlockTimestamp({ days: 6 });

        // Withdraw compensation
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).withdrawCompensation(claimId),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(claimId);
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

        // Execute the ruling (calls rule() on ClaimManager)
        await postTxHandler(
          (this.contracts.AthenaArbitrator as any).executeRuling(disputeId),
        );

        // Resolve prosecution
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user2,
          ).resolveProsecution(claimId),
        );

        const claimInfo = await this.contracts.ClaimManager.claimInfo(claimId);
        expect(claimInfo.status).to.equal(9); // ProsecutionResolved
      });
    });

    describe("Multiple appeals process", function () {
      it("handles multiple appeal rounds", async function (this: Arguments) {
        // Wait for previous claims to be finalized
        await setNextBlockTimestamp({ days: 1 });

        // Use the existing cover ID 0 instead of creating a new one
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
            0, // coverId - reuse the first cover
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

        // Wait for the appeal period to start
        const [appealPeriodStart, _] =
          await this.contracts.AthenaArbitrator.appealPeriod(disputeId);
        const currentTime = await getCurrentTime();
        await setNextBlockTimestamp({
          seconds: Number(appealPeriodStart) - currentTime + 10,
        });

        // First appeal round - User2 appeals (funds prosecutor side)
        const appealCost = await this.contracts.AthenaArbitrator.appealCost(
          disputeId,
          "0x",
        );
        // Calculate appeal costs for each side
        const winnerMultiplier =
          await this.contracts.ClaimManager.winnerMultiplier();
        const loserMultiplier =
          await this.contracts.ClaimManager.loserMultiplier();
        const multiplierDivisor = 10000; // MULTIPLIER_DIVISOR from contract

        // User2 funds the loser side (ruling option 2 - reject claim)
        const loserAppealCost = appealCost.add(
          appealCost.mul(loserMultiplier).div(multiplierDivisor),
        );
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user2).fundAppeal(
            claimId, // claimId
            2, // RulingOptions.RejectClaim
            { value: loserAppealCost },
          ),
        );

        // User1 funds the winner side (ruling option 1 - pay claimant)
        const winnerAppealCost = appealCost.add(
          appealCost.mul(winnerMultiplier).div(multiplierDivisor),
        );
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user1).fundAppeal(
            claimId, // claimId
            1, // RulingOptions.PayClaimant
            { value: winnerAppealCost },
          ),
        );

        // Submit evidence for appeal
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).submitEvidence(claimId, "QmTestMultipleAppealEvidence"),
        );

        // Small delay before ruling
        await setNextBlockTimestamp({ seconds: 5 });

        // Rule against claimant on appeal
        await postTxHandler(
          this.contracts.AthenaArbitrator.giveRuling(
            disputeId, // disputeId
            2, // RulingOptions.RejectClaim
          ),
        );

        // Wait for the next appeal period to start
        const [secondAppealPeriodStart, _2] =
          await this.contracts.AthenaArbitrator.appealPeriod(disputeId);
        const currentTime2 = await getCurrentTime();
        await setNextBlockTimestamp({
          seconds: Number(secondAppealPeriodStart) - currentTime2 + 10,
        });

        // Second appeal round - User1 appeals (funds claimant side)
        const secondAppealCost =
          await this.contracts.AthenaArbitrator.appealCost(disputeId, "0x");
        // Calculate second appeal costs - note roles are reversed now
        const secondLoserAppealCost = secondAppealCost.add(
          secondAppealCost.mul(loserMultiplier).div(multiplierDivisor),
        );
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user1).fundAppeal(
            claimId, // claimId
            1, // RulingOptions.PayClaimant
            { value: secondLoserAppealCost },
          ),
        );

        // User2 funds the winner side (now reject claim)
        const secondWinnerAppealCost = secondAppealCost.add(
          secondAppealCost.mul(winnerMultiplier).div(multiplierDivisor),
        );
        await postTxHandler(
          this.contracts.ClaimManager.connect(this.signers.user2).fundAppeal(
            claimId, // claimId
            2, // RulingOptions.RejectClaim
            { value: secondWinnerAppealCost },
          ),
        );

        // Verify appeal count
        const claimInfoAfterSecondAppeal =
          await this.contracts.ClaimManager.claimInfo(claimId);
        expect(claimInfoAfterSecondAppeal.appeals.length).to.equal(2);

        // Small delay before ruling
        await setNextBlockTimestamp({ seconds: 5 });

        // Rule in favor of claimant in final appeal (sets initial ruling but doesn't call rule() yet)
        await postTxHandler(
          this.contracts.AthenaArbitrator.giveRuling(
            disputeId, // disputeId
            1, // RulingOptions.PayClaimant
          ),
        );

        // Wait for appeal period to end
        const finalAppealPeriod =
          await this.contracts.AthenaArbitrator.appealPeriodDuration();
        await setNextBlockTimestamp({
          seconds: Number(finalAppealPeriod) + 10,
        });

        // Execute the ruling (calls rule() on ClaimManager)
        await postTxHandler(
          (this.contracts.AthenaArbitrator as any).executeRuling(disputeId),
        );

        // Wait for overrule period
        await setNextBlockTimestamp({ days: 6 });

        // Withdraw compensation
        await postTxHandler(
          this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).withdrawCompensation(claimId),
        );

        const finalClaimInfo =
          await this.contracts.ClaimManager.claimInfo(claimId);
        expect(finalClaimInfo.status).to.equal(8); // CompensatedAfterDispute
      });
    });
  });
}
