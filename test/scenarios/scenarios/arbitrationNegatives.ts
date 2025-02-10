import { Scenario } from "../utils/actionEngine";

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
            amount: 10_000,
          },
          expected: "success",
        },
        {
          userName: "user0",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 10_000,
          },
          expected: "success",
        },
        {
          userName: "user0",
          name: "openPosition",
          args: {
            amount: 10_000,
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
            coverAmount: 5_000,
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
          revertMessage: "ClaimAlreadyChallenged",
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
      description: "user2 fails to rule on claim 3 as non-arbitrator",
      actions: [
        {
          userName: "user2",
          name: "rule",
          args: {
            claimId: 3,
            ruling: "PayClaimant",
          },
          expected: "revert",
          revertMessage: "OnlyArbitrator",
        },
      ],
    },
    {
      description: "arbitrator fails to rule on undisputed claim 3",
      actions: [
        {
          userName: "user4",
          name: "rule",
          args: {
            claimId: 3,
            ruling: "PayClaimant",
          },
          expected: "revert",
          revertMessage: "ClaimNotInDispute",
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
      description: "arbitrator accepts claim 3",
      actions: [
        {
          userName: "user4",
          name: "rule",
          args: {
            claimId: 3,
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
            coverAmount: 5_000,
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
      description: "arbitrator accepts claim 4",
      actions: [
        {
          userName: "user4",
          name: "rule",
          args: {
            claimId: 4,
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
          revertMessage: "Ownable: caller is not the owner",
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
      description: "user1 opens cover 5 for ETH tests", // Was cover 1
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
            coverId: 5, // Was 1
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
            coverId: 5, // Was 1
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
            valueSent: "arbitrationCost",
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
            coverId: 5, // Was 1
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
            valueSent: "claimCollateral",
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
            coverId: 5, // Was 1
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
            claimId: 5, // Was 0
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
            claimId: 5, // Was 0
            valueSent: "halfArbitrationCost",
          },
          expected: "revert",
          revertMessage: "MustDepositArbitrationCost",
        },
      ],
    },
  ],
};
