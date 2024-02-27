import { expect } from "chai";
// Helpers
import { toUsd } from "../../helpers/protocol";
import { toRay } from "../../helpers/utils/poolRayMath";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {
    testCases: {
      testName: string;
      coveredCapital: BigNumber;
      liquidity: BigNumber;
      expectedUtilizationRate: BigNumber;
    }[];
  };
}

const scenarios = [
  {
    testName: "returns zero utilization rate if the liquidity is zero",
    coveredCapital: toUsd(100),
    liquidity: toUsd(0),
    expectedUtilizationRate: toRay(0),
  },
  {
    testName: "returns the correct utilization rate - case 1",
    coveredCapital: toUsd(10),
    liquidity: toUsd(200),
    expectedUtilizationRate: toRay(5),
  },
  {
    testName: "returns the correct utilization rate - case 2",
    coveredCapital: toUsd(100),
    liquidity: toUsd(300),
    expectedUtilizationRate: BigNumber.from("33333333333333333333333333333"),
  },
  {
    testName: "returns the correct utilization rate - case 3",
    coveredCapital: toUsd(100_000),
    liquidity: toUsd(200_000),
    expectedUtilizationRate: toRay(50),
  },
  {
    testName: "caps the utilization rate at 100%",
    coveredCapital: toUsd(200),
    liquidity: toUsd(100),
    expectedUtilizationRate: toRay(100),
  },
];

export function VirtualPool__utilization() {
  context("_utilization", function () {
    before(async function (this: Arguments) {
      this.args = {
        testCases: scenarios,
      };
    });

    for (let i = 0; i < scenarios.length; i++) {
      it(scenarios[i].testName, async function (this: Arguments) {
        const config = this.args.testCases[i];
        // Compute utilization using the contract
        const rate = await this.contracts.LiquidityManager.utilization(
          config.coveredCapital,
          config.liquidity,
        );

        // Calculate the expected utilization rate
        const expectedRate = config.expectedUtilizationRate;

        // Check if the computed rate matches the expected value
        expect(rate).to.equal(expectedRate);
      });
    }
  });
}
