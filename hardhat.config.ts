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
  HARDHAT_FORK_TARGET,
  //
  MAINNET_FORKING_BLOCK,
  GOERLI_FORKING_BLOCK,
  //
  MAINNET_WALLET_PK,
  GOERLI_WALLET_PK,
  //
  MAINNET_RPC_URL,
  GOERLI_RPC_URL,
  //
  EVIDENCE_GUARDIAN_PK,
  BUY_BACK_PK,
  REPORT_GAS,
  ETHERSCAN_API_KEY,
  COINMARKETCAP_API_KEY,
} = process.env;

if (!MAINNET_FORKING_BLOCK || !GOERLI_FORKING_BLOCK)
  throw Error("Missing fork block targets");
if (!MAINNET_WALLET_PK || !GOERLI_WALLET_PK) throw Error("Missing wallet PK");
if (!MAINNET_RPC_URL || !GOERLI_RPC_URL) throw Error("Missing RPC URL");
if (!EVIDENCE_GUARDIAN_PK) throw Error("Missing evidence guardian PK");
if (!BUY_BACK_PK) throw Error("Missing buy back wallet PK");

function makeForkConfig(): HardhatNetworkUserConfig {
  const forkTarget = HARDHAT_FORK_TARGET?.toLowerCase();
  if (
    !HARDHAT_FORK_TARGET ||
    (forkTarget !== "mainnet" && forkTarget !== "goerli")
  )
    throw Error("Missing or erroneous fork target");

  const isMainnetFork = forkTarget === "mainnet";

  const { chainId, forkedBlock, WALLET_PK, RPC_URL } = isMainnetFork
    ? {
        chainId: 1,
        forkedBlock: Number(MAINNET_FORKING_BLOCK),
        WALLET_PK: MAINNET_WALLET_PK,
        RPC_URL: MAINNET_RPC_URL,
      }
    : {
        chainId: 5,
        forkedBlock: Number(GOERLI_FORKING_BLOCK),
        WALLET_PK: GOERLI_WALLET_PK,
        RPC_URL: GOERLI_RPC_URL,
      };

  const networkConfig = {
    chainId,
    allowUnlimitedContractSize: true,
    forking: {
      // We can cast safely because we checked for undefined
      url: RPC_URL as string,
      // Fixed to take advantage of the cache
      blockNumber: forkedBlock,
    },
    mining: {
      auto: true,
      mempool: {
        order: "fifo",
      },
    },
    accounts: [
      {
        // Deployer account
        // We can cast safely because we checked for undefined
        privateKey: WALLET_PK as string,
        balance: parseEther("10000").toString(),
      },
      {
        // Deployer account
        // We can cast safely because we checked for undefined
        privateKey: EVIDENCE_GUARDIAN_PK as string,
        balance: parseEther("10000").toString(),
      },
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
  solidity: {
    compilers: [
      {
        version: "0.8.20",
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
      url: MAINNET_RPC_URL,
      accounts: [MAINNET_WALLET_PK, EVIDENCE_GUARDIAN_PK, BUY_BACK_PK],
    },
    goerli: {
      url: GOERLI_RPC_URL,
      accounts: [
        GOERLI_WALLET_PK,
        EVIDENCE_GUARDIAN_PK,
        BUY_BACK_PK,
        id(GOERLI_WALLET_PK),
      ],
    },
  },

  // ====== Gas Reporter ====== //

  gasReporter: {
    enabled: REPORT_GAS === "true",
    currency: "USD",
    token: "USDT", // Use USDT to hack our way to a fixed ETH price
    coinmarketcap: COINMARKETCAP_API_KEY || "",

    // @dev Switch between fixed and dynamic gas & ETH price
    gasPrice: 20 * 2233, // gwei price * price of ETH in USDT
    // gasPriceApi:
    //   "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
  },

  // ====== Etherscan ====== //

  etherscan: {
    apiKey: ETHERSCAN_API_KEY || "",
    customChains: [],
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
    parallel: true,
    timeout: 30_000,
  },
};

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
export default config;
