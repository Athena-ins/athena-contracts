import { ethers, utils } from "ethers";
import hre from "hardhat";
import weth_abi from "../abis/weth.json";
import ico_abi from "../artifacts/contracts/ICO/AthenaICO.sol/AthenaICO.json";
import dotenv from "dotenv";
import generateEtherAccountsForMnemonic from "./generator";

dotenv.config();

const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const WETH_RINKEBY_ADDRESS = "0x98a5F1520f7F7fb1e83Fe3398f9aBd151f8C65ed";
const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const ATEN_ICO_ADDRESS = "0xb66657b12a0eccb31e677036f532a491430eb055";
const ATEN_TOKEN_CONTRACT = new ethers.Contract(ATEN_TOKEN, weth_abi);

const ATHENA_ICO_CONTRACT = new ethers.Contract(ATEN_ICO_ADDRESS, ico_abi.abi);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);

const main = async () => {
  const provider = hre.ethers.provider;
  // new ethers.providers.JsonRpcProvider(
  //  // WARNING --- process.env.MAINNET_URL
  // );
  // console.log("Bal test", wallet.address);
  // console.log("Bal test", await provider.getBalance(wallet.address));

  // const WETH_Contract = new ethers.Contract(
  //   WETH_RINKEBY_ADDRESS,
  //   weth_abi,
  //   wallet.connect(provider)
  // );

  // const bal = await WETH_Contract.balanceOf(wallet.address);

  // console.log("Balance : ", ethers.utils.formatEther(bal));

  // const tx = await WETH_Contract.withdraw(
  //   bal
  //   // ethers.BigNumber.from(2).pow(256).sub(1)
  // ); //ethers.utils.parseEther("9.9994")

  // console.log("TX : ", tx.hash);
  // await tx.wait();

  /**
   * RECOVER Wallets
   *
  const accounts = generateEtherAccountsForMnemonic(
    "SEEED HERE",
    10
  );

  for (let index = 0; index < accounts.length; index++) {
    const element = accounts[index];
    console.log("Address : ", element);
    console.log(
      "Balance : ",
      await hre.ethers.provider.getBalance("0x" + element.address)
    );
    console.log("_-_-_--___----___----");
  }

   * 
   */

  // const allowance = await WETH_Contract.allowance(
  //   "0x5AA3393e361C2EB342408559309b3e873CD876d6",
  //   "0x58418d6c83EfAB01ed78b0AC42E55af01eE77DbA"
  // );

  // console.log("ALLOW : ", ethers.utils.formatEther(allowance));

  // const msg = await wallet.connect(provider).sendTransaction({
  //   to: "0x967d98e659f2787A38d928B9B7a49a2E4701B30C",
  //   data: ethers.utils.formatBytes32String("Hello Axel Moulin =)"),
  //   gasLimit: 50000,
  // });
  // const receipt = await msg.wait();
  // console.log("Receipt : ", receipt);

  // const atenCount = await ATHENA_ICO_CONTRACT.connect(provider).presales(
  //   "0x9707a804feb4990e44917eca3700c1eecdf017b4"
  // );
  // console.log("Aten Count : ", ethers.utils.formatEther(atenCount));
};;;;;;

main();
