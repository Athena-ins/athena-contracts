import { ProtocolConfig, ProtocolContracts } from "./helpers/deployers";
import { TestHelper } from "./helpers/protocol";
// Types
import { Wallet } from "ethers";

type ContextSigners = {
  deployer: Wallet;
  evidenceGuardian: Wallet;
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
