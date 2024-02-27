// Story engine
import { executeAction, Scenario } from "./utils/story-engine";
// Stories
import { coverStories } from "./stories/covers.story";

const scenarios = [coverStories];

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
