import { utils } from "ethers";
// Hardhat modules
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@solarity/hardhat-markup";
// Types
import { HardhatUserConfig } from "hardhat/config";
import { HardhatNetworkUserConfig } from "hardhat/types";
//
import dotenv from "dotenv";
import colors from "colors";
dotenv.config();
colors.enable();

const { parseEther, id } = utils;

const {
  // Network: Fork (target)
  HARDHAT_FORK_TARGET,
  // Network: Mainnet
  MAINNET_FORKING_BLOCK,
  MAINNET_RPC_URL,
  MAINNET_VERIFY_API_KEY,
  // Network: Arbitrum
  ARBITRUM_FORKING_BLOCK,
  ARBITRUM_RPC_URL,
  ARBITRUM_VERIFY_API_KEY,
  // Network: Sepolia
  SEPOLIA_FORKING_BLOCK,
  SEPOLIA_RPC_URL,
  SEPOLIA_VERIFY_API_KEY,
  // Network: Lisk Sepolia
  LISK_SEPOLIA_FORKING_BLOCK,
  LISK_SEPOLIA_RPC_URL,
  LISK_SEPOLIA_VERIFY_API_KEY,
  // Network: Core DAO
  CORE_DAO_FORKING_BLOCK,
  CORE_DAO_RPC_URL,
  CORE_DAO_VERIFY_API_KEY,
  // Network: Core DAO testnet
  CORE_DAO_TESTNET_FORKING_BLOCK,
  CORE_DAO_TESTNET_RPC_URL,
  CORE_DAO_TESTNET_VERIFY_API_KEY,
  // Gas reporter
  REPORT_GAS,
  ETHERUM_PRICE,
  ETHERUM_GAS_PRICE,
  // CMC API key
  COINMARKETCAP_API_KEY,
  // Accounts
  DEPLOYER_PK,
  EVIDENCE_GUARDIAN_PK,
  BUYBACK_PK,
  TREASURY_PK,
  RISK_GUARD_PK,
} = process.env;

// ====== NETWORK CHECKS ====== //

if (!HARDHAT_FORK_TARGET) {
  throw Error("Missing fork target");
}

if (!MAINNET_VERIFY_API_KEY || !MAINNET_FORKING_BLOCK || !MAINNET_RPC_URL) {
  throw Error("Incomplete mainnet configuration");
}
if (!ARBITRUM_VERIFY_API_KEY || !ARBITRUM_FORKING_BLOCK || !ARBITRUM_RPC_URL) {
  throw Error("Incomplete arbitrum configuration");
}
if (!SEPOLIA_VERIFY_API_KEY || !SEPOLIA_FORKING_BLOCK || !SEPOLIA_RPC_URL) {
  throw Error("Incomplete sepolia configuration");
}
if (
  !LISK_SEPOLIA_VERIFY_API_KEY ||
  !LISK_SEPOLIA_FORKING_BLOCK ||
  !LISK_SEPOLIA_RPC_URL
) {
  throw Error("Incomplete lisk sepolia configuration");
}
if (!CORE_DAO_VERIFY_API_KEY || !CORE_DAO_FORKING_BLOCK || !CORE_DAO_RPC_URL) {
  throw Error("Incomplete core dao configuration");
}
if (
  !CORE_DAO_TESTNET_VERIFY_API_KEY ||
  !CORE_DAO_TESTNET_FORKING_BLOCK ||
  !CORE_DAO_TESTNET_RPC_URL
) {
  throw Error("Incomplete core dao TESTNET configuration");
}

// ====== WALLET CHECKS ====== //

if (
  !DEPLOYER_PK ||
  !EVIDENCE_GUARDIAN_PK ||
  !BUYBACK_PK ||
  !TREASURY_PK ||
  !RISK_GUARD_PK
) {
  throw Error("Missing account PK");
}

// ====== MISC CHECKS ====== //

if (!ETHERUM_PRICE || !ETHERUM_GAS_PRICE || !REPORT_GAS) {
  throw Error("Missing gas report params");
}

// ====== CONFIG ====== //

// We force cast the type but check it's validity immediately after
const networkNames = [
  "mainnet",
  "arbitrum",
  "sepolia",
  "lisk_sepolia",
  "core_dao",
  "core_dao_testnet",
] as const;
export type NetworkName = (typeof networkNames)[number];
export type NetworksOrFork = NetworkName | "hardhat";

const forkTarget = HARDHAT_FORK_TARGET.toLowerCase() as NetworkName;
if (!HARDHAT_FORK_TARGET || !networkNames.includes(forkTarget)) {
  throw Error("Missing or erroneous fork target");
}

