import { Wallet } from "ethers";

declare module "mocha" {
  export interface Context {
    signers: Signers;
  }
}

export interface Signers {
  deployer: Wallet;
  deployer2: Wallet;
  user: Wallet;
  user2: Wallet;
}
