import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import { series } from "async";
import { exec } from "child_process";
// Context setup
import {
  deployAllContractsAndInitializeProtocol,
  defaultProtocolConfig,
} from "./helpers/ProtocolHelper";

// This is run at the beginning of each test suite
export function baseContext(description: string, hooks: () => void): void {
  describe(description, function () {
    before(async function () {
      await series([() => exec("npx hardhat compile")]);

      // Provides signers for testing
      const signers = await ethers.getSigners();
      const deployer = signers[0] as Signer as Wallet;
      this.signers = {
        deployer,
        user: signers[1] as Signer as Wallet,
        user2: signers[2] as Signer as Wallet,
        user3: signers[3] as Signer as Wallet,
      };

      // Setup protocol for testing & provide interfaces to tests
      this.contracts = await deployAllContractsAndInitializeProtocol(
        deployer,
        defaultProtocolConfig,
      );

      this.protocolConfig = defaultProtocolConfig;
    });

    hooks();
  });
}
