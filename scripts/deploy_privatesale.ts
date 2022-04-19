// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre, { ethers } from "hardhat";
import readline from "readline";
import abiERC20 from "../abis/weth.json";
import abi from "../artifacts/contracts/PrivateSale/PrivateSale.sol/PrivateSale.json";

const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const chainId: number = 4;
const contractAddress =
  chainId === 1
    ? "0x8bFad5636BBf29F75208acE134dD23257C245391"
    : "0x8F23520FdA6B183bbAA072b7d57375F7bE27db6d";
const ATEN_MAINNET_OWNER = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";
const ATEN_CONTRACT = {
  address:
    chainId === 1
      ? "0x86cEB9FA7f5ac373d275d328B7aCA1c05CFb0283"
      : "0x2da9F0DF7DC5f9F6e024B4ABf97148B405D9b4F8", // RINKEBY
};
const USDT =
  chainId === 1
    ? "0xdac17f958d2ee523a2206206994597c13d831ec7"
    : "0xD92E713d051C37EbB2561803a3b5FBAbc4962431"; //USDT

const USDC =
  chainId === 1
    ? "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    : "0xeb8f08a975ab53e34d8a0330e0d34de942c95926";

async function deploy(
  signer: SignerWithAddress,
  tokenSigner?: SignerWithAddress
) {
  try {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    await hre.run("compile");

    let ATEN_CONTRACT_LOCAL;
    if (chainId !== 1 && tokenSigner) {
      // throw new Error("Should not deploy ATEN on Mainnet !");
      // console.log("Deploying ATEN TOKEN WITH ADDRESS : ", tokenSigner?.address);
      // const ATENfactory = (await ethers.getContractFactory("ATEN")).connect(
      //   tokenSigner || signer
      // );
      // ATEN_CONTRACT_LOCAL = await ATENfactory.deploy();
      ATEN_CONTRACT_LOCAL = { address: ATEN_CONTRACT.address };
      // await ATEN_CONTRACT_LOCAL.deployed();

      // console.log("Deployed ATEN Contract : ", ATEN_CONTRACT_LOCAL.address);
    }

    const factory = await ethers.getContractFactory("PrivateSale", signer);
    const ATHENA_CONTRACT = await factory.deploy(
      chainId === 1
        ? "0x86cEB9FA7f5ac373d275d328B7aCA1c05CFb0283"
        : ATEN_CONTRACT_LOCAL?.address
        ? ATEN_CONTRACT_LOCAL.address
        : ATEN_CONTRACT.address,
      ethers.utils.parseEther("294000000"),
      [USDT, USDC]
    );
    const rec = await ATHENA_CONTRACT.deployed();

    console.log("Deployed Private Sale Contract : ", ATHENA_CONTRACT.address);
    const owner = await ATHENA_CONTRACT.owner();

    const atenContract = new ethers.Contract(
      ATEN_CONTRACT.address,
      abiERC20,
      signer
    );
    const transfer = await atenContract.transfer(
      ATHENA_CONTRACT.address,
      ethers.utils.parseEther("294000000")
    );
    await transfer.wait(1);

    console.log("Done, owner = ", owner);
    process.exit(0);
  } catch (error) {
    console.error(error);
  }
}

const activeSale = async (signer: SignerWithAddress, starting = true) => {
  const ATHENA_CONTRACT = new ethers.Contract(contractAddress, abi.abi, signer);
  const code = await ethers.provider.getCode(contractAddress);
  console.log("Contract code : ", code.substring(0, 40));

  if (!code || code === "0x00")
    throw new Error("No contract at this address !");
  console.log("WITH SIGNER : ", signer.address);
  const start = await ATHENA_CONTRACT.startSale(starting);
  const receipt = await start.wait();
  console.log("Done, hash ; ", receipt.transactionHash);
  process.exit(0);
};

const buy = async (signer: SignerWithAddress, starting = true) => {
  const ATHENA_CONTRACT = new ethers.Contract(contractAddress, abi.abi, signer);
  const code = await ethers.provider.getCode(contractAddress);
  console.log("Contract code : ", code.substring(0, 40));

  if (!code || code === "0x00")
    throw new Error("No contract at this address !");
  console.log("WITH SIGNER : ", signer.address);
  const start = await ATHENA_CONTRACT.buy(
    ethers.utils.parseUnits("100", 6),
    USDT,
    {
      gasLimit: 1000000,
    }
  );
  const receipt = await start.wait();
  console.log("Done, hash ; ", receipt.transactionHash);
  process.exit(0);
};

