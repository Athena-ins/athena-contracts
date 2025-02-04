```
 █████╗ ████████╗██╗  ██╗███████╗███╗   ██╗ █████╗     ██╗███╗   ██╗███████╗
██╔══██╗╚══██╔══╝██║  ██║██╔════╝████╗  ██║██╔══██╗    ██║████╗  ██║██╔════╝
███████║   ██║   ███████║█████╗  ██╔██╗ ██║███████║    ██║██╔██╗ ██║███████╗
██╔══██║   ██║   ██╔══██║██╔══╝  ██║╚██╗██║██╔══██║    ██║██║╚██╗██║╚════██║
██║  ██║   ██║   ██║  ██║███████╗██║ ╚████║██║  ██║    ██║██║ ╚████║███████║██╗
╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝    ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝

```

# ATHENA Smart Contracts

This repository contains the Athena protocol smart-contracts. Athena is DeFi cover AMM where users can provide liquidity to earn premiums from users who want to protect their DeFi assets. The current repository uses Solidity and Hardhat.

# Starting project

Install all dependencies :

```bash
npm i
```

Get your .env from .env.example

```bash
cp .env.example .env
```

and set your RPC provider keys.

# Git rules

Respect conventional commits rules with scope :
https://www.conventionalcommits.org/en/v1.0.0/#commit-message-with-scope

Create a new branch when going to break features, and make a pull request.

# Development

Launch tests :

You can change the chain against which tests are performed by changing the `HARDHAT_FORK_TARGET` in your `.env` file. Only enter chain names available in the chain targets.

```shell
npm run test
```

Launch only a specific test :

```shell
npx hardhat test tests/testFile.test.ts
```

Before deploying make sure to have `> 90% coverage`

```shell
npx hardhat coverage
```

# Deploy

Before deploying the protocol you must set your configuration for the protocol in the `scripts/verificationData/deployParams.ts` file.

To deploy on Ethereum mainnet

```shell
npm run deploy:mainnet
```

To deploy on Arbitrum One

```shell
npm run deploy:arbitrum
```

To deploy on Sepolia mainnet

```shell
npm run deploy:sepolia
```

# Contract verification

Before verifying contracts you must:

- Specify the API key for the chain explorer in the appropriate `CHAIN_VERIFY_API_KEY` in the `.env` file

- Set the deployment addresses in the `scripts/verificationData/addresses.ts` file

To verify on https://etherscan.io/

```shell
npm run verify:mainnet
```

To verify on https://arbiscan.io

```shell
npm run verify:arbitrum
```

To verify on https://sepolia.etherscan.io

```shell
npm run verify:sepolia
```

# Performance optimizations

For faster runs of your tests and scripts, consider setting `parallel` to `true` in the `hardhat.config.ts` file. Be aware than parallel testing can have undesired sequentiality effects on logs.
