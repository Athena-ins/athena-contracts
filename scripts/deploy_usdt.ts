// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre, { ethers } from "hardhat";
import readline from "readline";
import abiERC20 from "../abis/weth.json";
import abi from "../artifacts/contracts/USDT_testnet/USDT.sol/USDT.json";

const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const chainId: number = 42;

let contractAddress: string = "0xc7a643f5263141c974a120c13076d90d8f457884"; // KOVAN deployed

async function deploy(signer: SignerWithAddress) {
  try {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    await hre.run("compile");

    let USDT_CONTRACT_LOCAL;
    if (chainId !== 1) {
      // throw new Error("Should not deploy ATEN on Mainnet !");
      console.log("Deploying USDT TOKEN WITH ADDRESS : ", signer.address);
      const ATENfactory = (await ethers.getContractFactory("USDT")).connect(
        signer
      );
      USDT_CONTRACT_LOCAL = await ATENfactory.deploy(
        "USDT Testnet Mintable",
        "USDT",
        6
      );
      await USDT_CONTRACT_LOCAL.deployed();
      contractAddress = USDT_CONTRACT_LOCAL.address;
      console.log("Deployed USDT Contract : ", USDT_CONTRACT_LOCAL.address);
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
  }
}

const mint = async (signer: SignerWithAddress) => {
  const usdtContract = new ethers.Contract(contractAddress, abi.abi, signer);

  const mint = await usdtContract.mint(ethers.utils.parseUnits("1000000", 6));

  const receipt = await mint.wait();
  if (!receipt) throw new Error("Could not mint !!");
  console.log("Done, hash ; ", receipt.transactionHash);
};

const approve = async (signer: SignerWithAddress) => {
  const contractAten = new ethers.Contract(contractAddress, abiERC20, signer);

  const approved = await contractAten.approve(
    contractAddress,
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
      input.toLowerCase() === "mint"
    ) {
      console.log(`Going to mint... Sending TX...`);
      await mint(signer);
      process.exit(0);
    } else if (
      // input.toLowerCase() === "y" ||
      input.toLowerCase() === "approve"
    ) {
      console.log(`Going to approve... Sending TX...`);
      await approve(signer2);
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
