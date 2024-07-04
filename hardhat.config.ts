import { utils } from "ethers";
// Hardhat modules
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
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

if (!MAINNET_RPC_URL || !ARBITRUM_RPC_URL || !SEPOLIA_RPC_URL) {
  throw Error("Missing RPC URL");
}
if (
  !DEPLOYER_PK ||
  !EVIDENCE_GUARDIAN_PK ||
  !BUYBACK_PK ||
  !TREASURY_PK ||
  !RISK_GUARD_PK
) {
  throw Error("Missing account PK");
}
if (!ETHERUM_PRICE || !ETHERUM_GAS_PRICE || !REPORT_GAS) {
  throw Error("Missing gas report params");
}

// We force cast the type but check it's validity immediately after
type NetworkNames = "mainnet" | "arbitrum" | "sepolia";
const forkTarget = HARDHAT_FORK_TARGET.toLowerCase() as NetworkNames;
if (
  !HARDHAT_FORK_TARGET ||
  (forkTarget !== "mainnet" &&
    forkTarget !== "arbitrum" &&
    forkTarget !== "sepolia")
) {
  throw Error("Missing or erroneous fork target");
}

const networkConfigs: {
  [key in NetworkNames]: {
    chainId: number;
    rpcUrl: string;
    forkingBlock: string;
    verifyApiKey: string;
  };
} = {
  mainnet: {
    chainId: 1,
    rpcUrl: MAINNET_RPC_URL,
    forkingBlock: MAINNET_FORKING_BLOCK,
    verifyApiKey: MAINNET_VERIFY_API_KEY,
  },
  arbitrum: {
    chainId: 42161,
    rpcUrl: ARBITRUM_RPC_URL,
    forkingBlock: ARBITRUM_FORKING_BLOCK,
    verifyApiKey: ARBITRUM_VERIFY_API_KEY,
  },
  sepolia: {
    chainId: 11155111,
    rpcUrl: SEPOLIA_RPC_URL,
    forkingBlock: SEPOLIA_FORKING_BLOCK,
    verifyApiKey: SEPOLIA_VERIFY_API_KEY,
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
    allowUnlimitedContractSize: false,
    forking: {
      url: rpcUrl,
      blockNumber: Number(forkingBlock),
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
        balance: parseEther("10000").toString(),
      })),
      // Add 20 test users
      ...Array(20)
        .fill("")
        .map((_, i) => ({
          privateKey: id(`Test User ${i}`),
          balance: parseEther("10000").toString(),
        })),
    ],
  };

  return networkConfig;
}

const config: HardhatUserConfig = {
  // ====== Solidity Compilers ====== //

  solidity: {
    compilers: [
      {
        version: "0.8.25",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
      {
        version: "0.4.17",
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
  },

  // ====== Gas Reporter ====== //

  gasReporter: {
    enabled: REPORT_GAS === "true",
    currency: "USD",
    token: "USDC", // Use USDT to hack our way to a fixed ETH price
    coinmarketcap: COINMARKETCAP_API_KEY || "",

    // @dev Switch between fixed and dynamic gas & ETH price

    //=== Fixed ===//
    gasPrice: Number(ETHERUM_PRICE) * Number(ETHERUM_GAS_PRICE),

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
    },
    customChains: [
      // @dev Since we use the term "arbitrum" instead of "arbitrumOne" we need to add a custom chain
      {
        network: "arbitrum",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://arbiscan.io",
        },
      },
    ],
  },

  // ====== Typechain ====== //

  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
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
