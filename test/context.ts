import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import { series } from "async";
import { exec } from "child_process";

/// This is run at the beginning of each suite of tests: 2e2, integration and unit.
export function baseContext(description: string, hooks: () => void): void {
  describe(description, function () {
    before(async function () {
      await series([() => exec("npx hardhat compile")]);

      const signers = await ethers.getSigners();
      // Override hardhat to have a Signer that can sign TX for flashbots
      this.signers = {
        deployer: signers[0] as Signer as Wallet,
        deployer2: signers[1] as Signer as Wallet,
        user: signers[2] as Signer as Wallet,
        user2: signers[3] as Signer as Wallet,
      };
    });

    hooks();
  });
}
