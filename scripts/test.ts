import { ethers, utils } from "ethers";
import weth_abi from "../abis/weth.json";
import ico_abi from "../artifacts/contracts/ICO/AthenaICO.sol/AthenaICO.json";
import dotenv from "dotenv";

dotenv.config();

const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const ATEN_ICO_ADDRESS = "0xb66657b12a0eccb31e677036f532a491430eb055";
const ATEN_TOKEN_CONTRACT = new ethers.Contract(ATEN_TOKEN, weth_abi);

const ATHENA_ICO_CONTRACT = new ethers.Contract(ATEN_ICO_ADDRESS, ico_abi.abi);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);

const main = async () => {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.MAINNET_URL
  );
  console.log("Bal test", wallet.address);
  console.log("Bal test", await provider.getBalance(wallet.address));

  const WETH_Contract = new ethers.Contract(WETH_ADDRESS, weth_abi, provider);

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
};

main();
