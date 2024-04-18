import { Suite, AsyncFunc } from "mocha";

export function afterEachSuite(fn: AsyncFunc) {
  before(function () {
    let suites: Suite[] = this.test?.parent?.suites || [];
    suites.forEach((suite) => suite.afterAll(fn));
  });
}
