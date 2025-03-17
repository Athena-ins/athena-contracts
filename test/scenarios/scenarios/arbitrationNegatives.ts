import { Scenario } from "../utils/actionEngine";
import { getDefaultProtocolConfig } from "../../../scripts/verificationData/deployParams";

const protocolConfig = getDefaultProtocolConfig();

export const arbitrationNegatives: Scenario = {
  title: "handle negatives in context of claim arbitration",
  stories: [
    {
      description: "deployer creates pool 0",
      actions: [
        {
          userName: "deployer",
          name: "createPool",
          args: {
            paymentAssetSymbol: "USDC",
            strategyId: 0,
            compatiblePools: [],
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 provides liquidity to pool 0",
      actions: [
        {
          userName: "user0",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 35_000,
          },
          expected: "success",
        },
        {
          userName: "user0",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 35_000,
          },
          expected: "success",
        },
        {
          userName: "user0",
          name: "openPosition",
          args: {
            amount: 35_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [0],
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 opens cover 0 on pool 0",
      actions: [
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 5_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 500,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 fails to claim cover 0 they don't own",
      actions: [
        {
          userName: "user2",
          name: "initiateClaim",
          args: {
            coverId: 0,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
          },
          expected: "revert",
          revertMessage: "OnlyCoverOwner",
        },
      ],
    },
    {
      description: "user1 fails to claim zero amount on cover 0",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 0,
            tokenSymbol: "USDC",
            amountClaimed: 0,
          },
          expected: "revert",
          revertMessage: "CannotClaimZero",
        },
      ],
    },
    {
      description: "user1 creates claim 0 for cover 0",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 0,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user3 fails to submit evidence for claim 0",
      actions: [
        {
          userName: "user3",
          name: "submitEvidence",
          args: {
            claimId: 0,
            ipfsEvidenceCids: ["QmTest1"],
            party: "claimant",
          },
          expected: "revert",
          revertMessage: "InvalidParty",
        },
      ],
    },
    {
      description: "user2 disputes claim 0",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 0,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 fails to submit evidence after period for claim 0",
      actions: [
        {
          name: "wait",
          timeTravel: {
            days: 31, // Past evidence period
          },
        },
        {
          userName: "user1",
          name: "submitEvidence",
          args: {
            claimId: 0,
            ipfsEvidenceCids: ["QmTest2"],
            party: "claimant",
          },
          expected: "revert",
          revertMessage: "EvidenceUploadPeriodEnded",
        },
      ],
    },
    {
      description: "user1 opens cover 1 on pool 0",
      actions: [
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 5_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 500,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 creates claim 1 for cover 1",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 1,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 fails to dispute claim 1 after challenge period",
      actions: [
        {
          name: "wait",
          timeTravel: {
            days: 10, // Past challenge period
          },
        },
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 1,
          },
          expected: "revert",
          revertMessage: "ClaimNotChallengeable",
        },
      ],
    },
    {
      description: "user1 opens cover 2 on pool 0",
      actions: [
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 2_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 500,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 creates claim 2 for cover 2",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 2,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 fails to dispute claim 2 with insufficient cost",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 2,
            valueSent: "1", // Tiny amount
          },
          expected: "revert",
          revertMessage: "MustDepositArbitrationCost",
        },
      ],
    },
    {
      description: "user1 fails to dispute their own claim 2",
      actions: [
        {
          userName: "user1",
          name: "disputeClaim",
          args: {
            claimId: 2,
          },
          expected: "revert",
          revertMessage: "CannotChallengeYourOwnClaim",
        },
      ],
    },
    {
      description: "user2 disputes claim 2",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 2,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user3 fails to dispute already challenged claim 2",
      actions: [
        {
          userName: "user3",
          name: "disputeClaim",
          args: {
            claimId: 2,
          },
          expected: "revert",
          revertMessage: "ClaimNotChallengeable",
        },
      ],
    },
    {
      description: "user1 opens cover 3 on pool 0",
      actions: [
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 5_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 500,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 creates claim 3 for cover 3",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 3,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user2 fails to rule on dispute 3 of claim 3 as non-arbitrator",
      actions: [
        {
          userName: "user2",
          name: "rule",
          args: {
            disputeId: 3,
            ruling: "PayClaimant",
          },
          expected: "revert",
          revertMessage: "OwnableUnauthorizedAccount",
        },
      ],
    },
    {
      description:
        "arbitrator fails to rule on undisputed dispute 3 of claim 3",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 3,
            ruling: "PayClaimant",
          },
          expected: "revert",
          revertMessage: "ClaimDoesNotExist",
        },
      ],
    },
    {
      description: "user1 fails to withdraw claim 3 before challenge period",
      actions: [
        {
          userName: "user1",
          name: "withdrawCompensation",
          args: {
            claimId: 3,
          },
          expected: "revert",
          revertMessage: "PeriodNotElapsed",
        },
      ],
    },
    {
      description: "user2 disputes claim 3",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 3,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator accepts dispute 2 of claim 3",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 2,
            ruling: "PayClaimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 fails to withdraw claim 3 before overrule period",
      actions: [
        {
          userName: "user1",
          name: "withdrawCompensation",
          args: {
            claimId: 3,
          },
          expected: "revert",
          revertMessage: "PeriodNotElapsed",
        },
      ],
    },
    {
      description: "deployer overrules claim 3",
      actions: [
        {
          userName: "deployer",
          name: "overrule",
          args: {
            claimId: 3,
            punish: false,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 fails to withdraw overruled claim 3",
      actions: [
        {
          userName: "user1",
          name: "withdrawCompensation",
          args: {
            claimId: 3,
          },
          expected: "revert",
          revertMessage: "WrongClaimStatus",
        },
      ],
    },
    {
      description: "user1 opens cover 4 on pool 0",
      actions: [
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 2_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 500,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 creates claim 4 for cover 4",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 4,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 disputes claim 4",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 4,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator accepts dispute 3 of claim 4",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 3,
            ruling: "PayClaimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 fails to overrule claim 4 as non-owner",
      actions: [
        {
          userName: "user2",
          name: "overrule",
          args: {
            claimId: 4,
            punish: false,
          },
          expected: "revert",
          revertMessage: "OwnableUnauthorizedAccount",
        },
      ],
    },
    {
      description: "deployer fails to overrule claim 4 after period",
      actions: [
        {
          name: "wait",
          timeTravel: {
            days: 10, // Past overrule period
          },
        },
        {
          userName: "deployer",
          name: "overrule",
          args: {
            claimId: 4,
            punish: false,
          },
          expected: "revert",
          revertMessage: "OverrulePeriodEnded",
        },
      ],
    },
    {
      description: "deployer fails to overrule previously rejected claim 2",
      actions: [
        {
          userName: "deployer",
          name: "overrule",
          args: {
            claimId: 2, // Previously disputed claim
            punish: false,
          },
          expected: "revert",
          revertMessage: "WrongClaimStatus",
        },
      ],
    },

    {
      description: "user1 opens cover 5 for ETH tests",
      actions: [
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 5_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 500,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 fails to initiate claim with no ETH on cover 5",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 5,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
            valueSent: "0",
          },
          expected: "revert",
          revertMessage: "InsufficientDeposit",
        },
      ],
    },
    {
      description:
        "user1 fails to initiate claim with only arbitration cost on cover 5",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 5,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
            valueSent: protocolConfig.arbitrationCost.toString(),
          },
          expected: "revert",
          revertMessage: "InsufficientDeposit",
        },
      ],
    },
    {
      description:
        "user1 fails to initiate claim with only collateral on cover 5",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 5,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
            valueSent: protocolConfig.claimCollateral.toString(),
          },
          expected: "revert",
          revertMessage: "InsufficientDeposit",
        },
      ],
    },
    {
      description: "user1 creates claim 5 for cover 5", // Updated description
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 5,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 fails to dispute claim 5 with no ETH", // Updated description and ID
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 5,
            valueSent: "0",
          },
          expected: "revert",
          revertMessage: "MustDepositArbitrationCost",
        },
      ],
    },
    {
      description:
        "user2 fails to dispute claim 5 with insufficient arbitration cost", // Updated description and ID
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 5,
            valueSent: protocolConfig.arbitrationCost.sub(1).toString(),
          },
          expected: "revert",
          revertMessage: "MustDepositArbitrationCost",
        },
      ],
    },
    {
      description: "user1 opens cover 6 on pool 0 for appeal negatives",
      actions: [
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 2_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 500,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 creates claim 6 for cover 6",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 6,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 fails to appeal undisputed claim 6",
      actions: [
        {
          userName: "user1",
          name: "appeal",
          args: {
            claimId: 6,
          },
          expected: "revert",
          revertMessage: "WrongClaimStatus",
        },
      ],
    },
    {
      description: "user2 disputes claim 6",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 6,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 fails to appeal unruled disputed claim 6",
      actions: [
        {
          userName: "user1",
          name: "appeal",
          args: {
            claimId: 6,
          },
          expected: "revert",
          revertMessage: "WrongClaimStatus",
        },
      ],
    },
    {
      description: "arbitrator rejects claim 6 (dispute 4)",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 4,
            ruling: "RejectClaim",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user3 fails to appeal claim 6 as invalid party",
      actions: [
        {
          userName: "user3",
          name: "appeal",
          args: {
            claimId: 6,
          },
          expected: "revert",
          revertMessage: "InvalidParty",
        },
      ],
    },
    {
      description: "user2 fails to appeal a rejected claim 6",
      actions: [
        {
          userName: "user2",
          name: "appeal",
          args: {
            claimId: 6,
          },
          expected: "revert",
          revertMessage: "InvalidParty",
        },
      ],
    },
    {
      description: "user1 fails to appeal with insufficient deposit",
      actions: [
        {
          userName: "user1",
          name: "appeal",
          args: {
            claimId: 6,
            valueSent: "100", // small amount
          },
          expected: "revert",
          revertMessage: "InsufficientDeposit",
        },
      ],
    },
    {
      description: "user1 appeals claim 6",
      actions: [
        {
          userName: "user1",
          name: "appeal",
          args: {
            claimId: 6,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 fails to appeal an already appealed claim 6",
      actions: [
        {
          userName: "user1",
          name: "appeal",
          args: {
            claimId: 6,
          },
          expected: "revert",
          revertMessage: "WrongClaimStatus",
        },
      ],
    },
    {
      description: "arbitrator rules in favor of the claimant on appeal",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 4,
            ruling: "PayClaimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user1 fails to withdraw compensation before overrule period",
      actions: [
        {
          userName: "user1",
          name: "withdrawCompensation",
          args: {
            claimId: 6,
          },
          expected: "revert",
          revertMessage: "PeriodNotElapsed",
        },
      ],
    },
    {
      description: "user1 successfully withdraws compensation after waiting",
      actions: [
        {
          name: "wait",
          timeTravel: {
            days: 10, // Past overrule period
          },
        },
        {
          userName: "user1",
          name: "withdrawCompensation",
          args: {
            claimId: 6,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 opens cover 7 in pool 0",
      actions: [
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 4_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 500,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 creates claim 7 for cover 7",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 7,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 disputes claim 7",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 7,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator rejects claim 7 (dispute 5)",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 5,
            ruling: "RejectClaim",
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user2 fails to withdraw prosecution reward during appeal period",
      actions: [
        {
          userName: "user2",
          name: "withdrawProsecutionReward",
          args: {
            claimId: 7,
          },
          expected: "revert",
          revertMessage: "AppealPeriodOngoing",
        },
      ],
    },
    {
      description: "user1 appeals claim 7",
      actions: [
        {
          userName: "user1",
          name: "appeal",
          args: {
            claimId: 7,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 fails to withdraw prosecution reward during appeal",
      actions: [
        {
          userName: "user2",
          name: "withdrawProsecutionReward",
          args: {
            claimId: 7,
          },
          expected: "revert",
          revertMessage: "WrongClaimStatus",
        },
      ],
    },
    {
      description: "arbitrator rules for the prosecution on appeal",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 5,
            ruling: "RejectClaim",
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user3 withdraws prosecution reward to prosecutor as non-prosecutor",
      actions: [
        {
          name: "wait",
          timeTravel: {
            days: 5, // Past appeal period
          },
        },
        {
          userName: "user3",
          name: "withdrawProsecutionReward",
          args: {
            claimId: 7,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 fails to withdraw prosecution reward again",
      actions: [
        {
          userName: "user2",
          name: "withdrawProsecutionReward",
          args: {
            claimId: 7,
          },
          expected: "revert",
          revertMessage: "WrongClaimStatus",
        },
      ],
    },
    {
      description: "user1 opens cover 8 for overrule tests",
      actions: [
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 3_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 500,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 creates claim 8 for cover 8",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 8,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 disputes claim 8",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 8,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator accepts claim 8 (dispute 6)",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 6,
            ruling: "PayClaimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 appeals claim 8",
      actions: [
        {
          userName: "user2",
          name: "appeal",
          args: {
            claimId: 8,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator rules for the claimant on appeal",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 6,
            ruling: "PayClaimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 fails to appeal claim 8 after appeal period ends",
      actions: [
        {
          name: "wait",
          timeTravel: {
            days: 10, // Past appeal period
          },
        },
        {
          userName: "user1",
          name: "appeal",
          args: {
            claimId: 8,
          },
          expected: "revert",
          revertMessage: "AppealPeriodEnded",
        },
      ],
    },
    {
      description: "user1 withdraws compensation after appeal period",
      actions: [
        {
          userName: "user1",
          name: "withdrawCompensation",
          args: {
            claimId: 8,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 fails to withdraw compensation again",
      actions: [
        {
          userName: "user1",
          name: "withdrawCompensation",
          args: {
            claimId: 8,
          },
          expected: "revert",
          revertMessage: "WrongClaimStatus",
        },
      ],
    },
  ],
};
