import { Scenario } from "../utils/actionEngine";

export const liquidityNegatives: Scenario = {
  title: "handle negatives in context of liquidity provision",
  stories: [
    {
      description: "User a does stuff blabla",
      actions: [],
    },
    {
      description:
        "user0 creating position 0 reverts because of pool ID ordering",
      actions: [
        // open position
        {
          userName: "user0",
          name: "openPosition",
          args: {
            amount: 3_000,
            tokenSymbol: "USDT",
            isWrapped: false,
            poolIds: [1, 0],
          },
          expected: "success",
        },
      ],
    },
  ],
};
