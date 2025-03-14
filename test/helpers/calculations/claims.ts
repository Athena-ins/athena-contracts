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
  poolInfo: PoolInfoObject,
  claimant: string,
  deposit: BigNumber,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
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
    evidence: [],
    counterEvidence: [],
    metaEvidenceURI: metaEvidenceURI,
    rulingTimestamp: 0,
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

export function calcExpectedClaimDataAfterRuleClaim(
  claimInfoBefore: ClaimInfoObject,
  ruling: number,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
  let newStatus;
  switch (ruling) {
    case 0: // RefusedToArbitrate
      newStatus = 5;
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

export function calcExpectedClaimDataAfterOverruleRuling(
  claimInfoBefore: ClaimInfoObject,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
  return {
    ...claimInfoBefore,
    status: 4, // RejectedByOverrule
  };
}

export function calcExpectedClaimDataAfterAppeal(
  claimInfoBefore: ClaimInfoObject,
  appellant: string,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
  return {
    ...claimInfoBefore,
    status: 4, // Appealed
    appeals: [
      ...(claimInfoBefore.appeals || []),
      {
        appealTimestamp: txTimestamp,
        appellant: appellant,
      },
    ],
  };
}

export function calcExpectedClaimDataAfterWithdrawProsecutionReward(
  claimInfoBefore: ClaimInfoObject,
  txTimestamp: number,
  timestamp: number,
): ClaimInfoObject {
  return {
    ...claimInfoBefore,
    status: 9, // ProsecutorPaid
  };
}
