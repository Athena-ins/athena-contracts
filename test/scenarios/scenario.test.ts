// Story engine
import { executeStory, Scenario } from "./utils/story-engine";
// Stories
import { coverStories } from "./stories/covers";

export async function ScenarioTests() {
  context("Scenario Tests", async function () {
    const scenario: Scenario = {
      title: "Athena Protocol Scenarios",
      stories: [coverStories],
    };

    for (const story of scenario.stories) {
      await executeStory(story);
    }
  });
}
