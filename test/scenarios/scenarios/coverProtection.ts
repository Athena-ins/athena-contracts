import { Scenario } from "../utils/actionEngine";

export const coverProtection: Scenario = {
  title: "make and manage covers",
  stories: [
    {
      description: "deployer creates pools 0 and 1",
      actions: [
        // create pool
        {
          userName: "deployer",
          name: "createPool",
          args: {
            paymentAssetSymbol: "USDC",
            strategyId: 0,
            compatiblePools: [1],
          },
          expected: "success",
        },
        // create pool
        {
          userName: "deployer",
          name: "createPool",
          args: {
            paymentAssetSymbol: "USDC",
            strategyId: 0,
            compatiblePools: [0],
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 gets 10_000 USDC and approves liquidity manager",
      actions: [
        // get tokens for pos
        {
          userName: "user0",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 10_000,
          },
          expected: "success",
        },
        // approve tokens for pos
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
      ],
    },
    {
      description:
        "user0 creates position 0 with 10_000 USDC using pool 0 and 1",
      actions: [
        // open position
        {
          userName: "user0",
          name: "openPosition",
          args: {
            amount: 10_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [0, 1],
          },
          expected: "success",
        },
      ],
    },
    /**
     * Make covers
     */
    {
      description: "user1 gets 2_000 USDC and approves liquidity manager",
      actions: [
        // get tokens for cover
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 2_000,
          },
          expected: "success",
        },
        // approve tokens for cover
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 creates cover reverted because he lacks the funds",
      actions: [
        // open cover
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 8_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 2_001,
          },
          expected: "revert",
        },
      ],
    },
    {
      description:
        "user1 creates cover 0 of 8_000 USDC with 1_000 USDC in premiums in pool 0",
      actions: [
        // open cover
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 8_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 1_000,
          },
          expected: "success",
          timeTravel: {
            days: 5,
          },
        },
      ],
    },
    {
      description: "user1 updates cover 0 adding 2_000 USDC in cover amount",
      actions: [
        // update cover
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 0,
            coverTokenSymbol: "USDC",
            coverToAdd: 2_000,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 0,
          },
          expected: "success",
          timeTravel: {
            days: 5,
          },
        },
      ],
    },
    {
      description: "user1 updates cover 0 removing 9_999 USDC in cover amount",
      actions: [
        // update cover
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 0,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 9_999,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 0,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 updates cover 0 adding 1 USDC in premiums",
      actions: [
        // update cover
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 0,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 1,
            premiumToRemove: 0,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 updates cover 0 removing 1 USDC in premiums",
      actions: [
        // update cover
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 0,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 1,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user1 updates cover 0 adding 500 USDC in cover and 100 USDC in premiums",
      actions: [
        // update cover
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 0,
            coverTokenSymbol: "USDC",
            coverToAdd: 500,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 100,
            premiumToRemove: 0,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user1 updates cover 0 removing 500 USDC in cover and adding 100 USDC in premiums",
      actions: [
        // update cover
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 0,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 500,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 100,
            premiumToRemove: 0,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 closes cover 0 by removing all premiums",
      actions: [
        // update cover
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 0,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: "maxUint",
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 gets 50 USDC and approves liquidity manager",
      actions: [
        // get tokens for cover
        {
          userName: "user2",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 50,
          },
          expected: "success",
        },
        // approve tokens for cover
        {
          userName: "user2",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 50,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user2 creating cover of 10_001 USDC reverts because there is not enough liquidity",
      actions: [
        // open cover
        {
          userName: "user2",
          name: "openCover",
          args: {
            poolId: 1,
            coverTokenSymbol: "USDC",
            coverAmount: 10_001,
            premiumTokenSymbol: "USDC",
            premiumAmount: 50,
          },
          expected: "revert",
          revertMessage: "InsufficientCapacity",
        },
      ],
    },
    {
      description: "user2 creating cover reverts because premiums are too low",
      actions: [
        // open cover
        {
          userName: "user2",
          name: "openCover",
          args: {
            poolId: 1,
            coverTokenSymbol: "USDC",
            coverAmount: 2_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 0.0001,
          },
          expected: "revert",
          revertMessage: "DurationBelowOneTick",
        },
      ],
    },
    {
      description:
        "user2 creates cover 1 of 10_000 USDC with 50 USDC in premiums in pool 1",
      actions: [
        // open cover
        {
          userName: "user2",
          name: "openCover",
          args: {
            poolId: 1,
            coverTokenSymbol: "USDC",
            coverAmount: 10_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 50,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 fails to update expired cover after 1 year",
      actions: [
        {
          name: "wait",
          timeTravel: {
            days: 365,
          },
        },
        {
          userName: "user2",
          name: "updateCover",
          args: {
            coverId: 1,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 100,
            premiumToRemove: 0,
          },
          expected: "revert",
          revertMessage: "CoverIsExpired",
        },
      ],
    },
    {
      description: "user3 gets 2_000 USDC and approves liquidity manager",
      actions: [
        // get tokens for cover
        {
          userName: "user3",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 2_000,
          },
          expected: "success",
        },
        // approve tokens for cover
        {
          userName: "user3",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user3 creates cover 2 of 6_000 USDC with 1_000 USDC in premiums in pool 0",
      actions: [
        // open cover
        {
          userName: "user3",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 6_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 1_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user3 creates cover 3 of 2_000 USDC with 1_000 USDC in premiums in pool 0",
      actions: [
        // open cover
        {
          userName: "user3",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 2_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 1_000,
          },
          expected: "success",
          timeTravel: {
            days: 5,
          },
        },
      ],
    },
    {
      description: "user3 updates cover 2 adding 2_000 USDC in cover amount",
      actions: [
        // update cover
        {
          userName: "user3",
          name: "updateCover",
          args: {
            coverId: 2,
            coverTokenSymbol: "USDC",
            coverToAdd: 2_000,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 0,
          },
          expected: "success",
          timeTravel: {
            days: 5,
          },
        },
      ],
    },
    {
      description: "user3 updates cover 3 removing 800 USDC in premiums",
      actions: [
        // update cover
        {
          userName: "user3",
          name: "updateCover",
          args: {
            coverId: 3,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 800,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user3 closes cover 2 by removing all premiums",
      actions: [
        // update cover
        {
          userName: "user3",
          name: "updateCover",
          args: {
            coverId: 2,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: "maxUint",
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user3 fails to update cover 2 after all premiums were removed",
      actions: [
        {
          userName: "user3",
          name: "updateCover",
          args: {
            coverId: 2,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 1,
            premiumToRemove: 0,
          },
          expected: "revert",
          revertMessage: "CoverIsExpired",
        },
      ],
    },
  ],
};
