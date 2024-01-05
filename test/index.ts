import { baseContext } from "./context";
// Test suites
import { deployProtocol } from "./contracts/deployProtocol.test";
import { liquidityManager } from "./contracts/liquidityManager.test";

baseContext("Test Athena Protocol", function () {
  // Unit tests
  deployProtocol();
  liquidityManager();
});
