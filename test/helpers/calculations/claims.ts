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
  PoolInfoObject,
  PositionInfoObject,
  CoverInfoObject,
  ClaimInfoObject,
  RoundData,
} from "../types";

// ========= CLAIMS ========= //

export function calcExpectedClaimDataAfterSubmitEvidence(
  ipfsEvidenceCids: string[],
  party: "claimant" | "prosecutor",
  claimInfoBefore: ClaimInfoObject,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
  return party === "claimant"
    ? {
        ...claimInfoBefore,
        evidence: [...claimInfoBefore.evidence, ...ipfsEvidenceCids],
      }
    : {
        ...claimInfoBefore,
        counterEvidence: [
          ...claimInfoBefore.counterEvidence,
          ...ipfsEvidenceCids,
        ],
      };
}

export function calcExpectedClaimDataAfterInitiateClaim(
  amountClaimedAmount: BigNumber,
  coverId: number,
  expectedClaimId: number,
  metaEvidenceURI: string,
  relatedClaimIds: BigNumber[],
  poolInfo: PoolInfoObject,
  coverDataAfter: CoverInfoObject,
  claimant: string,
  deposit: BigNumber,
  collateral: BigNumber,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
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
  claimInfoBefore: ClaimInfoObject,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
  return {
    ...claimInfoBefore,
    // If status is 'Accepted' then it should be 'Compensated' otherwise 'CompensatedAfterDispute'
    status: claimInfoBefore.status === 1 ? 2 : 8,
  };
}

export function calcExpectedClaimDataAfterDisputeClaim(
  claimInfoBefore: ClaimInfoObject,
  prosecutor: string,
  disputeId: number,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
  return {
    ...claimInfoBefore,
    status: 3, // Disputed
    prosecutor,
    disputeId,
    rulingTimestamp: 0,
  };
}

export function calcExpectedClaimDataAfterCourtRuling(
  claimInfoBefore: ClaimInfoObject,
  ruling: number,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
  // Only update the ruling field, leave status and rulingTimestamp unchanged
  return {
    ...claimInfoBefore,
    ruling,
  };
}

export function calcExpectedClaimDataAfterExecuteRuling(
  claimInfoBefore: ClaimInfoObject,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
  let newStatus;
  switch (claimInfoBefore.ruling) {
    case 0: // RefusedToArbitrate
      newStatus = 6;
      break;
    case 1: // PayClaimant
      newStatus = 7;
      break;
    case 2: // RejectClaim
      newStatus = 6;
      break;
    default:
      throw new Error("Invalid ruling");
  }

  return {
    ...claimInfoBefore,
    status: newStatus,
    rulingTimestamp: txTimestamp,
  };
}

export function calcExpectedClaimDataAfterOverrule(
  claimInfoBefore: ClaimInfoObject,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
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
  claimInfoBefore: ClaimInfoObject,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
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
  claimInfoBefore: ClaimInfoObject,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
  return {
    ...claimInfoBefore,
    status: 9, // ProsecutorPaid
  };
}
