// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre, { ethers } from "hardhat";
import readline from "readline";
import abiERC20 from "../abis/weth.json";
import abi from "../artifacts/contracts/Athena.sol/Athena.json";
import { deployAndInitProtocol } from "../test/helpers";

const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const chainId: number = 80001;

const ATEN_MAINNET_OWNER = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";
const ATEN_CONTRACT: { address: { [chainId: number]: string | undefined } } = {
  address: {
    1: "0x86cEB9FA7f5ac373d275d328B7aCA1c05CFb0283",
    42: "0xd3c5ccB0Ef0c87D989d63A04C5C8f3cf2cB0d726", // KOVAN
    80001: "0xB3C3f5b5e4dfA2E94c714c67d30c8148272CCACD",
  },
};
const ATHENA_CONTRACT: { address: { [chainId: number]: string | undefined } } =
  {
    address: {
      1: undefined,
      42: undefined,
      80001: "0x1a0636fEa7b40Bae8C93226cE87786CC497460bb",
    },
  };
const USDT: { [chainId: number]: string } = {
  1: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  42: "0xD92E713d051C37EbB2561803a3b5FBAbc4962431", //USDT KOVAN MINTABLE
  80001: "0xBD21A10F619BE90d6066c941b04e340841F1F989", // MUMBAI
};

const AAVE_REGISTRY: { [chainId: number]: string | undefined } = {
  1: undefined,
  42: "0x88757f2f99175387aB4C6a4b3067c77A695b0349",
  80001: "0x178113104fEcbcD7fF8669a0150721e231F0FD4B",
};

const USDT_AAVE_ATOKEN: { [chainId: number]: string | undefined } = {
  1: undefined,
  42: "0xfe3E41Db9071458e39104711eF1Fa668bae44e85",
  80001: "0xF8744C0bD8C7adeA522d6DDE2298b17284A79D1b",
};

const FACTORY_PROTOCOL: { [chainId: number]: string | undefined } = {
  1: undefined,
  42: undefined,
  80001: "0xd3c5ccB0Ef0c87D989d63A04C5C8f3cf2cB0d726",
};
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

async function deploy(signer: SignerWithAddress) {
  try {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    // await hre.run("compile");

    // console.log("Deploying ATEN TOKEN WITH SIGNER : ", signer.address);
    // const ATENfactory = (await ethers.getContractFactory("ATEN")).connect(
    //   signer
    // );
    // let ATEN_CONTRACT_LOCAL = await ATENfactory.deploy();
    // await ATEN_CONTRACT_LOCAL.deployed();

    // console.log("Deployed ATEN Contract : ", ATEN_CONTRACT_LOCAL.address);
    if (chainId !== 1) {
      // throw new Error("Should not deploy ATEN on Mainnet !");
      console.log("Deploying PROTOCOL WITH SIGNER : ", signer.address);

      const deployed = await deployAndInitProtocol([signer], {
        ATEN: ATEN_CONTRACT.address[chainId],
        USDT: USDT[chainId],
        USDT_AAVE_TOKEN: USDT_AAVE_ATOKEN[chainId],
        AAVE_REGISTRY: AAVE_REGISTRY[chainId],
        confirmations: 3,
        commitDelayForWithdraw: 2 * 60 * 60, //2 hours delay only for testnet !!
      });

      console.log(
        "Deployed Contracts : ",
        deployed.map((cont) => cont.address)
      );
    }

    console.log("Done. ");
    process.exit(0);
  } catch (error) {
    console.error(error);
  }
}

const addNewProtocol = async (signer: SignerWithAddress) => {
  const contract = new ethers.Contract(
    ATHENA_CONTRACT.address[chainId]!,
    abi.abi,
    signer
  );
  const code = await ethers.provider.getCode(ATHENA_CONTRACT.address[chainId]!);
  console.log("Contract code : ", code.substring(0, 40));

  if (!code || code === "0x00")
    throw new Error("No contract at this address !");
  console.log("WITH SIGNER : ", signer.address);
  const start = await contract.addNewProtocol(
    "Beefy Polygon",
    0,
    0,
    "0xfbdd194376de19a88118e84e279b977f165d01b8",
    [1]
  );
  const receipt = await start.wait(5);
  console.log("Done, hash ; ", receipt.transactionHash);
  process.exit(0);
};

const withdraw = async (signer: SignerWithAddress) => {
  const oldContract = new ethers.Contract(
    ATHENA_CONTRACT.address[chainId]!,
    abi.abi,
    signer
  );

  const withdraw = await oldContract.withdraw([ETH, USDT], signer.address);

  const receipt = await withdraw.wait();
  if (!receipt) throw new Error("Could not withdraw !!");
  console.log("Done, hash ; ", receipt.transactionHash);
  const bal = await hre.ethers.provider.getBalance(oldContract.address);
  if (!bal.eq(0)) throw new Error("Not really withdraw... " + bal.toString());

  process.exit(0);
};

const approve = async (signer: SignerWithAddress) => {
  const contractAten = new ethers.Contract(
    ATEN_CONTRACT.address[chainId]!,
    abiERC20,
    signer
  );

  const approved = await contractAten.approve(
    ATHENA_CONTRACT.address[chainId]!,
    ethers.utils.parseEther("100000000")
  );

  const receipt = await approved.wait();
  if (!receipt) throw new Error("Could not approve !!");
  console.log("Done, hash ; ", receipt.transactionHash);
  process.exit(0);
};

async function main() {
  // if (!process.env.PRIVATE_KEY)
  //   throw new Error("Missing process.env.PRIVATE_KEY");
  // const signer = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);
  const [signer, signer2] = await ethers.getSigners();

  console.log("NETWORK IS : ", hre.network.config);
  console.log("NETWORK : ", hre.network.name);
  console.log("SIGNER IS : ", signer.address);
  console.log(
    "Contract IS (if applicable) : ",
    ATHENA_CONTRACT.address[chainId]
  );

  const net = await hre.ethers.provider.getNetwork();
  if (chainId !== net.chainId)
    throw new Error("Check chainId !! " + chainId + " / " + net.chainId);
  readline.emitKeypressEvents(process.stdin);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  // process.stdin.setRawMode(true);
  rl.on("line", async (input: string) => {
    console.log("String / Key : ", input);
    if (input.includes("cancel")) {
      process.exit();
    } else if (input.toLowerCase() === "deploy") {
      console.log(`Going to deploy... Sending TX...`);
      await deploy(signer);
    } else if (
      // input.toLowerCase() === "y" ||
      input.toLowerCase() === "newprotocol"
    ) {
      console.log(`Going to add new Protocol... Sending TX...`);
      await addNewProtocol(signer);
      process.exit(0);
    } else {
      console.error("You cancelled...");
      process.exit(1);
    }
  });
  console.log(
    "If addresses are correct, choose script : deploy, sale, stopsale, claim, withdraw, approve"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
