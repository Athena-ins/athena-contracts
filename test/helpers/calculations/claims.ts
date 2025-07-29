import {
  constants,
  toRay,
  RayInt,
  getPremiumRate,
  computeLiquidityIndex,
  getCoverRewards,
  getDailyCost,
  secondsPerTick,
  currentPremiumRate,
  updatedPremiumRate,
  utilization,
  computeReward,
  currentDailyCost,
} from "../utils/poolRayMath";
import { deepCopy } from "../miscUtils";
// Types
import { BigNumber } from "ethers";
import {
  FormattedPool,
  FormattedPosition,
  FormattedCover,
  FormattedClaim,
  RoundData,
} from "../types";

// ========= CLAIMS ========= //

export function calcExpectedClaimDataAfterSubmitEvidence(
  evidenceURI: string[],
  party: "claimant" | "prosecutor",
  claimInfoBefore: FormattedClaim,
  txTimestamp: number,
  timestamp: number,
): FormattedClaim {
  return party === "claimant"
    ? {
        ...claimInfoBefore,
        evidence: [...claimInfoBefore.evidence, ...evidenceURI],
      }
    : {
        ...claimInfoBefore,
        counterEvidence: [...claimInfoBefore.counterEvidence, ...evidenceURI],
      };
}

export function calcExpectedClaimDataAfterInitiateClaim(
  amountClaimedAmount: BigNumber,
  coverId: number,
  expectedClaimId: number,
  metaEvidenceURI: string,
  relatedClaimIds: BigNumber[],
  poolInfo: FormattedPool,
  coverDataAfter: FormattedCover,
  claimant: string,
  deposit: BigNumber,
  collateral: BigNumber,
  txTimestamp: number,
  timestamp: number,
): FormattedClaim {
  const relatedClaims = [
    ...relatedClaimIds.map((id) => id.toNumber()),
    expectedClaimId,
  ];

  return {
    claimant,
    coverId,
    poolId: poolInfo.poolId,
    claimId: expectedClaimId,
    disputeId: 0,
    status: 0, // Initiated
    createdAt: txTimestamp,
    amount: amountClaimedAmount,
    prosecutor: "0x0000000000000000000000000000000000000000",
    deposit,
    collateral,
    appeals: [],
    evidence: [],
    counterEvidence: [],
    metaEvidenceURI: metaEvidenceURI,
    rulingTimestamp: 0,
    challengedTimestamp: 0,
    appealRounds: [],
    relatedClaimIds: relatedClaims,
    coverAmount: coverDataAfter.coverAmount,
    isCoverActive: coverDataAfter.isActive,
    ruling: 0,
  };
}

export function calcExpectedClaimDataAfterWithdrawCompensation(
  claimInfoBefore: FormattedClaim,
  txTimestamp: number,
  timestamp: number,
): FormattedClaim {
  return {
    ...claimInfoBefore,
    coverAmount: claimInfoBefore.coverAmount.sub(claimInfoBefore.amount),
    // If status is 'Accepted' then it should be 'Compensated' otherwise 'CompensatedAfterDispute'
    status: claimInfoBefore.status === 1 ? 2 : 8,
  };
}

export function calcExpectedClaimDataAfterDisputeClaim(
  claimInfoBefore: FormattedClaim,
  prosecutor: string,
  disputeId: number,
  txTimestamp: number,
  timestamp: number,
): FormattedClaim {
  return {
    ...claimInfoBefore,
    status: 3, // Disputed
    prosecutor,
    disputeId,
    rulingTimestamp: 0,
  };
}

export function calcExpectedClaimDataAfterCourtRuling(
  claimInfoBefore: FormattedClaim,
  ruling: number,
  txTimestamp: number,
  timestamp: number,
): FormattedClaim {
  // Only update the ruling field, leave status and rulingTimestamp unchanged
  return {
    ...claimInfoBefore,
    ruling,
  };
}

export function calcExpectedClaimDataAfterExecuteRuling(
  claimInfoBefore: FormattedClaim,
  txTimestamp: number,
  timestamp: number,
): FormattedClaim {
  // Refusal to arbitrate or rejections results in the claim being tossed
  const newStatus = claimInfoBefore.ruling === 1 ? 7 : 6;

  return {
    ...claimInfoBefore,
    status: newStatus,
    rulingTimestamp: txTimestamp,
  };
}

export function calcExpectedClaimDataAfterOverrule(
  claimInfoBefore: FormattedClaim,
  txTimestamp: number,
  timestamp: number,
): FormattedClaim {
  return {
    ...claimInfoBefore,
    status: 5, // RejectedByOverrule
  };
}

export function calcExpectedClaimDataAfterFundAppeal(
  side: number,
  valueSent: BigNumber,
  multipliers: {
    winner: BigNumber;
    loser: BigNumber;
    divisor: BigNumber;
  },
  appealCost: BigNumber,
  claimInfoBefore: FormattedClaim,
  txTimestamp: number,
  timestamp: number,
): FormattedClaim {
  const claim = deepCopy(claimInfoBefore);
  // This is ok because the dispute creates a new round
  const roundId = claim.appealRounds.length - 1;
  const round = claim.appealRounds[roundId];

  const multiplier =
    claim.ruling === side ? multipliers.winner : multipliers.loser;
  const totalCost = appealCost.add(
    appealCost.mul(multiplier).div(multipliers.divisor),
  );

  // Compute contribution
  const remaining = totalCost.sub(round.paidFees[side]);
  const contribution = valueSent.lt(remaining) ? valueSent : remaining;

  // Update round
  round.paidFees[side] = round.paidFees[side].add(contribution);

  if (round.paidFees[side].gte(totalCost)) {
    round.hasPaid[side] = true;
    round.feeRewards = round.feeRewards.add(round.paidFees[side]);
    round.fundedSides.push(side);

    // Check if both sides are now fully funded (at least 2 fundedSides)
    if (1 < round.fundedSides.length) {
      // New appeal round triggered
      claim.appeals.push(txTimestamp);
      claim.status = 4; // Appealed
      // Remove appealCost from previous round feeRewards
      round.feeRewards = round.feeRewards.sub(appealCost);

      claim.appealRounds.push({
        paidFees: [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
        hasPaid: [false, false, false],
        fundedSides: [],
        feeRewards: BigNumber.from(0),
      });
    }
  }

  return claim;
}

export function calcExpectedClaimDataAfterResolveProsecution(
  claimInfoBefore: FormattedClaim,
  txTimestamp: number,
  timestamp: number,
): FormattedClaim {
  return {
    ...claimInfoBefore,
    status: 9, // ProsecutionResolved
  };
}
