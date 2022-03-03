// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre, { ethers } from "hardhat";

const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

async function main() {
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

  if ((await signer.provider?.getNetwork())?.chainId === 1) {
    return;
  }
  const ATENfactory = await ethers.getContractFactory("ATEN");
  const ATEN_CONTRACT = await ATENfactory.deploy();
  await ATEN_CONTRACT.deployed();

  console.log("Deployed ATEN Contract : ", ATEN_CONTRACT.address);

  const factory = await ethers.getContractFactory("AthenaICO");
  const ATHENA_CONTRACT = await factory.deploy(
    (await signer.provider?.getNetwork())?.chainId === 1
      ? "0x86cEB9FA7f5ac373d275d328B7aCA1c05CFb0283"
      : ATEN_CONTRACT.address,
    [ETH, USDT],
    (await signer.provider?.getNetwork())?.chainId === 1
      ? "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46"
      : "0xdCA36F27cbC4E38aE16C4E9f99D39b42337F6dcf" // CHAINLINK RINKEBY USDC/ETH
    // "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46" // Chainlink MAINNET USDT/ETH
  );
  await ATHENA_CONTRACT.deployed();

  console.log("Deployed ICO Contract : ", ATHENA_CONTRACT.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
