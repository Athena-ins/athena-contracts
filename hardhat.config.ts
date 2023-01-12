import * as dotenv from "dotenv";
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
  networks: {
    // hardhat: {
    //   forking: {
    //     url: process.env.MAINNET_URL || "",
    //     blockNumber: !process.env.FORKING_BLOCK
    //       ? undefined
    //       : Number(process.env.FORKING_BLOCK),
    //   },
    //   mining: {
    //     auto: true,
    //     // interval: 5000,
    //   },
    //   accounts: {
    //     count: 302,
    //   },
    // },
    hardhat: {
      forking: {
        url: process.env.GOERLI_URL || "",
        blockNumber: 8299451,
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
          privateKey: (process.env.DEPLOY_TESTNET_PK as string).replace(
            "8",
            "9"
          ),
          balance: "10000000000000000000046",
        },
      ],
    },

    rinkeby: {
      url: process.env.RINKEBY_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined
          ? [process.env.PRIVATE_KEY].concat(
              process.env.PRIVATE_KEY_2 !== undefined
                ? [process.env.PRIVATE_KEY_2]
                : []
            )
          : [],
    },
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    kovan: {
      url: process.env.KOVAN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    mumbai: {
      url: process.env.MUMBAI_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
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
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY ? process.env.ETHERSCAN_API_KEY : "",
  },
};

export default config;
