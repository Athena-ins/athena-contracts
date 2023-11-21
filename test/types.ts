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
import {
  ProtocolConfig,
  ProtocolContracts,
  TestHelper,
} from "./helpers/ProtocolHelper";

type ContextSigners = {
  deployer: Wallet;
  user: Wallet;
  user2: Wallet;
  user3: Wallet;
};

declare module "mocha" {
  export interface Context {
    signers: ContextSigners;
    contracts: ProtocolContracts;
    protocolConfig: ProtocolConfig;
    snapshortId: string; // Used to reset fork
    helpers: TestHelper;
  }
}
