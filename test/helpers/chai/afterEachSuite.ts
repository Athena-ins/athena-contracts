import { Suite, AsyncFunc } from "mocha";

export function afterEachSuite(fn: AsyncFunc) {
  after(function () {
    let suites: Suite[] = this.test?.parent?.suites || [];
    suites.forEach((suite) => suite.afterAll(fn));
  });
}