const networkConfigs: {
  [key in NetworkName]: {
    chainId: number;
    apiURL: string;
    browserURL: string;
    rpcUrl: string;
    forkingBlock: string;
    verifyApiKey: string;
  };
} = {
  mainnet: {
    chainId: 1,
    apiURL: "https://api.etherscan.io/api",
    browserURL: "https://etherscan.io",
    rpcUrl: MAINNET_RPC_URL,
    forkingBlock: MAINNET_FORKING_BLOCK,
    verifyApiKey: MAINNET_VERIFY_API_KEY,
  },
  arbitrum: {
    chainId: 42161,
    apiURL: "https://api.arbiscan.io/api",
    browserURL: "https://arbiscan.io",
    rpcUrl: ARBITRUM_RPC_URL,
    forkingBlock: ARBITRUM_FORKING_BLOCK,
    verifyApiKey: ARBITRUM_VERIFY_API_KEY,
  },
  sepolia: {
    chainId: 11155111,
    apiURL: "",
    browserURL: "",
    rpcUrl: SEPOLIA_RPC_URL,
    forkingBlock: SEPOLIA_FORKING_BLOCK,
    verifyApiKey: SEPOLIA_VERIFY_API_KEY,
  },
  lisk_sepolia: {
    chainId: 4202,
    apiURL: "https://sepolia-blockscout.lisk.com/api",
    browserURL: "https://sepolia-blockscout.lisk.com",
    rpcUrl: LISK_SEPOLIA_RPC_URL,
    forkingBlock: LISK_SEPOLIA_FORKING_BLOCK,
    verifyApiKey: LISK_SEPOLIA_VERIFY_API_KEY,
  },
  core_dao: {
    chainId: 1116,
    apiURL: "https://scan.coredao.org/api",
    browserURL: "https://scan.coredao.org",
    rpcUrl: CORE_DAO_RPC_URL,
    forkingBlock: CORE_DAO_FORKING_BLOCK,
    verifyApiKey: CORE_DAO_VERIFY_API_KEY,
  },
  core_dao_testnet: {
    chainId: 1115,
    apiURL: "https://scan.test.btcs.network/api",
    browserURL: "https://scan.test.btcs.network/",
    rpcUrl: CORE_DAO_TESTNET_RPC_URL,
    forkingBlock: CORE_DAO_TESTNET_FORKING_BLOCK,
    verifyApiKey: CORE_DAO_TESTNET_VERIFY_API_KEY,
  },
};

const accounts = [
  DEPLOYER_PK,
  EVIDENCE_GUARDIAN_PK,
  BUYBACK_PK,
  TREASURY_PK,
  RISK_GUARD_PK,
];

function makeForkConfig(): HardhatNetworkUserConfig {
  const config = networkConfigs[forkTarget];

  if (!config) throw Error("Missing network config");

  const { chainId, rpcUrl, forkingBlock } = config;

  const networkConfig = {
    chainId,
    allowUnlimitedContractSize: true,
    forking: {
      url: rpcUrl,
      blockNumber: forkingBlock === "latest" ? undefined : Number(forkingBlock),
    },
    mining: {
      auto: true,
      mempool: {
        order: "fifo",
      },
    },
    accounts: [
      ...accounts.map((privateKey) => ({
        privateKey: privateKey,
        balance: parseEther("100000").toString(),
      })),
      // Add 20 test users
      ...Array(20)
        .fill("")
        .map((_, i) => ({
          privateKey: id(`Test User ${i}`),
          balance: parseEther("100000").toString(),
        })),
    ],
  };

  return networkConfig;
}

type MarkupConfig = {
  outdir: string;
  onlyFiles: string[];
  skipFiles: string[];
  noCompile: boolean;
  verbose: boolean;
};

let evmVersion: string | undefined = undefined;
if (forkTarget === "core_dao") {
  /// @dev enable for Core chain
  evmVersion = "paris";
  console.log("=> Overriding EVM version with:".magenta, evmVersion, "\n");
}

const config: HardhatUserConfig & {
  markup: MarkupConfig;
} = {
  // ====== Solidity Compilers ====== //
  solidity: {
    compilers: [
      {
        version: "0.8.25",
        settings: {
          evmVersion,
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
      {
        version: "0.4.17",
        settings: {
          evmVersion,
        },
      },
    ],
  },

  // ====== Networks ====== //

  networks: {
    hardhat: makeForkConfig(),
    mainnet: {
      url: networkConfigs.mainnet.rpcUrl,
      accounts,
    },
    arbitrum: {
      url: networkConfigs.arbitrum.rpcUrl,
      accounts,
    },
    sepolia: {
      url: networkConfigs.sepolia.rpcUrl,
      accounts,
    },
    lisk_sepolia: {
      url: networkConfigs.lisk_sepolia.rpcUrl,
      accounts,
    },
    core_dao: {
      url: networkConfigs.core_dao.rpcUrl,
      accounts,
    },
  },

  // ====== Gas Reporter ====== //

  gasReporter: {
    enabled: REPORT_GAS === "true",
    currency: "USD",
    token: "USDC", // Use USDT to hack our way to a fixed ETH price
    coinmarketcap: COINMARKETCAP_API_KEY || "",

    // @dev Switch between fixed and dynamic gas & ETH price

    //=== Fixed ===//
    // gasPrice: Number(ETHERUM_PRICE) * Number(ETHERUM_GAS_PRICE),

    //=== Dynamic ===//
    // gasPriceApi:
    //   "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
  },

  // ====== Etherscan ====== //

  etherscan: {
    apiKey: {
      // @dev Keys should match network provided by "npx hardhat verify --list-networks"
      mainnet: networkConfigs.mainnet.verifyApiKey,
      arbitrum: networkConfigs.arbitrum.verifyApiKey,
      sepolia: networkConfigs.sepolia.verifyApiKey,
      lisk_sepolia: networkConfigs.lisk_sepolia.verifyApiKey,
      core_dao: networkConfigs.core_dao.verifyApiKey,
    },
    // @dev Since we use the term "arbitrum" instead of "arbitrumOne" we need to add a custom chain
    customChains: Object.entries(networkConfigs).map(([name, config]) => ({
      network: name,
      chainId: config.chainId,
      urls: {
        apiURL: config.apiURL,
        browserURL: config.browserURL,
      },
    })),
  },

  // ====== Typechain ====== //

  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },

  // ====== Typechain ====== //

  markup: {
    outdir: "./markups",
    onlyFiles: [
      "./src/managers",
      "./src/misc",
      "./src/tokens",
      "./src/interfaces",
    ],
    skipFiles: [],
    noCompile: false,
    verbose: true,
  },

  // ====== Paths ====== //

  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // ====== Mocha ====== //

  mocha: {
    // parallel: true,
    timeout: 30_000,
  },
};

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
export default config;
