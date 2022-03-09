// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre, { ethers } from "hardhat";

import abi from "../artifacts/contracts/ICO/AthenaICO.sol/AthenaICO.json";

const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

async function main() {
  try {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    // await hre.run('compile');

    const [signer] = await ethers.getSigners();
    console.log(
      "DEPLOYING ON CHAIN ID : ",
      (await signer.provider?.getNetwork())?.chainId
    );
    console.log("WITH SIGNER : ", signer.address);

    const chainId = (await signer.provider?.getNetwork())?.chainId;

    if (chainId === 1) {
      return;
    }

    const USDT =
      chainId === 1
        ? "0xdac17f958d2ee523a2206206994597c13d831ec7"
        : "0xD92E713d051C37EbB2561803a3b5FBAbc4962431"; //USDT

    // const ATENfactory = await ethers.getContractFactory("ATEN");
    // const ATEN_CONTRACT = await ATENfactory.deploy();
    // await ATEN_CONTRACT.deployed();
    const ATEN_CONTRACT = {
      address: "0xdf6F897c9c8ca5EDd450678a600e5A883Cd4985f", // RINKEBY
    };

    const oldContract = new ethers.Contract(
      "0xb66657B12A0eCcB31E677036f532A491430EB055",
      abi.abi,
      signer
    );

    // const withdraw = await oldContract.withdraw([ETH, USDT], signer.address);

    // const receipt = await withdraw.wait();
    // if (!receipt) throw new Error("Could not withdraw !!");
    // const bal = await signer.getBalance(oldContract.address);
    // if (!bal.eq(0)) throw new Error("Not really withdraw... " + bal.toString());

    console.log("Deployed ATEN Contract : ", ATEN_CONTRACT.address);

    const factory = await ethers.getContractFactory("AthenaICO");
    const ATHENA_CONTRACT = await factory.deploy(
      chainId === 1
        ? "0x86cEB9FA7f5ac373d275d328B7aCA1c05CFb0283"
        : ATEN_CONTRACT.address,
      ethers.utils.parseEther("300000000"),
      [ETH, USDT],
      chainId === 1
        ? "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46"
        : "0xdCA36F27cbC4E38aE16C4E9f99D39b42337F6dcf" // CHAINLINK RINKEBY USDC/ETH
      // "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46" // Chainlink MAINNET USDT/ETH
    );
    await ATHENA_CONTRACT.deployed();

    console.log("Deployed ICO Contract : ", ATHENA_CONTRACT.address);
  } catch (error) {
    console.error(error);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main().catch((error) => {
//   console.error(error);
//   process.exit(1);
// });

const activeSale = async () => {
  const [signer] = await ethers.getSigners();
  const ATHENA_CONTRACT = new ethers.Contract(
    "0xFDe2a58B64771e794DCCBC491cD3DE5623798729", //RINKEBY
    abi.abi,
    signer
  );
  console.log("WITH SIGNER : ", signer.address);
  const start = await ATHENA_CONTRACT.startSale(true);
  await start.wait();
  console.log("Done !");
};

activeSale().catch((err) => console.error(err));