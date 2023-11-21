import { Wallet } from "ethers";
import {
  ATEN,
  CentralizedArbitrator,
  Athena,
  ProtocolFactory,
  PriceOracleV1,
  TokenVault,
  PositionsManager,
  PolicyManager,
  ClaimManager,
  StakingGeneralPool,
  StakingPolicy,
} from "../typechain";
import { ProtocolConfig } from "./helpers/ProtocolHelper";

interface ContextSigners {
  deployer: Wallet;
  user: Wallet;
  user2: Wallet;
  user3: Wallet;
}

interface ContextContracts {
  ATEN: ATEN;
  CentralizedArbitrator: CentralizedArbitrator;
  Athena: Athena;
  ProtocolFactory: ProtocolFactory;
  PriceOracleV1: PriceOracleV1;
  TokenVault: TokenVault;
  PositionsManager: PositionsManager;
  PolicyManager: PolicyManager;
  ClaimManager: ClaimManager;
  StakingGeneralPool: StakingGeneralPool;
  StakingPolicy: StakingPolicy;
}

declare module "mocha" {
  export interface Context {
    signers: ContextSigners;
    contracts: ContextContracts;
    protocolConfig: ProtocolConfig;
  }
}
