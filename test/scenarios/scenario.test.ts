// Story engine
import { executeAction } from "./utils/actionEngine";
// Stories
import { coverOpenAndUpdate } from "./scenarios/covers.scenario";

const scenarios = [coverOpenAndUpdate];

export async function ScenarioTests() {
  context("Scenario Tests", async function () {
    for (const scenario of scenarios) {
      describe(scenario.title, async function () {
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
      });
    }
  });
}
