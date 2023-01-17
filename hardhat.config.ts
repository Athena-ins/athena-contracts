import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const mainnetForkConfig = {
  forking: {
    url: process.env.MAINNET_URL || "",
    blockNumber: !process.env.FORKING_BLOCK
      ? undefined
      : Number(process.env.FORKING_BLOCK),
  },
  mining: {
    auto: true,
  },
  accounts: {
    count: 302,
  },
};

const goerliForkConfig = {
  forking: {
    url: process.env.GOERLI_URL || "",
    blockNumber: 8328120,
  },
  mining: {
    auto: true,
  },
  accounts: [
    // Deployer
    {
      privateKey: process.env.DEPLOY_TESTNET_PK as string,
      balance: "10000000000000000000000",
    },
    // Users 1,2,3,4
    {
      privateKey: (process.env.DEPLOY_TESTNET_PK as string).replace("8", "9"),
      balance: "10000000000000000000046",
    },
    ...Array(300)
      .fill("")
      .map((_) => ({
        privateKey: ethers.Wallet.createRandom().privateKey,
        balance: "10000000000000000",
      })),
  ],
};

const chooseForkConfig = () => {
  if (process.env.HARDHAT_FORK_TARGET?.toLowerCase() === "mainnet") {
    return mainnetForkConfig;
  } else if (process.env.HARDHAT_FORK_TARGET?.toLowerCase() === "goerli") {
    return goerliForkConfig;
  }
  return goerliForkConfig;
};

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.11",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },

  // ====== Networks ====== //

  networks: {
    hardhat: chooseForkConfig(),
    mainnet: {
      url: process.env.MAINNET_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    goerli: {
      url: process.env.GOERLI_URL || "",
      accounts:
        process.env.DEPLOY_TESTNET_PK !== undefined
          ? [
              process.env.DEPLOY_TESTNET_PK,
              process.env.DEPLOY_TESTNET_PK.replace("8", "9"),
            ]
          : [],
    },
    mumbai: {
      url: process.env.MUMBAI_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },

  // ====== Gas Reporter ====== //

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
  },

  // ====== Etherscan ====== //

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY ? process.env.ETHERSCAN_API_KEY : "",
  },
};

export default config;
