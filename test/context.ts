import { ethers } from "hardhat";
// Functions
import {
  evmSnapshot,
  evmRevert,
  entityProviderChainId,
  deployerWallet,
  evidenceGuardianWallet,
  buybackWallet,
  treasuryWallet,
  leverageRiskWallet,
  fromFork,
} from "./helpers/hardhat";
import {
  deployAllContractsAndInitializeProtocol,
  ProtocolConfig,
  ProtocolContracts,
} from "./helpers/deployers";
import { deployAllContractsAndInitializeProtocolV0 } from "../test/helpers/deployersV0";
import {
  deployAllContractsAndInitializeProtocolMorpho,
  MorphoProtocolContracts,
} from "../test/helpers/deployersMorpho";
import {
  deployAllContractsAndInitializeProtocolVL,
  VLProtocolContracts,
} from "../test/helpers/deployersVL";
import {
  deployAllContractsAndInitializeProtocolCore,
  CoreProtocolContracts,
} from "../test/helpers/deployersCore";
import { getDefaultProtocolConfig } from "../scripts/verificationData/deployParams";
import { makeTestHelpers, TestHelper } from "./helpers/protocol";
// Chai hooks
import { beforeEachSuite } from "./helpers/chai/beforeEachSuite";
import { afterEachSuite } from "./helpers/chai/afterEachSuite";
// Types
import { Signer, Wallet } from "ethers";

import { LiquidityManager__factory } from "../typechain";

type ContextSigners = {
  deployer: Wallet;
  evidenceGuardian: Wallet;
  buybackWallet: Wallet;
  treasuryWallet: Wallet;
  leverageRiskWallet: Wallet;
  user: Wallet;
  user0: Wallet;
  user1: Wallet;
  user2: Wallet;
  user3: Wallet;
  user4: Wallet;
};

export type SignerName = keyof ContextSigners;

export type TestEnv = {
  signers: ContextSigners;
  contracts: ProtocolContracts;
  protocolConfig: ProtocolConfig;
  helpers: TestHelper;
};

declare module "mocha" {
  export interface Context {
    chainId: number;
    signers: ContextSigners;
    contracts: ProtocolContracts;
    protocolConfig: ProtocolConfig;
    snapshortId: string; // Used to reset fork
    helpers: TestHelper;
    args: any; // Used to set arguments within a test suite
    customEnv: any; // Used to set custom environment within a test suite
  }
}

async function getProtocolContractsAndConfig(
  deployer: Wallet,
  chainId?: number,
): Promise<{
  contracts:
    | ProtocolContracts
    | MorphoProtocolContracts
    | VLProtocolContracts
    | CoreProtocolContracts;
  protocolConfig: ProtocolConfig;
}> {
  console.log("Using contract for chain".magenta, chainId || "default", "\n");

  // arbitrum
  if (chainId === 42161) {
    const protocolConfig = getDefaultProtocolConfig();
    const contracts = await deployAllContractsAndInitializeProtocolV0(
      deployer,
      protocolConfig,
    );
    return { contracts, protocolConfig };
  }

  // ethereum
  if (chainId === 1) {
    const protocolConfig = getDefaultProtocolConfig("mainnet");
    const contracts = await deployAllContractsAndInitializeProtocolMorpho(
      deployer,
      protocolConfig,
    );
    return { contracts, protocolConfig };
  }

  // lisk
  if (chainId === 4202) {
    const protocolConfig = getDefaultProtocolConfig("lisk");
    const contracts = await deployAllContractsAndInitializeProtocolVL(
      deployer,
      protocolConfig,
    );
    return { contracts, protocolConfig };
  }

  // core
  if (chainId === 1116) {
    const protocolConfig = getDefaultProtocolConfig("core_dao");
    const contracts = await deployAllContractsAndInitializeProtocolCore(
      deployer,
      protocolConfig,
    );
    return { contracts, protocolConfig };
  }

  const protocolConfig = getDefaultProtocolConfig();
  const contracts = await deployAllContractsAndInitializeProtocol(
    deployer,
    protocolConfig,
  );
  return { contracts, protocolConfig };
}

// Keep snapshot ID as global variables to avoid state conflicts in children tests
let evmSnapshotId: string = "0x1";

// This is run at the beginning of each test suite
export function baseContext(description: string, hooks: () => void): void {
  describe(description, function () {
    before(async function () {
      try {
        console.log(
          `\n== TESTING ON ${fromFork()?.toUpperCase()} ==\n`.magenta,
        );

        const liqManagerSize = LiquidityManager__factory.bytecode.length / 2;
        console.log(`\nLiq. Manager size: ${liqManagerSize}/24576\n`);

        const signers = await ethers.getSigners();

        console.log(
          "\nNamed Accounts:".magenta,
          JSON.stringify(
            {
              deployer: signers[0].address.slice(0, 8),
              evidenceGuardian: signers[1].address.slice(0, 8),
              buybackWallet: signers[2].address.slice(0, 8),
              treasuryWallet: signers[3].address.slice(0, 8),
              leverageRiskWallet: signers[4].address.slice(0, 8),
            },
            null,
            2,
          ),
          "\n",
        );

        this.chainId = await entityProviderChainId(signers[0]);

        const specialSigners = {
          deployer: deployerWallet(),
          evidenceGuardian: evidenceGuardianWallet(),
          buybackWallet: buybackWallet(),
          treasuryWallet: treasuryWallet(),
          leverageRiskWallet: leverageRiskWallet(),
        };

        const nbSpecialAccounts = Object.keys(specialSigners).length;

        // Provides signers for testing
        this.signers = {
          ...specialSigners,
          //
          user: signers[nbSpecialAccounts] as Signer as Wallet,
          user0: signers[nbSpecialAccounts] as Signer as Wallet,
          user1: signers[nbSpecialAccounts + 1] as Signer as Wallet,
          user2: signers[nbSpecialAccounts + 2] as Signer as Wallet,
          user3: signers[nbSpecialAccounts + 3] as Signer as Wallet,
          user4: signers[nbSpecialAccounts + 4] as Signer as Wallet,
        };

        // Setup protocol for testing & provide interfaces to tests
        const { contracts, protocolConfig } =
          await getProtocolContractsAndConfig(
            this.signers.deployer,
            this.chainId,
          );
        this.contracts = contracts;
        this.protocolConfig = protocolConfig;

        if (
          this.signers.evidenceGuardian.address !=
          evidenceGuardianWallet().address
        )
          throw Error("Evidence guardian address mismatch");

        // Get WETH for all accounts
        for (const signer of Object.values(this.signers)) {
          await this.contracts.WethToken.connect(signer)
            .deposit({
              value: ethers.utils.parseEther("1000"),
            })
            .then((tx) => tx.wait());
        }

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

        // console.log(
        //   `\n=> Test context setup:\n${JSON.stringify(logData, null, 2)}\n`,
        // );
      } catch (err: any) {
        console.error(err);
        throw Error("Test context creation failed");
      }
    });

    // Used to restore fork at this point in time
    beforeEachSuite(async function (this: Mocha.Context) {
      // Roll over snapshortId since snapshot ID reuse if forbidden
      evmSnapshotId = await evmSnapshot();
    });

    afterEachSuite(async function (this: Mocha.Context) {
      await evmRevert(evmSnapshotId);
    });

    hooks();
  });
}
