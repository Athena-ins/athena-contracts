import { baseContext } from "./context";
// Test suites
import { deployProtocolTest } from "./contracts/deployProtocol.test";

baseContext("Test Athena Protocol", function () {
  // Unit tests
  deployProtocolTest();
});
