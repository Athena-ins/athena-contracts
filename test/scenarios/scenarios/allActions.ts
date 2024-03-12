import { Scenario } from "../utils/actionEngine";

// {
//   description: "",
//   actions: [],
// },

export const allActions: Scenario = {
  title: "test all available actions",
  stories: [
    {
      description: "deployer creates pool 0",
      actions: [
        // create pool
        {
          userName: "deployer",
          name: "createPool",
          args: {
            paymentAssetSymbol: "USDT",
            strategyId: 0,
            compatiblePools: [],
          },
          expected: "success",
        },
      ],
    },
    // get tokens for pos
    {
      description: "user0 gets 10_000 USDT",
      actions: [
        {
          userName: "user0",
          name: "getTokens",
          args: {
            tokenSymbol: "USDT",
            amount: 10_000,
          },
          expected: "success",
        },
      ],
    },
    // approve tokens for pos
    {
      description: "user0 approves 10_000 USDT for LiquidityManager",
      actions: [
        {
          userName: "user0",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDT",
            amount: 10_000,
          },
          expected: "success",
        },
      ],
    },
    // open position
    {
      description: "user0 opens a position with 5_000 USDT in pool 0",
      actions: [
        {
          userName: "user0",
          name: "openPosition",
          args: {
            amount: 5000,
            tokenSymbol: "USDT",
            isWrapped: false,
            poolIds: [0],
          },
          expected: "success",
        },
      ],
    },
    // get tokens for cover
    {
      description: "user1 gets 2_000 USDT",
      actions: [
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenSymbol: "USDT",
            amount: 2_000,
          },
          expected: "success",
        },
      ],
    },
    // approve tokens for cover
    {
      description: "user1 approves 2_000 USDT for LiquidityManager",
      actions: [
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDT",
            amount: 2_000,
          },
          expected: "success",
        },
      ],
    },
    // open cover
    {
      description:
        "user1 opens a cover for 5_000 USDT with 2_000 USDT premiums in pool 0",
      actions: [
        {
          userName: "user1",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDT",
            coverAmount: 5_000,
            premiumTokenSymbol: "USDT",
            premiumAmount: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 adds 5_000 USDT to position 0 containing pool 0",
      actions: [
        {
          userName: "user0",
          name: "addLiquidity",
          args: {
            positionId: 0,
            isWrapped: false,
            tokenSymbol: "USDT",
            amount: 5_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user0 commits to remove liquidity from position 0 & waits 16 days",
      actions: [
        {
          userName: "user0",
          name: "commitRemoveLiquidity",
          args: {
            positionId: 0,
          },
          timeTravel: {
            days: 16,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 removes 2_000 USDT from position 0",
      actions: [
        {
          userName: "user0",
          name: "removeLiquidity",
          args: {
            positionId: 0,
            tokenSymbol: "USDT",
            amount: 2_000,
            keepWrapped: false,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 again commits to remove liquidity from position 0",
      actions: [
        {
          userName: "user0",
          name: "commitRemoveLiquidity",
          args: {
            positionId: 0,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 uncommits to remove liquidity from position 0",
      actions: [
        {
          userName: "user0",
          name: "uncommitRemoveLiquidity",
          args: {
            positionId: 0,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user1 updates cover 0 to reduce cover of 1_000 USDT and remove 10 USDT premiums",
      actions: [
        {
          userName: "user1",
          name: "updateCover",
          args: {
            coverId: 0,
            coverTokenSymbol: "USDT",
            coverToAdd: 0,
            coverToRemove: 1_000,
            premiumTokenSymbol: "USDT",
            premiumToAdd: 0,
            premiumToRemove: 10,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 takes interests from position 0",
      actions: [
        {
          userName: "user0",
          name: "takeInterests",
          args: {
            positionId: 0,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user1 initiates claim for 1_000 USDT from cover 0 and waits 15 days",
      actions: [
        {
          userName: "user1",
          name: "initiateClaim",
          args: {
            coverId: 0,
            tokenSymbol: "USDT",
            amountClaimed: 1_000,
          },
          timeTravel: { days: 15 },
          expected: "success",
        },
      ],
    },

    {
      description: "user1 withdraws compensation for claim 0",
      actions: [
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
  ],
};
