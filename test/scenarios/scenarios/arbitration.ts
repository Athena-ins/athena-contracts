import { Scenario } from "../utils/actionEngine";

export const arbitration: Scenario = {
  title: "handle arbitration of claims",
  stories: [
    {
      description: "deployer creates pools 0 & 1",
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
      description: "user0 provides liquidity to pools",
      actions: [
        {
          userName: "user0",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 25_000,
          },
          expected: "success",
        },
        {
          userName: "user0",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 25_000,
          },
          expected: "success",
        },
        {
          userName: "user0",
          name: "openPosition",
          args: {
            amount: 25_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [0],
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 buys cover on pool 0",
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
      description: "user1 creates claim 0 for cover 0 & adds evidence",
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
        {
          userName: "user1",
          name: "submitEvidence",
          args: {
            claimId: 0,
            ipfsEvidenceCids: ["QmTest1", "QmTest2"],
            party: "claimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 withdraw compensation for unchallenged claim 0",
      actions: [
        {
          name: "wait",
          timeTravel: {
            days: 10, // Past challenge period
          },
        },
        {
          userName: "user1",
          name: "withdrawCompensation",
          args: {
            claimId: 0,
          },
          expected: "success",
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
      description: "user1 creates claim 1 for cover 1 & adds evidence",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 1,
            tokenSymbol: "USDC",
            amountClaimed: 3_000,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "submitEvidence",
          args: {
            claimId: 1,
            ipfsEvidenceCids: ["QmTest3"],
            party: "claimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 disputes claim 1 & submits counter evidence",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 1,
          },
          expected: "success",
        },
        {
          userName: "user2",
          name: "submitEvidence",
          args: {
            claimId: 1,
            ipfsEvidenceCids: ["QmTest4"],
            party: "prosecutor",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator rules in favor of claimant",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            claimId: 1,
            ruling: "PayClaimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 withdraw compensation for challenged claim 1",
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
            claimId: 1,
          },
          expected: "success",
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
      description: "user2 disputes claim 2 & parties submit evidence",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 2,
          },
          expected: "success",
        },
        {
          userName: "user1",
          name: "submitEvidence",
          args: {
            claimId: 2,
            ipfsEvidenceCids: ["QmTest5"],
            party: "claimant",
          },
          expected: "success",
        },
        {
          userName: "user2",
          name: "submitEvidence",
          args: {
            claimId: 2,
            ipfsEvidenceCids: ["QmTest6", "QmTest7"],
            party: "prosecutor",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator rejects claim 2",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            claimId: 2,
            ruling: "RejectClaim",
          },
          expected: "success",
        },
      ],
    },
    // Refused to arbitrate case
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
      description: "arbitrator refuses to rule on claim 3",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            claimId: 3,
            ruling: "RefusedToArbitrate",
          },
          expected: "success",
        },
      ],
    },
    // Overrule without punishment
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
          userName: "deployer",
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
      description: "deployer overrules claim 4 without punishment",
      actions: [
        {
          userName: "deployer",
          name: "overrule",
          args: {
            claimId: 4,
            punish: false,
          },
          expected: "success",
        },
      ],
    },
    // Overrule with punishment
    {
      description: "user1 opens cover 5 on pool 0",
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
      description: "user1 creates claim 5 for cover 5",
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
      description: "user2 disputes claim 5",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 5,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator accepts claim 5",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            claimId: 5,
            ruling: "PayClaimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "deployer overrules claim 5 with punishment",
      actions: [
        {
          userName: "deployer",
          name: "overrule",
          args: {
            claimId: 5,
            punish: true,
          },
          expected: "success",
        },
      ],
    },
  ],
};
