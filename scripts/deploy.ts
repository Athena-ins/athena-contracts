// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre, { ethers } from "hardhat";
import readline from "readline";
import abi from "../artifacts/contracts/ICO/AthenaICO.sol/AthenaICO.json";

const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const contractAddress = "0x06bBebaf38430DFF7CbBB0492b6f23Ed6440799A";
const chainId: number = 4;
const USDT =
  chainId === 1
    ? "0xdac17f958d2ee523a2206206994597c13d831ec7"
    : "0xD92E713d051C37EbB2561803a3b5FBAbc4962431"; //USDT

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

async function deploy(signer: SignerWithAddress) {
  try {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    await hre.run("compile");

    // const ATENfactory = await ethers.getContractFactory("ATEN");
    // const ATEN_CONTRACT = await ATENfactory.deploy();
    // await ATEN_CONTRACT.deployed();
    const ATEN_CONTRACT = {
      address:
        chainId === 1
          ? "0x86cEB9FA7f5ac373d275d328B7aCA1c05CFb0283"
          : "0xdf6F897c9c8ca5EDd450678a600e5A883Cd4985f", // RINKEBY
    };

    // console.log("Deployed ATEN Contract : ", ATEN_CONTRACT.address);

    const factory = await ethers.getContractFactory("AthenaICO", signer);
    const ATHENA_CONTRACT = await factory.deploy(
      chainId === 1
        ? "0x86cEB9FA7f5ac373d275d328B7aCA1c05CFb0283"
        : ATEN_CONTRACT.address,
      ethers.utils.parseEther("100000000"),
      [ETH, USDT, USDC],
      chainId === 1
        ? "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46" // Chainlink MAINNET USDT/ETH
        : "0xdCA36F27cbC4E38aE16C4E9f99D39b42337F6dcf" // CHAINLINK RINKEBY USDC/ETH
    );
    const rec = await ATHENA_CONTRACT.deployed();

    console.log("Deployed ICO Contract : ", ATHENA_CONTRACT.address);
    const owner = await ATHENA_CONTRACT.owner();

    console.log("Done, owner = ", owner);
    process.exit(0);
  } catch (error) {
    console.error(error);
  }
}

const activeSale = async (signer: SignerWithAddress) => {
  const ATHENA_CONTRACT = new ethers.Contract(contractAddress, abi.abi, signer);
  const code = await ethers.provider.getCode(contractAddress);
  console.log("Contract code : ", code.substring(0, 40));

  if (!code || code === "0x00")
    throw new Error("No contract at this address !");
  console.log("WITH SIGNER : ", signer.address);
  const start = await ATHENA_CONTRACT.startSale(true);
  const receipt = await start.wait();
  console.log("Done, hash ; ", receipt.transactionHash);
  process.exit(0);
};

const activeClaim = async (signer: SignerWithAddress) => {
  const ATHENA_CONTRACT = new ethers.Contract(contractAddress, abi.abi, signer);
  const code = await ethers.provider.getCode(contractAddress);
  console.log("Contract code : ", code.substring(0, 40));

  if (!code || code === "0x00")
    throw new Error("No contract at this address !");
  console.log("WITH SIGNER : ", signer.address);
  const start = await ATHENA_CONTRACT.startClaim(true, true);
  const receipt = await start.wait();
  console.log("Done, hash ; ", receipt.transactionHash);
  process.exit(0);
};

const withdraw = async (signer: SignerWithAddress) => {
  const oldContract = new ethers.Contract(contractAddress, abi.abi, signer);

  const withdraw = await oldContract.withdraw([USDT], signer.address);

  const receipt = await withdraw.wait();
  if (!receipt) throw new Error("Could not withdraw !!");
  const bal = await hre.ethers.provider.getBalance(oldContract.address);
  if (!bal.eq(0)) throw new Error("Not really withdraw... " + bal.toString());
  console.log("Done, hash ; ", receipt.transactionHash);
  process.exit(0);
};

async function main() {
  // if (!process.env.PRIVATE_KEY)
  //   throw new Error("Missing process.env.PRIVATE_KEY");
  // const signer = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);
  const [signer] = await ethers.getSigners();

  console.log("NETWORK IS : ", hre.network.config);
  console.log("NETWORK : ", hre.network.name);
  console.log("SIGNER IS : ", signer.address);
  console.log("Contract IS (if applicable) : ", contractAddress);

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
      input.toLowerCase() === "sale"
    ) {
      console.log(`Going to open sale... Sending TX...`);
      await activeSale(signer);
      process.exit(0);
    } else if (
      // input.toLowerCase() === "y" ||
      input.toLowerCase() === "claim"
    ) {
      console.log(`Going to open Claim... Sending TX...`);
      await activeClaim(signer);
      process.exit(0);
    } else if (
      // input.toLowerCase() === "y" ||
      input.toLowerCase() === "withdraw"
    ) {
      console.log(`Going to open withdraw... Sending TX...`);
      await withdraw(signer);
      process.exit(0);
    } else {
      console.error("You cancelled...");
      process.exit(1);
    }
  });
  console.log(
    "If addresses are correct, choose script : deploy, sale, claim, withdraw"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
