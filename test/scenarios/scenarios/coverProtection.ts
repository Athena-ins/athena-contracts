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
            paymentAssetSymbol: "USDT",
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
            paymentAssetSymbol: "USDT",
            strategyId: 0,
            compatiblePools: [0],
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 gets 3_000 USDT and approves liquidity manager",
      actions: [
        // get tokens for pos
        {
          userName: "user0",
          name: "getTokens",
          args: {
            tokenSymbol: "USDT",
            amount: 3_000,
          },
          expected: "success",
        },
        // approve tokens for pos
        {
          userName: "user0",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDT",
            amount: 3_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user0 creates position 0 with 3_000 USDT using pool 0 and 1",
      actions: [
        // open position
        {
          userName: "user0",
          name: "openPosition",
          args: {
            amount: 3_000,
            tokenSymbol: "USDT",
            isWrapped: false,
            poolIds: [0, 1],
          },
          expected: "success",
        },
      ],
    },
  ],
};
