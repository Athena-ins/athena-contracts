import { Scenario } from "../utils/actionEngine";

export const liquidityNegatives: Scenario = {
  title: "handle negatives in context of liquidity provision",
  stories: [
    {
      description: "deployer creates pools 0, 1, 2 and 3",
      actions: [
        // create pool
        {
          userName: "deployer",
          name: "createPool",
          args: {
            paymentAssetSymbol: "USDC",
            strategyId: 0,
            compatiblePools: [1, 2],
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
            compatiblePools: [0, 2],
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
            compatiblePools: [0, 1],
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
      description: "user1 creates position 1 with 5_000 USDC using pool 0 & 1",
      actions: [
        // open position
        {
          userName: "user1",
          name: "openPosition",
          args: {
            amount: 5_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [0, 1],
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user1 fails to add zero liquidity to position 1",
      actions: [
        {
          userName: "user1",
          name: "addLiquidity",
          args: {
            positionId: 1,
            tokenSymbol: "USDC",
            amount: 0,
            isWrapped: false,
          },
          expected: "revert",
          revertMessage: "ForbiddenZeroValue",
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
      description: "user2 fails to create position because of zero amount",
      actions: [
        {
          userName: "user2",
          name: "openPosition",
          args: {
            amount: 0,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [1],
          },
          expected: "revert",
          revertMessage: "ForbiddenZeroValue",
        },
      ],
    },
    {
      description: "user2 fails to create position because of pool order",
      actions: [
        // open position
        {
          userName: "user2",
          name: "openPosition",
          args: {
            amount: 4_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [2, 1],
          },
          expected: "revert",
          revertMessage: "PoolIdsMustBeUniqueAndAscending",
        },
        {
          userName: "user2",
          name: "openPosition",
          args: {
            amount: 4_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [1, 0, 2],
          },
          expected: "revert",
          revertMessage: "PoolIdsMustBeUniqueAndAscending",
        },
        {
          userName: "user2",
          name: "openPosition",
          args: {
            amount: 4_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [1, 0],
          },
          expected: "revert",
          revertMessage: "PoolIdsMustBeUniqueAndAscending",
        },
      ],
    },
    {
      description:
        "user2 fails to create position because the leverage is too high",
      actions: [
        {
          userName: "user2",
          name: "openPosition",
          args: {
            amount: 4_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4],
          },
          expected: "revert",
          revertMessage: "AmountOfPoolsIsAboveMaxLeverage",
        },
      ],
    },
    {
      description:
        "user2 fails to create position because of pool compatibility",
      actions: [
        {
          userName: "user2",
          name: "openPosition",
          args: {
            amount: 4_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [0, 3],
          },
          expected: "revert",
          revertMessage: "IncompatiblePools",
        },
        {
          userName: "user2",
          name: "openPosition",
          args: {
            amount: 4_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [1, 3],
          },
          expected: "revert",
          revertMessage: "IncompatiblePools",
        },
        {
          userName: "user2",
          name: "openPosition",
          args: {
            amount: 4_000,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [2, 3],
          },
          expected: "revert",
          revertMessage: "IncompatiblePools",
        },
      ],
    },
    {
      description: "user2 fails to create position because pool does not exist",
      actions: [
        {
          userName: "user2",
          name: "openPosition",
          args: {
            amount: 100,
            tokenSymbol: "USDC",
            isWrapped: false,
            poolIds: [4],
          },
          expected: "revert",
          revertMessage: "PoolDoesNotExist",
        },
      ],
    },
    {
      description: "user0 cannot commit to remove liquidity from position 1",
      actions: [
        {
          userName: "user0",
          name: "commitRemoveLiquidity",
          args: {
            positionId: 1,
          },
          expected: "revert",
          revertMessage: "OnlyTokenOwner",
        },
      ],
    },
    {
      description: "user0 cannot uncommit to remove liquidity from position 1",
      actions: [
        {
          userName: "user0",
          name: "uncommitRemoveLiquidity",
          args: {
            positionId: 1,
          },
          expected: "revert",
          revertMessage: "OnlyTokenOwner",
        },
      ],
    },
    {
      description: "user0 cannot attempt to withdraw liquidity from position 1",
      actions: [
        {
          userName: "user0",
          name: "removeLiquidity",
          args: {
            positionId: 1,
            tokenSymbol: "USDC",
            amount: 1,
            keepWrapped: false,
          },
          expected: "revert",
          revertMessage: "OnlyTokenOwner",
        },
      ],
    },
    {
      description: "user0 cannot take interests from position 1",
      actions: [
        {
          userName: "user0",
          name: "takeInterests",
          args: {
            positionId: 1,
          },
          expected: "revert",
          revertMessage: "OnlyTokenOwner",
        },
      ],
    },
    {
      description: "user0 cannot add liquidity to position 1",
      actions: [
        {
          userName: "user0",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 1,
          },
          expected: "success",
        },
        {
          userName: "user0",
          name: "addLiquidity",
          args: {
            positionId: 1,
            tokenSymbol: "USDC",
            amount: 1,
            isWrapped: false,
          },
          expected: "revert",
          revertMessage: "OnlyTokenOwner",
        },
      ],
    },
    {
      description: "user0 cannot uncommit non commited position 0",
      actions: [
        {
          userName: "user0",
          name: "uncommitRemoveLiquidity",
          args: {
            positionId: 0,
          },
          expected: "revert",
          revertMessage: "PositionNotCommited",
        },
      ],
    },
    {
      description: "user0 commits to withdraw from position 0",
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
      description: "user0 cannot increase liquidity in commited position 0",
      actions: [
        {
          userName: "user0",
          name: "addLiquidity",
          args: {
            positionId: 0,
            tokenSymbol: "USDC",
            amount: 1,
            isWrapped: false,
          },
          expected: "revert",
          revertMessage: "CannotIncreaseCommittedPosition",
        },
      ],
    },
    {
      description: "user0 cannot take interests in commited position 0",
      actions: [
        {
          userName: "user0",
          name: "takeInterests",
          args: {
            positionId: 0,
          },
          expected: "revert",
          revertMessage: "CannotTakeInterestsCommittedPosition",
        },
      ],
    },
    {
      description:
        "user0 cannot withdraw from position 0 before delay is reached",
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
          revertMessage: "WithdrawCommitDelayNotReached",
        },
        {
          name: "wait",
          timeTravel: {
            days: 5,
          },
        },
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
          revertMessage: "WithdrawCommitDelayNotReached",
        },
        {
          name: "wait",
          timeTravel: {
            days: 5,
          },
        },
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
          revertMessage: "WithdrawCommitDelayNotReached",
        },
      ],
    },
    {
      description: "user0 cannot withdraw zero from position 0",
      actions: [
        {
          name: "wait",
          timeTravel: {
            days: 5,
          },
        },
        {
          userName: "user0",
          name: "removeLiquidity",
          args: {
            positionId: 0,
            tokenSymbol: "USDC",
            amount: 0,
            keepWrapped: false,
          },
          expected: "revert",
          revertMessage: "ForbiddenZeroValue",
        },
      ],
    },
    {
      description: "user0 cannot withdraw more than deposit from position 0",
      actions: [
        {
          userName: "user0",
          name: "removeLiquidity",
          args: {
            positionId: 0,
            tokenSymbol: "USDC",
            amount: 3_001,
            keepWrapped: false,
          },
          expected: "revert",
          revertMessage: "InsufficientLiquidityForWithdrawal",
        },
      ],
    },
    {
      description: "user0 partially withdraws from position 0",
      actions: [
        {
          userName: "user0",
          name: "removeLiquidity",
          args: {
            positionId: 0,
            tokenSymbol: "USDC",
            amount: 1_000,
            keepWrapped: false,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 cannot withdraw again from position 0",
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
          revertMessage: "PositionNotCommited",
        },
      ],
    },
    {
      description: "user3 creates cover 0 in pool 0 & creates a claim",
      actions: [
        {
          userName: "user3",
          name: "getTokens",
          args: {
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user3",
          name: "approveTokens",
          args: {
            spender: "LiquidityManager",
            tokenSymbol: "USDC",
            amount: 500,
          },
          expected: "success",
        },
        {
          userName: "user3",
          name: "openCover",
          args: {
            poolId: 0,
            coverTokenSymbol: "USDC",
            coverAmount: 1_500,
            premiumTokenSymbol: "USDC",
            premiumAmount: 500,
          },
          expected: "success",
        },
        {
          userName: "user3",
          name: "initiateClaim",
          args: {
            coverId: 0,
            tokenSymbol: "USDC",
            amountClaimed: 1_000,
          },
          timeTravel: { days: 15 },
          expected: "success",
        },
      ],
    },
    {
      description:
        "user0 cannot commit withdraw from position 0 because of claim",
      actions: [
        {
          userName: "user0",
          name: "commitRemoveLiquidity",
          args: {
            positionId: 0,
          },
          expected: "revert",
          revertMessage: "PoolHasOnGoingClaims",
        },
      ],
    },
    {
      description: "user3 withdraw claim compensation payout",
      actions: [
        {
          userName: "user3",
          name: "withdrawCompensation",
          args: {
            claimId: 0,
          },
          expected: "success",
        },
      ],
    },
    {
      description: "user0 commits to withdraw from position 0",
      actions: [
        {
          userName: "user0",
          name: "commitRemoveLiquidity",
          args: {
            positionId: 0,
          },
          expected: "success",
          timeTravel: { days: 15 },
          skipTokenCheck: true,
        },
      ],
    },
    {
      description:
        "user0 cannot withdraw more than capital minus payout from position 0",
      actions: [
        {
          userName: "user0",
          name: "removeLiquidity",
          args: {
            positionId: 0,
            tokenSymbol: "USDC",
            amount: 2_001,
            keepWrapped: false,
          },
          expected: "revert",
          revertMessage: "InsufficientLiquidityForWithdrawal",
        },
      ],
    },
  ],
};
