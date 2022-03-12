import { ethers } from "ethers";
import weth_abi from "../abis/weth.json";
import ico_abi from "../artifacts/contracts/ICO/AthenaICO.sol/AthenaICO.json";
import dotenv from "dotenv";

dotenv.config();

const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const ATEN_ICO_ADDRESS = "0xb66657b12a0eccb31e677036f532a491430eb055";
const ATEN_TOKEN_CONTRACT = new ethers.Contract(ATEN_TOKEN, weth_abi);

const ATHENA_ICO_CONTRACT = new ethers.Contract(ATEN_ICO_ADDRESS, ico_abi.abi);

const wallet = new ethers.Wallet(
  "0x159987cc1a7722ce1204295da03a4fefe4e7e759f03f95e66628a78aafa14a0c"
);

const main = async () => {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.RINKEBY_URL
  );
  console.log("Bal test", wallet.address);
  console.log("Bal test", await provider.getBalance(wallet.address));
  // const atenCount = await ATHENA_ICO_CONTRACT.connect(provider).presales(
  //   "0x9707a804feb4990e44917eca3700c1eecdf017b4"
  // );
  // console.log("Aten Count : ", ethers.utils.formatEther(atenCount));
};

main();
