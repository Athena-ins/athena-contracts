import { Scenario } from "../utils/actionEngine";

export const coverOpenAndUpdate: Scenario = {
  title: "open & update covers",
  stories: [
    {
      description: "User a does stuff blabla",
      actions: [
        // create pool
        {
          userName: "deployer",
          name: "createPool",
          args: {
            paymentAsset: "USDT",
            strategyId: 0,
            compatiblePools: [],
          },
          expected: "success",
        },
        // get tokens for pos
        {
          userName: "user0",
          name: "getTokens",
          args: {
            tokenName: "USDT",
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
            tokenName: "USDT",
            amount: 10_000,
          },
          expected: "success",
        },
        // open position
        {
          userName: "user0",
          name: "openPosition",
          args: {
            amount: 5000,
            isWrapped: false,
            poolIds: [0],
          },
          expected: "success",
        },
        // get tokens for cover
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenName: "USDT",
            amount: 2000,
          },
          expected: "success",
        },
        // approve tokens for cover
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenName: "USDT",
            amount: 2000,
          },
          expected: "success",
        },
        // open cover
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverAmount: 5000,
            premiumAmount: 2000,
          },
          expected: "success",
        },
        {
          userName: "user0",
          name: "addLiquidity",
          expected: "success",
          args: {
            positionId: 0,
            isWrapped: false,
            amount: 5000,
          },
        },
        {
          userName: "user0",
          name: "commitRemoveLiquidity",
          expected: "success",
          args: {
            positionId: 0,
          },
          timeTravel: {
            days: 16,
          },
        },
        {
          userName: "user0",
          name: "removeLiquidity",
          expected: "success",
          args: {
            positionId: 0,
            amount: 2000,
            keepWrapped: false,
          },
        },
        {
          userName: "user0",
          name: "commitRemoveLiquidity",
          expected: "success",
          args: {
            positionId: 0,
          },
        },
        {
          userName: "user0",
          name: "uncommitRemoveLiquidity",
          expected: "success",
          args: {
            positionId: 0,
          },
        },
        {
          userName: "user1",
          name: "updateCover",
          expected: "success",
          args: {
            coverId: 0,
            coverToAdd: 0,
            coverToRemove: 1000,
            premiumToAdd: 0,
            premiumToRemove: 10,
          },
        },
        {
          userName: "user1",
          name: "initiateClaim",
          expected: "success",
          args: {
            coverId: 0,
            amountClaimed: 1000,
          },
          timeTravel: { days: 15 },
        },

        {
          userName: "user1",
          name: "withdrawCompensation",
          expected: "success",
          args: {
            claimId: 0,
          },
        },
        {
          userName: "user0",
          name: "takeInterests",
          expected: "success",
          args: {
            positionId: 0,
          },
        },
      ],
    },
  ],
};
