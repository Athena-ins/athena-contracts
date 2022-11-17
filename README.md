```
 █████╗ ████████╗██╗  ██╗███████╗███╗   ██╗ █████╗     ██╗███╗   ██╗███████╗
██╔══██╗╚══██╔══╝██║  ██║██╔════╝████╗  ██║██╔══██╗    ██║████╗  ██║██╔════╝
███████║   ██║   ███████║█████╗  ██╔██╗ ██║███████║    ██║██╔██╗ ██║███████╗
██╔══██║   ██║   ██╔══██║██╔══╝  ██║╚██╗██║██╔══██║    ██║██║╚██╗██║╚════██║
██║  ██║   ██║   ██║  ██║███████╗██║ ╚████║██║  ██║    ██║██║ ╚████║███████║██╗
╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝    ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝

```

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

#

# DEPLOYMENTS

MUMBAI (Chain Id : 80001)

Parameters :
(Deployed Owner : 0xED5450BB62501E1c40D0E4025a9f62317800e790)

- ATEN_CONTRACT: 0xB3C3f5b5e4dfA2E94c714c67d30c8148272CCACD
- USDT: 0xBD21A10F619BE90d6066c941b04e340841F1F989
- AAVE_REGISTRY : 0x178113104fEcbcD7fF8669a0150721e231F0FD4B
- USDT_AAVE_ATOKEN : 0xF8744C0bD8C7adeA522d6DDE2298b17284A79D1b

```js
export const ADDRESSES: { [chainId: number]: { [key: string]: string } } = {
  80001: {
    ATHENA: "0x1a0636fEa7b40Bae8C93226cE87786CC497460bb",
    POSITIONS_MANAGER: "0xc7a643f5263141c974a120c13076d90d8f457884", // '0x1111e28f96850e91736414ba6065b5c7d78b5ec2',
    STAKED_ATENS_SUPPLY: "0xd944d88139b23e41d217c319b1c749b2dc825e41", //n'0xbeDb237a00bAd3945f4e9251E1691f51Cbf5E306',
    STAKED_ATENS_POLICY: "0x3f641ed4021A53A7986E556f396EfF84d84CD4F5", //'0x620Ce1a74fd78ebf43C2d208F4C8646a4B0678Cd',
    FACTORY_PROTOCOL: "0xd3c5ccB0Ef0c87D989d63A04C5C8f3cf2cB0d726",
    VAULT_ATENS: "0x2Dfbb7EF649Ad88B23f7AA12eC80459d0a5398c8", // '0xD944d88139b23e41D217C319b1c749B2dc825E41',
    POLICY_MANAGER: "0xdA5d3972c6CB280661481131ed8FA231405C1238", // '0x3f641ed4021A53A7986E556f396EfF84d84CD4F5',
  },
};
```
