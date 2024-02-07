import { VirtualPool_totalLiquidity } from "./totalLiquidity.test";
import { VirtualPool_availableLiquidity } from "./availableLiquidity.test";
import { VirtualPool__depositToPool } from "./_depositToPool.test";
import { VirtualPool__payRewardsAndFees } from "./_payRewardsAndFees.test";
import { VirtualPool__takePoolInterests } from "./_takePoolInterests.test";
import { VirtualPool__withdrawLiquidity } from "./_withdrawLiquidity.test";
import { VirtualPool__addPremiumPosition } from "./_addPremiumPosition.test";
import { VirtualPool__openCover } from "./_openCover.test";
import { VirtualPool__closeCover } from "./_closeCover.test";
import { VirtualPool__removeTick } from "./_removeTick.test";
import { VirtualPool__syncLiquidity } from "./_syncLiquidity.test";
import { VirtualPool__purgeExpiredCovers } from "./_purgeExpiredCovers.test";
import { VirtualPool__coverInfo } from "./_coverInfo.test";
import { VirtualPool__crossingInitializedTick } from "./_crossingInitializedTick.test";
import { VirtualPool__refresh } from "./_refresh.test";
import { VirtualPool__getUpdatedPositionInfo } from "./_getUpdatedPositionInfo.test";
import { VirtualPool_getPremiumRate } from "./getPremiumRate.test";
import { VirtualPool_getDailyCost } from "./getDailyCost.test";
import { VirtualPool_secondsPerTick } from "./secondsPerTick.test";
import { VirtualPool_currentPremiumRate } from "./currentPremiumRate.test";
import { VirtualPool_updatedPremiumRate } from "./updatedPremiumRate.test";
import { VirtualPool__utilization } from "./_utilization.test";

export function VirtualPoolTests() {
  VirtualPool_totalLiquidity();
  VirtualPool_availableLiquidity();
  VirtualPool__depositToPool();
  VirtualPool__payRewardsAndFees();
  VirtualPool__takePoolInterests();
  VirtualPool__withdrawLiquidity();
  VirtualPool__addPremiumPosition();
  VirtualPool__openCover();
  VirtualPool__closeCover();
  VirtualPool__removeTick();
  VirtualPool__syncLiquidity();
  VirtualPool__purgeExpiredCovers();
  VirtualPool__coverInfo();
  VirtualPool__crossingInitializedTick();
  VirtualPool__refresh();
  VirtualPool__getUpdatedPositionInfo();
  VirtualPool_getPremiumRate();
  VirtualPool_getDailyCost();
  VirtualPool_secondsPerTick();
  VirtualPool_currentPremiumRate();
  VirtualPool_updatedPremiumRate();
  VirtualPool__utilization();
}
