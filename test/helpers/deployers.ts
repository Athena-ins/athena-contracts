import { ContractTransaction, Signer } from "ethers";
// typechain
import {
  USDT__factory,
  ATEN__factory,
  Athena__factory,
  TokenVault__factory,
  StakingGeneralPool__factory,
  StakingPolicy__factory,
  PositionsManager__factory,
  PolicyManager__factory,
  ClaimManager__factory,
  CentralizedArbitrator__factory,
  ProtocolFactory__factory,
  PriceOracleV1__factory,
  //
  USDT,
  ATEN,
  Athena,
  TokenVault,
  StakingGeneralPool,
  StakingPolicy,
  PositionsManager,
  PolicyManager,
  ClaimManager,
  CentralizedArbitrator,
  ProtocolFactory,
  PriceOracleV1,
} from "../../typechain/";

// ================================= //
// === Deploy contract functions === //
// ================================= //

export async function deployUSDT(
  owner: Signer,
  args: Parameters<USDT__factory["deploy"]>,
): Promise<USDT> {
  return new USDT__factory(owner).deploy(...args);
}

export async function deployATEN(
  owner: Signer,
  args: Parameters<ATEN__factory["deploy"]>,
): Promise<ATEN> {
  return new ATEN__factory(owner).deploy(...args);
}

export async function deployAthena(
  owner: Signer,
  args: Parameters<Athena__factory["deploy"]>,
): Promise<Athena> {
  return new Athena__factory(owner).deploy(...args);
}

export async function deployTokenVault(
  owner: Signer,
  args: Parameters<TokenVault__factory["deploy"]>,
): Promise<TokenVault> {
  return new TokenVault__factory(owner).deploy(...args);
}

export async function deployStakingGeneralPool(
  owner: Signer,
  args: Parameters<StakingGeneralPool__factory["deploy"]>,
): Promise<StakingGeneralPool> {
  return new StakingGeneralPool__factory(owner).deploy(...args);
}

export async function deployStakingPolicy(
  owner: Signer,
  args: Parameters<StakingPolicy__factory["deploy"]>,
): Promise<StakingPolicy> {
  return new StakingPolicy__factory(owner).deploy(...args);
}

export async function deployPositionsManager(
  owner: Signer,
  args: Parameters<PositionsManager__factory["deploy"]>,
): Promise<PositionsManager> {
  return new PositionsManager__factory(owner).deploy(...args);
}

export async function deployPolicyManager(
  owner: Signer,
  args: Parameters<PolicyManager__factory["deploy"]>,
): Promise<PolicyManager> {
  return new PolicyManager__factory(owner).deploy(...args);
}

export async function deployClaimManager(
  owner: Signer,
  args: Parameters<ClaimManager__factory["deploy"]>,
): Promise<ClaimManager> {
  return new ClaimManager__factory(owner).deploy(...args);
}

export async function deployCentralizedArbitrator(
  owner: Signer,
  args: Parameters<CentralizedArbitrator__factory["deploy"]>,
): Promise<CentralizedArbitrator> {
  return new CentralizedArbitrator__factory(owner).deploy(...args);
}

export async function deployProtocolFactory(
  owner: Signer,
  args: Parameters<ProtocolFactory__factory["deploy"]>,
): Promise<ProtocolFactory> {
  return new ProtocolFactory__factory(owner).deploy(...args);
}

export async function deployPriceOracleV1(
  owner: Signer,
  args: Parameters<PriceOracleV1__factory["deploy"]>,
): Promise<PriceOracleV1> {
  return new PriceOracleV1__factory(owner).deploy(...args);
}
