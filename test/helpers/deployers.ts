import { ContractTransaction, Signer } from "ethers";
// typechain
import {
  // Dao
  EcclesiaDao__factory,
  EcclesiaDao,
  // Claims
  MockArbitrator__factory,
  MockArbitrator,
  // Managers
  ClaimManager__factory,
  ClaimManager,
  LiquidityManager__factory,
  LiquidityManager,
  StrategyManager__factory,
  StrategyManager,
  // Rewards
  FarmingRange__factory,
  FarmingRange,
  RewardManager__factory,
  RewardManager,
  Staking__factory,
  Staking,
  // Tokens
  AthenaCoverToken__factory,
  AthenaCoverToken,
  AthenaPositionToken__factory,
  AthenaPositionToken,
  AthenaToken__factory,
  AthenaToken,
} from "../../typechain/";

// ================================= //
// === Deploy contract functions === //
// ================================= //

export async function deployMockArbitrator(
  signer: Signer,
  args: Parameters<MockArbitrator__factory["deploy"]>,
): Promise<MockArbitrator> {
  return new MockArbitrator__factory(signer).deploy(...args);
}

export async function deployEcclesiaDao(
  signer: Signer,
  args: Parameters<EcclesiaDao__factory["deploy"]>,
): Promise<EcclesiaDao> {
  return new EcclesiaDao__factory(signer).deploy(...args);
}

export async function deployClaimManager(
  signer: Signer,
  args: Parameters<ClaimManager__factory["deploy"]>,
): Promise<ClaimManager> {
  return new ClaimManager__factory(signer).deploy(...args);
}

export async function deployLiquidityManager(
  signer: Signer,
  args: Parameters<LiquidityManager__factory["deploy"]>,
): Promise<LiquidityManager> {
  return new LiquidityManager__factory(signer).deploy(...args);
}

export async function deployStrategyManager(
  signer: Signer,
  args: Parameters<StrategyManager__factory["deploy"]>,
): Promise<StrategyManager> {
  return new StrategyManager__factory(signer).deploy(...args);
}

export async function deployFarmingRange(
  signer: Signer,
  args: Parameters<FarmingRange__factory["deploy"]>,
): Promise<FarmingRange> {
  return new FarmingRange__factory(signer).deploy(...args);
}

export async function deployRewardManager(
  signer: Signer,
  args: Parameters<RewardManager__factory["deploy"]>,
): Promise<RewardManager> {
  return new RewardManager__factory(signer).deploy(...args);
}

export async function deployStaking(
  signer: Signer,
  args: Parameters<Staking__factory["deploy"]>,
): Promise<Staking> {
  return new Staking__factory(signer).deploy(...args);
}

export async function deployAthenaCoverToken(
  signer: Signer,
  args: Parameters<AthenaCoverToken__factory["deploy"]>,
): Promise<AthenaCoverToken> {
  return new AthenaCoverToken__factory(signer).deploy(...args);
}

export async function deployAthenaPositionToken(
  signer: Signer,
  args: Parameters<AthenaPositionToken__factory["deploy"]>,
): Promise<AthenaPositionToken> {
  return new AthenaPositionToken__factory(signer).deploy(...args);
}

export async function deployAthenaToken(
  signer: Signer,
  args: Parameters<AthenaToken__factory["deploy"]>,
): Promise<AthenaToken> {
  return new AthenaToken__factory(signer).deploy(...args);
}
