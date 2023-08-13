import hre, { ethers as hre_ethers } from "hardhat";
import { deploymentAddress } from "../test/helpers/TypedContracts";
const { BigNumber } = hre_ethers;

const previousAthenaAbi = [
  {
    inputs: [
      {
        internalType: "string",
        name: "poolName",
        type: "string",
      },
      {
        internalType: "uint128[]",
        name: "incompatiblePools",
        type: "uint128[]",
      },
      {
        internalType: "uint128",
        name: "commitDelay",
        type: "uint128",
      },
      {
        internalType: "string",
        name: "ipfsAgreement",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "uOptimal",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "r0",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "rSlope1",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "rSlope2",
        type: "uint256",
      },
    ],
    name: "addNewProtocol",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const poolNames = [
  "Uniswap V2",
  "Uniswap V3",
  "SushiSwap V1",
  "Compound V2",
  "DyDx",
];

async function main() {
  const chainName = hre.network.name;
  console.log(`\n== DEPLOY ON ${chainName.toUpperCase()} ==\n`);
  try {
    const signers = await hre_ethers.getSigners();
    const deployer = signers[0];

    deploymentAddress.deployer = await deployer.getAddress();

    if (
      hre.network.name === "goerli" &&
      (!process.env.TESTER_WALLET || process.env.TESTER_WALLET.length != 42)
    ) {
      throw Error("TESTER_WALLET not set");
    }

    // =====> deploy pools
    console.log("==> ADD POOLS");

    const athenaContract = new hre_ethers.Contract(
      deploymentAddress.ATHENA,
      previousAthenaAbi,
      deployer
    );

    for (const [i, poolName] of poolNames.entries()) {
      await athenaContract.addNewProtocol(
        poolName,
        [],
        14 * 24 * 60 * 60,
        "baguqeerasords4njcts6vs7qvdjfcvgnume4hqohf65zsfguprqphs3icwea",
        BigNumber.from(70 + i * 4).mul(BigNumber.from(10).pow(27)), // uOptimal_
        BigNumber.from(1 + i).mul(BigNumber.from(10).pow(27)), // r0_
        BigNumber.from(4 + i).mul(BigNumber.from(10).pow(27)), // rSlope1_
        BigNumber.from(8 + i).mul(BigNumber.from(10).pow(26)) // rSlope2_
      );

      console.log("Deployed : ", poolName);
    }
  } catch (err: any) {
    console.log("!!! ERROR !!!");
    console.log(err);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
