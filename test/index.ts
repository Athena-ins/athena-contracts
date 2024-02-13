import { baseContext } from "./context";

// Integration test suites
import { deployProtocol } from "./integration/deployProtocol.test";
import { SanityTest } from "./integration/sanity.test";

// Unit test suites
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
  // Integration tests
  // deployProtocol();
  SanityTest();

  // Unit tests
  // AthenaERC721Tests();
  // AthenaTokenTests();
  // ClaimManagerTests();
  // EcclesiaDaoTests();
  // FarmingRangeTests();
  // LiquidityManagerTests();
  // RewardManagerTests();
  // StakingTests();
  // StrategyManagerTests();
  // VirtualPoolTests();

  // Integration tests
  // deployProtocol();
  liquidityManager();
});
