import { ethers } from "hardhat";
import chai from "chai";
// Functions
import {
  makeForkSnapshot,
  restoreForkSnapshot,
  entityProviderChainId,
} from "./helpers/hardhat";
import {
  deployAllContractsAndInitializeProtocol,
  defaultProtocolConfig,
} from "./helpers/deployers";
import { makeTestHelpers, evidenceGuardianWallet } from "./helpers/protocol";
// Types
import { Signer, Wallet } from "ethers";
import { Suite, AsyncFunc } from "mocha";
import { LiquidityManager__factory } from "../typechain";
// Assertions
import { almostEqual } from "./helpers/utils/almost-equal";

chai.use(almostEqual);

// Custom hook to run a function before each child test suite
function beforeEachSuite(fn: AsyncFunc) {
  before(function () {
    let suites: Suite[] = this.test?.parent?.suites || [];
    suites.forEach((suite) => suite.beforeAll(fn));
  });
}

// This is run at the beginning of each test suite
export function baseContext(description: string, hooks: () => void): void {
  describe(description, function () {
    before(async function () {
      const liqManagerSize = LiquidityManager__factory.bytecode.length / 2;
      console.log(`\nLiq. Manager size: ${liqManagerSize}/24576\n`);

      // Provides signers for testing
      const nbSpecialAccounts = 5;
      const signers = await ethers.getSigners();
      this.signers = {
        deployer: signers[0] as Signer as Wallet,
        evidenceGuardian: signers[1] as Signer as Wallet,
        buybackWallet: signers[2] as Signer as Wallet,
        treasuryWallet: signers[3] as Signer as Wallet,
        leverageRiskWallet: signers[4] as Signer as Wallet,
        //
        user: signers[nbSpecialAccounts] as Signer as Wallet,
        user2: signers[nbSpecialAccounts + 1] as Signer as Wallet,
        user3: signers[nbSpecialAccounts + 2] as Signer as Wallet,
      };

      this.protocolConfig = defaultProtocolConfig;

      // Setup protocol for testing & provide interfaces to tests
      this.contracts = await deployAllContractsAndInitializeProtocol(
        this.signers.deployer,
        defaultProtocolConfig,
        // true,
      );

      if (
        this.signers.evidenceGuardian.address !=
        evidenceGuardianWallet().address
      )
        throw Error("Evidence guardian address mismatch");

      // Get WETH for all accounts
      await Promise.all(
        Object.values(this.signers).map((signer) =>
          this.contracts.WethToken.connect(signer)
            .deposit({
              value: ethers.utils.parseEther("1000"),
            })
            .then((tx) => tx.wait()),
        ),
      );

      const logData = {
        chainId: await entityProviderChainId(this.signers.deployer),
        deployer: this.signers.deployer.address,
        evidenceGuardian: this.signers.evidenceGuardian.address,
        buybackWallet: this.signers.buybackWallet.address,
        user: this.signers.user.address,
        user2: this.signers.user2.address,
        user3: this.signers.user3.address,
        // protocolConfig: this.protocolConfig,
        // contracts: Object.keys(this.contracts),
      };

      // Make instance of helpers connected to contracts
      this.helpers = await makeTestHelpers(
        this.signers.deployer,
        this.contracts,
      );

      // Used to restore fork at this point in the test suites
      this.snapshortId = await makeForkSnapshot();

      // console.log(
      //   `\n=> Test context setup:\n${JSON.stringify(logData, null, 2)}\n`,
      // );
    });

    // This is run before each child test suite
    beforeEachSuite(async function () {
      // Roll over snapshortId since snapshot ID reuse if forbidden
      await restoreForkSnapshot(this.snapshortId);
      this.snapshortId = await makeForkSnapshot();
    });

    hooks();
  });
}
