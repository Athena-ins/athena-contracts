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
import { CoreStrategyTest } from "./integration/coreStrategies.test";
import { AmphorStrategiesTest } from "./integration/amphorStrategies.test";
import { EthereumStrategyTest } from "./integration/morphoMevStrategy.test";
import { MorphoStrategyUpgradeTest } from "./integration/morphoMevStrategyUpgrade.test";

// Scenarios
import { ScenarioTests } from "./scenarios/scenario.test";

// Unit test suites
import { WrappedTokenGatewayTest } from "./unit/WrappedTokenGateway.test";
import { PoolManagerTest } from "./unit/PoolManager.test";

baseContext("Test Athena Protocol", function () {
  //=== Integration tests ===//
  DeployProtocolTest();
  SanityTest();
  KlerosArbitrationTest();
  // strategies
  CoreStrategyTest();
  AmphorStrategiesTest();
  EthereumStrategyTest();
  MorphoStrategyUpgradeTest();
  //
  //=== Scenarios ===//
  ScenarioTests();
  //
  //=== Unit tests ===//
  PoolManagerTest();
  WrappedTokenGatewayTest();
});
