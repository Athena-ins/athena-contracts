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
            this.retries(2);
            for (const action of story.actions) {
              await executeAction.call(this, action);
            }
          });
        }
      });
    }
  });
}
