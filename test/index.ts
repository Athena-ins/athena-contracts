// Custom assertions
import "./helpers/chai/almostEqual";
import "./helpers/chai/revertTransactionWith";
// BigInt fix
import "./helpers/utils/bigIntString";

import { baseContext } from "./context";

// Integration test suites
import { DeployProtocolTest } from "./integration/deployProtocol.test";
import { SanityTest } from "./integration/sanity.test";
import { KlerosArbitrationTest } from "./integration/klerosArbitration.test";
import { EthereumStrategyTest } from "./integration/morphoMevStrategy.test";
import { MorphoStrategyUpgradeTest } from "./integration/morphoMevStrategyUpgrade.test";
import { CoreStrategyTest } from "./integration/coreStrategies.test";
import { AmphorStrategiesTest } from "./integration/amphorStrategies.test";

// Scenarios
import { ScenarioTests } from "./scenarios/scenario.test";

// Unit test suites
import { WrappedTokenGatewayTest } from "./unit/WrappedTokenGateway.test";
import { PoolManagerTest } from "./unit/PoolManager.test";
import { ClaimManagerTest } from "./unit/ClaimManager.test";

baseContext("Test Athena Protocol", function () {
  //=== Integration tests ===//
  DeployProtocolTest();
  SanityTest();
  KlerosArbitrationTest();
  EthereumStrategyTest();
  MorphoStrategyUpgradeTest();
  // CoreStrategyTest();
  // AmphorStrategiesTest();
  //
  //=== Scenarios ===//
  ScenarioTests();
  //
  //=== Unit tests ===//
  PoolManagerTest();
  WrappedTokenGatewayTest();
  ClaimManagerTest();
});
