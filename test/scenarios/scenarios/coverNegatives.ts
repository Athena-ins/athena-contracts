import { Scenario } from "../utils/actionEngine";

export const coverNegatives: Scenario = {
  title: "handle negatives in context of covers",
  stories: [
    {
      description: "deployer creates pools 0 & 1",
      actions: [
        // create pool
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
        // create pool
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
    /**
     * Provide liquidity
     */
    {
      description: "user0 gets 15_000 USDC and approves liquidity manager",
      actions: [
        // get tokens for pos
        {
          userName: "user0",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 15_000,
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
            amount: 15_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 creates position 0 with 5_000 USDC using pool 0",
      actions: [
        // open position
        {
          userName: "user0",
          name: "openPosition",
          args: {
            amount: 5_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [0],
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 creates position 1 with 10_000 USDC using pool 1",
      actions: [
        // open position
        {
          userName: "user0",
          name: "openPosition",
          args: {
            amount: 10_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [1],
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
      description:
        "user1 creates cover 0 of 3_000 USDC with 100 USDC in premiums in pool 0",
      actions: [
        // open cover
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 3_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 100,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 gets 1_000 USDC and approves liquidity manager",
      actions: [
        // get tokens for cover
        {
          userName: "user2",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 1_000,
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
            amount: 1_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user2 creates cover 1 of 9_000 USDC with 200 USDC in premiums in pool 1",
      actions: [
        // open cover
        {
          userName: "user2",
          name: "openCover",
          args: {
            poolId: 1,
            coverTokenSymbol: "USDC",
            coverAmount: 9_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 200,
          },
          expected: "success",
        },
      ],
    },
    /**
     * Negatives
     */
    {
      description: "user1 cannot create cover in non existing pool",
      actions: [
        // open cover
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 2,
            coverTokenSymbol: "USDC",
            coverAmount: 1,
            premiumTokenSymbol: "USDC",
            premiumAmount: 1,
          },
          expected: "revert",
          revertMessage: "PoolDoesNotExist",
        },
      ],
    },
    {
      description: "user1 cannot increase cover amount of user2's cover 1",
      actions: [
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 1,
            coverTokenSymbol: "USDC",
            coverToAdd: 1,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 0,
          },
          expected: "revert",
          revertMessage: "OnlyTokenOwner",
        },
      ],
    },
    {
      description: "user1 cannot decrease cover amount of user2's cover 1",
      actions: [
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 1,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 1,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 0,
          },
          expected: "revert",
          revertMessage: "OnlyTokenOwner",
        },
      ],
    },
    {
      description: "user1 cannot add premiums of user2's cover 1",
      actions: [
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 1,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 1,
            premiumToRemove: 0,
          },
          expected: "revert",
          revertMessage: "OnlyTokenOwner",
        },
      ],
    },
    {
      description: "user1 cannot remove premiums of user2's cover 1",
      actions: [
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 1,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 1,
          },
          expected: "revert",
          revertMessage: "OnlyTokenOwner",
        },
      ],
    },
    {
      description:
        "user1 cannot create cover with zero cover amount & premiums",
      actions: [
        // open cover
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 0,
            premiumTokenSymbol: "USDC",
            premiumAmount: 0,
          },
          expected: "revert",
          revertMessage: "ForbiddenZeroValue",
        },
      ],
    },
    {
      description: "user1 cannot create cover with zero cover amount",
      actions: [
        // open cover
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 0,
            premiumTokenSymbol: "USDC",
            premiumAmount: 1,
          },
          expected: "revert",
          revertMessage: "ForbiddenZeroValue",
        },
      ],
    },
    {
      description: "user1 cannot create cover with zero premiums",
      actions: [
        // open cover
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 1,
            premiumTokenSymbol: "USDC",
            premiumAmount: 0,
          },
          expected: "revert",
          revertMessage: "ForbiddenZeroValue",
        },
      ],
    },
    {
      description:
        "user1 cannot create cover with premiums below the cost of 1 tick",
      actions: [
        // open cover
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 1_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 0.00001,
          },
          expected: "revert",
          revertMessage: "DurationBelowOneTick",
        },
      ],
    },
    {
      description: "user1 cannot update cover 0 to zero cover amount",
      actions: [
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 0,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 3_000,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 0,
          },
          expected: "revert",
          revertMessage: "ForbiddenZeroValue",
        },
      ],
    },
    {
      description:
        "user1 cannot update cover 0 above pool 0 available liquidity",
      actions: [
        // open cover
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 0,
            coverTokenSymbol: "USDC",
            coverToAdd: 2_001,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 0,
          },
          expected: "revert",
          revertMessage: "InsufficientCapacity",
        },
      ],
    },
    {
      description:
        "user1 cannot create cover 2 above pool 0 available liquidity",
      actions: [
        // open cover
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 2_001,
            premiumTokenSymbol: "USDC",
            premiumAmount: 1,
          },
          expected: "revert",
          revertMessage: "InsufficientCapacity",
        },
      ],
    },

    {
      description: "user1 withdraws all premiums from cover 0",
      actions: [
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
      description: "user1 cannot increase cover amount of cover 0 once closed",
      actions: [
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 0,
            coverTokenSymbol: "USDC",
            coverToAdd: 1,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 0,
          },
          expected: "revert",
          revertMessage: "CoverIsExpired",
        },
      ],
    },
    {
      description: "user1 cannot decrease cover amount of cover 0 once closed",
      actions: [
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 0,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 1,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 0,
          },
          expected: "revert",
          revertMessage: "CoverIsExpired",
        },
      ],
    },
    {
      description: "user1 cannot add premiums of cover 0 once closed",
      actions: [
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
          expected: "revert",
          revertMessage: "CoverIsExpired",
        },
      ],
    },
    {
      description: "user1 cannot remove premiums of cover 0 once closed",
      actions: [
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
          expected: "revert",
          revertMessage: "CoverIsExpired",
        },
      ],
    },
    {
      description: "user2 cannot increase cover amount cover 1 once expired",
      actions: [
        {
          name: "wait",
          timeTravel: {
            days: 500,
          },
        },
        {
          userName: "user2",
          name: "updateCover",
          args: {
            coverId: 1,
            coverTokenSymbol: "USDC",
            coverToAdd: 1,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 0,
          },
          expected: "revert",
          revertMessage: "CoverIsExpired",
        },
      ],
    },
    {
      description: "user2 cannot decrease cover amount cover 1 once expired",
      actions: [
        {
          userName: "user2",
          name: "updateCover",
          args: {
            coverId: 1,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 1,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 0,
          },
          expected: "revert",
          revertMessage: "CoverIsExpired",
        },
      ],
    },
    {
      description: "user2 cannot add premiums cover 1 once expired",
      actions: [
        {
          userName: "user2",
          name: "updateCover",
          args: {
            coverId: 1,
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
    {
      description: "user2 cannot remove premiums cover 1 once expired",
      actions: [
        {
          userName: "user2",
          name: "updateCover",
          args: {
            coverId: 1,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 1,
          },
          expected: "revert",
          revertMessage: "CoverIsExpired",
        },
      ],
    },
  ],
};

// error ForbiddenZeroValue();
// error OnlyTokenOwner();
// error InsufficientLiquidityForCover();
// error CoverIsExpired();
// error NotEnoughPremiums();
