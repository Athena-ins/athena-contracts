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
import { GnosisSafeWalletTest } from "./integration/gnosisSafeWallet.test";
import { EthereumStrategyTest } from "./integration/strategiesEthereum.test";
import { StrategyManagerProxyTest } from "./integration/strategyManagerProxyTest.test";

// Scenarios
import { ScenarioTests } from "./scenarios/scenario.test";

// Unit test suites
import { WrappedTokenGatewayTest } from "./unit/WrappedTokenGateway.test";
import { PoolManagerTest } from "./unit/PoolManager.test";
import { ProtocolManagerTest } from "./unit/ProtocolManager.test";
import { ClaimManagerTest } from "./unit/ClaimManager.test";

baseContext("Test Athena Protocol", function () {
  //=== Integration tests ===//
  DeployProtocolTest();
  SanityTest();
  KlerosArbitrationTest();
  GnosisSafeWalletTest();
  EthereumStrategyTest();
  StrategyManagerProxyTest();

  //=== Unit tests ===//
  PoolManagerTest();
  ProtocolManagerTest();
  WrappedTokenGatewayTest();
  ClaimManagerTest();

  //=== Scenarios ===//
  ScenarioTests();
});
