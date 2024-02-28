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
            amount: 10_000,
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
            amount: 20,
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
            amount: 20,
          },
          expected: "success",
        },
        // open cover
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverAmount: 100,
            premiumAmount: 20,
          },
          expected: "success",
        },
      ],
    },
  ],
};
