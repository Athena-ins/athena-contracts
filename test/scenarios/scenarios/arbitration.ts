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
            amount: 40_000,
          },
          expected: "success",
        },
        {
          userName: "user0",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 40_000,
          },
          expected: "success",
        },
        {
          userName: "user0",
          name: "openPosition",
          args: {
            amount: 40_000,
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
      description: "arbitrator rules in favor of claimant dispute 0 of claim 1",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 0,
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
      description: "arbitrator rejects dispute 1 of claim 2",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 1,
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
      description: "arbitrator refuses to rule on dispute 2 of claim 3",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 2,
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
      description: "arbitrator accepts dispute 4 of claim 5",
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
    {
      description: "user1 opens cover 6 on pool 0",
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
      description: "arbitrator rejects claim 6 (dispute 5)",
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
      description: "user1 appeals the ruling of claim 6",
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
      description: "user1 submits additional evidence for appeal",
      actions: [
        {
          userName: "user1",
          name: "submitEvidence",
          args: {
            claimId: 6,
            ipfsEvidenceCids: ["QmAppealEvidence1"],
            party: "claimant",
          },
          expected: "success",
        },
        {
          userName: "user2",
          name: "submitEvidence",
          args: {
            claimId: 6,
            ipfsEvidenceCids: ["QmAppealCounterEvidence1"],
            party: "prosecutor",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator rules in favor of claimant on appeal",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 5, // Same dispute ID as original case
            ruling: "PayClaimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 withdraws compensation after winning appeal",
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
      description: "user1 opens cover 7 on pool 0",
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
      description: "arbitrator accepts claim 7 (dispute 6)",
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
      description: "user2 appeals the ruling of claim 7",
      actions: [
        {
          userName: "user2",
          name: "appeal",
          args: {
            claimId: 7,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator rejects claim 7 on appeal",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 6, // Same dispute ID
            ruling: "RejectClaim",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 claims prosecution reward after appeal win",
      actions: [
        {
          name: "wait",
          timeTravel: {
            days: 5, // Wait for appeal period to end
          },
        },
        {
          userName: "user2",
          name: "withdrawProsecutionReward",
          args: {
            claimId: 7,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 opens cover 8 on pool 0 for multi-appeal test",
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
      description: "arbitrator rejects claim 8 (dispute 7)",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 7,
            ruling: "RejectClaim",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 makes first appeal on claim 8",
      actions: [
        {
          userName: "user1",
          name: "appeal",
          args: {
            claimId: 8,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator accepts claim 8 on first appeal",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 7,
            ruling: "PayClaimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 makes second appeal on claim 8",
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
      description: "user1 and user2 submit evidence for second appeal",
      actions: [
        {
          userName: "user1",
          name: "submitEvidence",
          args: {
            claimId: 8,
            ipfsEvidenceCids: ["QmSecondAppealEvidence1"],
            party: "claimant",
          },
          expected: "success",
        },
        {
          userName: "user2",
          name: "submitEvidence",
          args: {
            claimId: 8,
            ipfsEvidenceCids: ["QmSecondAppealCounterEvidence1"],
            party: "prosecutor",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator rejects claim 8 on second appeal",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 7,
            ruling: "RejectClaim",
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user2 claims prosecution reward after winning second appeal",
      actions: [
        {
          name: "wait",
          timeTravel: {
            days: 5, // Wait for appeal period to end
          },
        },
        {
          userName: "user2",
          name: "withdrawProsecutionReward",
          args: {
            claimId: 8,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user1 opens cover 9 on pool 0 for refusal to arbitrate test",
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
      description: "user1 creates claim 9 for cover 9",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 9,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 disputes claim 9",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 9,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator refuses to arbitrate claim 9 (dispute 8)",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 8,
            ruling: "RefusedToArbitrate",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 appeals the refusal to arbitrate on claim 9",
      actions: [
        {
          userName: "user1",
          name: "appeal",
          args: {
            claimId: 9,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator accepts claim 9 after appeal from refusal",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 8,
            ruling: "PayClaimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user1 withdraws compensation after winning appeal from refusal",
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
            claimId: 9,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user1 opens cover 10 on pool 0 for overrule after appeal test",
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
            coverAmount: 1_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 500,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 creates claim 10 for cover 10",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 10,
            tokenSymbol: "USDC",
            amountClaimed: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 disputes claim 10",
      actions: [
        {
          userName: "user2",
          name: "disputeClaim",
          args: {
            claimId: 10,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator rejects claim 10 (dispute 9)",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 9,
            ruling: "RejectClaim",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 appeals the ruling on claim 10",
      actions: [
        {
          userName: "user1",
          name: "appeal",
          args: {
            claimId: 10,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "arbitrator accepts claim 10 on appeal",
      actions: [
        {
          userName: "deployer",
          name: "rule",
          args: {
            disputeId: 9,
            ruling: "PayClaimant",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "deployer overrules claim 10 after appeal",
      actions: [
        {
          userName: "deployer",
          name: "overrule",
          args: {
            claimId: 10,
            punish: false,
          },
          expected: "success",
        },
      ],
    },
  ],
};