const distribute = async (signer: SignerWithAddress) => {
  const ATHENA_CONTRACT = new ethers.Contract(contractAddress, abi.abi, signer);
  const code = await ethers.provider.getCode(contractAddress);
  console.log("Contract code : ", code.substring(0, 40));

  if (!code || code === "0x00")
    throw new Error("No contract at this address !");
  console.log("WITH SIGNER : ", signer.address);
  const start = await ATHENA_CONTRACT.distribute(0);
  const receipt = await start.wait();
  console.log("Done, hash ; ", receipt.transactionHash);
  process.exit(0);
};

const startVesting = async (signer: SignerWithAddress) => {
  const ATHENA_CONTRACT = new ethers.Contract(contractAddress, abi.abi, signer);
  const code = await ethers.provider.getCode(contractAddress);
  console.log("Contract code : ", code.substring(0, 40));

  if (!code || code === "0x00")
    throw new Error("No contract at this address !");
  console.log("WITH SIGNER : ", signer.address);
  const start = await ATHENA_CONTRACT.startVesting();
  const receipt = await start.wait();
  console.log("Done, hash ; ", receipt.transactionHash);
  process.exit(0);
};

const addWhitelist = async (signer: SignerWithAddress) => {
  const ATHENA_CONTRACT = new ethers.Contract(contractAddress, abi.abi, signer);
  const code = await ethers.provider.getCode(contractAddress);
  console.log("Contract code : ", code.substring(0, 40));

  if (!code || code === "0x00")
    throw new Error("No contract at this address !");
  console.log("WITH SIGNER : ", signer.address);
  const start = await ATHENA_CONTRACT.whitelistAddresses(
    [
      "0xed5450bb62501e1c40d0e4025a9f62317800e790",
      "0xB47bcc2354b1d99607797553df1DEBcA2eccb30E",
      "0x381e0E1bf14e616AC542A298ACB90184ED8cD0c1",
      "0xa5946b2Ee8942d572e7dD93fE261C39005B93dAB",
    ],
    [
      ethers.utils.parseEther("300000"),
      ethers.utils.parseEther("300000"),
      ethers.utils.parseEther("300000"),
      ethers.utils.parseEther("300000"),
    ]
  );
  const receipt = await start.wait();
  console.log("Done, hash ; ", receipt.transactionHash);
  process.exit(0);
};

const withdraw = async (signer: SignerWithAddress) => {
  const oldContract = new ethers.Contract(contractAddress, abi.abi, signer);

  const withdraw = await oldContract.withdraw(
    [ATEN_CONTRACT.address, USDT],
    signer.address
  );

  const receipt = await withdraw.wait();
  if (!receipt) throw new Error("Could not withdraw !!");
  console.log("Done, hash ; ", receipt.transactionHash);
  const bal = await hre.ethers.provider.getBalance(oldContract.address);
  if (!bal.eq(0)) throw new Error("Not really withdraw... " + bal.toString());

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
      await deploy(signer, chainId === 1 ? undefined : signer2);
    } else if (
      // input.toLowerCase() === "y" ||
      input.toLowerCase() === "sale"
    ) {
      console.log(`Going to open sale... Sending TX...`);
      await activeSale(signer);
      process.exit(0);
    } else if (
      // input.toLowerCase() === "y" ||
      input.toLowerCase() === "whitelist"
    ) {
      console.log(`Going to add whitelist... Sending TX...`);
      await addWhitelist(signer);
      process.exit(0);
    } else if (
      // input.toLowerCase() === "y" ||
      input.toLowerCase() === "stopsale"
    ) {
      console.log(`Going to open sale... Sending TX...`);
      await activeSale(signer, false);
      process.exit(0);
    } else if (
      // input.toLowerCase() === "y" ||
      input.toLowerCase() === "vesting"
    ) {
      console.log(`Going to start vesting... Sending TX...`);
      await startVesting(signer);
      process.exit(0);
    } else if (
      // input.toLowerCase() === "y" ||
      input.toLowerCase() === "distribute"
    ) {
      console.log(`Going to open Claim... Sending TX...`);
      await distribute(signer);
      process.exit(0);
    } else if (
      // input.toLowerCase() === "y" ||
      input.toLowerCase() === "withdraw"
    ) {
      console.log(`Going to open withdraw... Sending TX...`);
      await withdraw(signer);
      process.exit(0);
    } else if (
      // input.toLowerCase() === "y" ||
      input.toLowerCase() === "buy"
    ) {
      console.log(`Going to open withdraw... Sending TX...`);
      await buy(signer);
      process.exit(0);
    } else {
      console.error("You cancelled...");
      process.exit(1);
    }
  });
  console.log(
    "If addresses are correct, choose script : deploy, sale, whitelist, stopsale, distribute, withdraw"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
