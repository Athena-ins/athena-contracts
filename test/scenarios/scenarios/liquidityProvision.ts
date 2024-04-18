import { Scenario } from "../utils/actionEngine";

export const liquidityProvision: Scenario = {
  title: "make and manage liquidity positions",
  stories: [
    {
      description: "deployer creates pools 0, 1 and 2",
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
    {
      description: "user0 gets 3_000 USDC and approves liquidity manager",
      actions: [
        // get tokens for pos
        {
          userName: "user0",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
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
            tokenSymbol: "USDC",
            amount: 3_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user0 creates position 0 with 3_000 USDC using pool 0 and 1",
      actions: [
        // open position
        {
          userName: "user0",
          name: "openPosition",
          args: {
            amount: 3_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [0, 1],
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 gets 9_000 USDC and approves liquidity manager",
      actions: [
        // get tokens for pos
        {
          userName: "user1",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 9_000,
          },
          expected: "success",
        },
        // approve tokens for pos
        {
          userName: "user1",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 9_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 creates position 1 with 5_000 USDC using pool 1",
      actions: [
        // open position
        {
          userName: "user1",
          name: "openPosition",
          args: {
            amount: 5_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [1],
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 gets 12_000 USDC and approves liquidity manager",
      actions: [
        // get tokens for pos
        {
          userName: "user2",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 12_000,
          },
          expected: "success",
        },
        // approve tokens for pos
        {
          userName: "user2",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 12_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 creates position 2 with 4_000 USDC using pool 2",
      actions: [
        // open position
        {
          userName: "user2",
          name: "openPosition",
          args: {
            amount: 4_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [2],
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user3 creates cover 0 in pool 1 for 8_000 USDC with 3_000 USDC premiums after getting funds",
      actions: [
        // get tokens for cover
        {
          userName: "user3",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 3_000,
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
            amount: 3_000,
          },
          expected: "success",
        },
        // open cover
        {
          userName: "user3",
          name: "openCover",
          args: {
            poolId: 1,
            coverTokenSymbol: "USDC",
            coverAmount: 8_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 3_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 commit to withdraw liquidity from position 0",
      actions: [
        // commit to withdraw
        {
          userName: "user0",
          name: "commitRemoveLiquidity",
          args: {
            positionId: 0,
          },
          expected: "success",
          timeTravel: {
            days: 16,
          },
        },
      ],
    },
    {
      description:
        "user0 withdrawal from position 0 reverts because liquidity is unavailable",
      actions: [
        {
          userName: "user0",
          name: "removeLiquidity",
          args: {
            positionId: 0,
            tokenSymbol: "USDC",
            amount: 1,
            keepWrapped: false,
          },
          expected: "revert",
          revertMessage: "NotEnoughLiquidityForRemoval",
        },
      ],
    },
    {
      description: "user1 adds 4_000 USDC to its position 1",
      actions: [
        {
          userName: "user1",
          name: "addLiquidity",
          args: {
            positionId: 1,
            isWrapped: false,
            tokenSymbol: "USDC",
            amount: 4_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 can now withdraw all liquidity from its position 0",
      actions: [
        {
          userName: "user0",
          name: "removeLiquidity",
          args: {
            positionId: 0,
            tokenSymbol: "USDC",
            amount: 3_000,
            keepWrapped: false,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user3 removes all premiums from cover 0 to close it",
      actions: [
        {
          userName: "user3",
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
      description: "user1 commits to withdraw liquidity from position 1",
      actions: [
        // commit to withdraw
        {
          userName: "user1",
          name: "commitRemoveLiquidity",
          args: {
            positionId: 1,
          },
          expected: "success",
          timeTravel: {
            days: 16,
          },
        },
      ],
    },
    {
      description: "user1 can now withdraw all liquidity from its position 1",
      actions: [
        {
          userName: "user1",
          name: "removeLiquidity",
          args: {
            positionId: 1,
            tokenSymbol: "USDC",
            amount: 5_000,
            keepWrapped: false,
          },
          expected: "success",
        },
      ],
    },
    /**
     * User2 and take interests, commit, uncommit, remove liquidity
     */
    {
      description: "user2 takes interests from its position 2",
      actions: [
        {
          userName: "user2",
          name: "takeInterests",
          args: {
            positionId: 2,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 commits to withdraw liquidity from position 2",
      actions: [
        // commit to withdraw
        {
          userName: "user2",
          name: "commitRemoveLiquidity",
          args: {
            positionId: 2,
          },
          expected: "success",
          timeTravel: {
            days: 16,
          },
        },
      ],
    },
    {
      description:
        "user2 takes interests reverts because position 2 is commited to withdraw",
      actions: [
        {
          userName: "user2",
          name: "takeInterests",
          args: {
            positionId: 2,
          },
          expected: "revert",
          revertMessage: "CannotUpdatePositionIfCommittedWithdrawal",
        },
      ],
    },
    {
      description: "user2 uncommits to withdraw liquidity from position 2",
      actions: [
        {
          userName: "user2",
          name: "uncommitRemoveLiquidity",
          args: {
            positionId: 2,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 can now takes interests again from its position 2",
      actions: [
        {
          userName: "user2",
          name: "takeInterests",
          args: {
            positionId: 2,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 commits to withdraw liquidity from position 2",
      actions: [
        // commit to withdraw
        {
          userName: "user2",
          name: "commitRemoveLiquidity",
          args: {
            positionId: 2,
          },
          expected: "success",
          timeTravel: {
            days: 16,
          },
        },
      ],
    },
    {
      description:
        "user2 can withdraw all liquidity from its position 2 since there is no cover",
      actions: [
        {
          userName: "user2",
          name: "removeLiquidity",
          args: {
            positionId: 2,
            tokenSymbol: "USDC",
            amount: 4_000,
            keepWrapped: false,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user2 can add 2_000 USDC to its position 2 after having withdrawn all liquidity",
      actions: [
        {
          userName: "user2",
          name: "addLiquidity",
          args: {
            positionId: 2,
            isWrapped: false,
            tokenSymbol: "USDC",
            amount: 2_000,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user3 creates cover 1 in pool 2",
      actions: [
        // approve tokens for cover
        {
          userName: "user3",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 320,
          },
          expected: "success",
        },
        // open cover
        {
          userName: "user3",
          name: "openCover",
          args: {
            poolId: 2,
            coverTokenSymbol: "USDC",
            coverAmount: 2_000,
            premiumTokenSymbol: "USDC",
            premiumAmount: 320,
          },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user2 commits to withdraw liquidity from position 2 long before removing it",
      actions: [
        {
          userName: "user2",
          name: "commitRemoveLiquidity",
          args: {
            positionId: 2,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user2 cannot empty position 2 before cover 1 expires",
      actions: [
        {
          userName: "deployer",
          name: "wait",
          timeTravel: {
            days: 364,
          },
          expected: "success",
          args: {},
        },
        {
          userName: "user2",
          name: "removeLiquidity",
          args: {
            positionId: 2,
            tokenSymbol: "USDC",
            amount: 2_000,
            keepWrapped: false,
          },
          expected: "revert",
          revertMessage: "NotEnoughLiquidityForRemoval",
        },
      ],
    },
    {
      description: "user2 can empty position 2 after cover 1",
      actions: [
        {
          userName: "deployer",
          name: "wait",
          timeTravel: {
            days: 1,
            hours: 1.5, // 1 tick + 1 sec
            seconds: 1,
          },
          expected: "success",
          args: {},
        },
        {
          userName: "user3",
          name: "updateCover",
          args: {
            coverId: 1,
            coverTokenSymbol: "USDC",
            coverToAdd: 0,
            coverToRemove: 0,
            premiumTokenSymbol: "USDC",
            premiumToAdd: 0,
            premiumToRemove: 0,
          },
          expected: "revert",
          revertMessage: "CoverIsExpired",
        },
        {
          userName: "user2",
          name: "removeLiquidity",
          args: {
            positionId: 2,
            tokenSymbol: "USDC",
            amount: 2_000,
            keepWrapped: false,
          },
          expected: "success",
        },
      ],
    },
  ],
};
