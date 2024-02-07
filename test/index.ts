import { baseContext } from "./context";

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

// Integration test suites
import { deployProtocol } from "./scenarios/deployProtocol.test";
import { liquidityManager } from "./scenarios/liquidityManager.test";

baseContext("Test Athena Protocol", function () {
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
