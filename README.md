# ATHENA Smart Contracts

This project is Athena's guarantee pool and policies smart contracts and tests.

# Starting project

Install all dependencies : 
```bash
npm i
```

Get your .env from .env.example

```bash
cp .env.example .env
```
and set your provider keys

# Development

TDD only : Every team member should write unit tests at least before developing a new feature.

Launch tests :
```shell
npx hardhat test
```

Launch only a specific test :
```shell
npx hardhat test tests/testFile.test.ts
```

Before deploying make sure to have `> 90% coverage`

```shell
npx hardhat coverage
```

You can deploy on testnet :

```shell
npx hardhat run scripts/deploy.ts --network kovan
```

# Git rules

Respect conventional commits rules with scope :
https://www.conventionalcommits.org/en/v1.0.0/#commit-message-with-scope

Create a new branch when going to break features, and make a pull request.


# Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Kovan.

In this project, copy the .env.example file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network kovan scripts/sample-script.ts
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```

# Performance optimizations

For faster runs of your tests and scripts, consider skipping ts-node's type checking by setting the environment variable `TS_NODE_TRANSPILE_ONLY` to `1` in hardhat's environment. For more details see [the documentation](https://hardhat.org/guides/typescript.html#performance-optimizations).
