// Custom assertions
import "./helpers/chai/almostEqual";
import "./helpers/chai/revertTransactionWith";
// BigInt fix
import "./helpers/utils/bigIntString";

import { baseContext } from "./context";

// Integration test suites
import { DeployProtocolTest } from "./integration/deployProtocol.test";
import { SanityTest } from "./integration/sanity.test";
import { WrappedTokenGatewayTest } from "./integration/wrappedGateway.test";
import { CoreStrategyTest } from "./integration/coreStrategies.test";
import { AmphorStrategiesTest } from "./integration/amphorStrategies.test";
import { EthereumStrategyTest } from "./integration/morphoMevStrategy.test";
import { MorphoStrategyUpgradeTest } from "./integration/morphoMevStrategyUpgrade.test";

// Scenarios
import { ScenarioTests } from "./scenarios/scenario.test";

// Unit test suites
import { PoolManagerTest } from "./contracts/PoolManager.test";
//
import { AthenaERC721Tests } from "./contracts/AthenaERC721";
import { AthenaTokenTests } from "./contracts/AthenaToken";
import { ClaimManagerTests } from "./contracts/ClaimManager";
import { EcclesiaDaoTests } from "./contracts/EcclesiaDao";
import { FarmingRangeTests } from "./contracts/FarmingRange";
import { LiquidityManagerTests } from "./contracts/LiquidityManager";
import { RewardManagerTests } from "./contracts/RewardManager";
import { StakingTests } from "./contracts/Staking";
import { StrategyManagerTests } from "./contracts/StrategyManager";
import { VirtualPoolTests } from "./contracts/VirtualPool";

baseContext("Test Athena Protocol", function () {
  //=== Integration tests ===//
  DeployProtocolTest();
  SanityTest();
  WrappedTokenGatewayTest();
  //
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
  //
  // FarmingRangeTests();
  // LiquidityManagerTests();
  // ClaimManagerTests();
  // EcclesiaDaoTests();
  // RewardManagerTests();
  // StakingTests();
  // StrategyManagerTests();
});
