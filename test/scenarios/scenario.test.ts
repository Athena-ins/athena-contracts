import { evmSnapshot, evmRevert } from "../helpers/hardhat";
// Story engine
import { executeAction } from "./utils/actionEngine";
// Stories
import { allActions } from "./scenarios/allActions";
import { liquidityProvision } from "./scenarios/liquidityProvision";
import { coverProtection } from "./scenarios/coverProtection";
import { coverNegatives } from "./scenarios/coverNegatives";
import { liquidityNegatives } from "./scenarios/liquidityNegatives";
import { poolNegatives } from "./scenarios/poolNegatives";
import { claimingAndPayout } from "./scenarios/claimingAndPayout";
import { multiplePools } from "./scenarios/multiplePools";

const scenarios = [
  allActions,
  liquidityProvision,
  coverProtection,
  liquidityNegatives,
  // poolNegatives,
  // claimingAndPayout,
  // multiplePools,
];

let evmSnapshotId: string = "0x4200000";

export function ScenarioTests() {
  context("Scenario Tests", async function () {
    for (const scenario of scenarios) {
      describe(scenario.title, async function () {
        before(async function () {
          evmSnapshotId = await evmSnapshot();
        });

        for (const story of scenario.stories) {
          it(story.description, async function () {
            // Multiples actions can require a longer timeout
            this.timeout(60_000);
            // this.retries(2);

            for (const action of story.actions) {
              // Attach test environment to action execution
              await executeAction.call(this, action);
            }
          });
        }

        after(async function () {
          await evmRevert(evmSnapshotId);
        });
      });
    }
  });
}
