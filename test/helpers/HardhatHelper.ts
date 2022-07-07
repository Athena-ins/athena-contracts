import hre, { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import weth_abi from "../../abis/weth.json";
import lendingPoolAbi from "../../abis/lendingPool.json";

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const ATEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";

const USDT_TOKEN_CONTRACT = new hre_ethers.Contract(USDT, weth_abi);
const ATEN_TOKEN_CONTRACT = new hre_ethers.Contract(ATEN, weth_abi);

const BINANCE_WALLET = "0xF977814e90dA44bFA03b6295A0616a897441aceC"; //1Md2 USDT
const ATEN_OWNER_ADDRESS = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";
const AAVE_LENDING_POOL = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
const AAVE_REGISTRY = "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5";
const USDT_AAVE_ATOKEN = "0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811";
const ARBITRATOR_ADDRESS = "0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069";
const NULL_ADDRESS = "0x" + "0".repeat(40);

let binanceSigner: ethers.Signer;
let atenOwnerSigner: ethers.Signer;

let currentTime = 1646220000;

async function reset() {
  currentTime = 1646220000;

  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.MAINNET_URL,
          blockNumber: 14307200,
        },
      },
    ],
  });

  binanceSigner = await impersonateAccount(BINANCE_WALLET);
  atenOwnerSigner = await impersonateAccount(ATEN_OWNER_ADDRESS);
}

async function allSigners() {
  return await hre_ethers.getSigners();
}

async function impersonateAccount(address: string) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  return await hre_ethers.getSigner(address);
}

async function setNextBlockTimestamp(addingTime: number) {
  currentTime += addingTime;
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [currentTime],
  });
}

function getCurrentTime() {
  return currentTime;
}

async function USDT_balanceOf(address: string) {
  return await USDT_TOKEN_CONTRACT.connect(binanceSigner).balanceOf(address);
}

async function USDT_transfer(address: string, amount: ethers.BigNumber) {
  await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(address, amount);
}

async function USDT_approve(
  to: ethers.Signer,
  from: string,
  amount: ethers.BigNumber
) {
  return await USDT_TOKEN_CONTRACT.connect(to).approve(from, amount);
}

async function ATEN_balanceOf(address: string) {
  return await ATEN_TOKEN_CONTRACT.connect(atenOwnerSigner).balanceOf(address);
}

async function ATEN_transfer(address: string, amount: ethers.BigNumber) {
  await ATEN_TOKEN_CONTRACT.connect(atenOwnerSigner).transfer(address, amount);
}

async function ATEN_approve(
  to: ethers.Signer,
  from: string,
  amount: ethers.BigNumber
) {
  return await ATEN_TOKEN_CONTRACT.connect(to).approve(from, amount);
}

async function getATokenBalance(
  ATHENA_CONTRACT: ethers.Contract,
  stablecoin: string,
  user: ethers.Signer
) {
  const AAVE_LENDING_POOL_CONTRACT = new ethers.Contract(
    AAVE_LENDING_POOL,
    lendingPoolAbi,
    user
  );
  // we fetch lending pool data for USDT to get aToken address
  const data = await AAVE_LENDING_POOL_CONTRACT.getReserveData(stablecoin);
  // and now check our aToken balance in contract
  const aTokenContract = new ethers.Contract(
    data.aTokenAddress,
    weth_abi,
    user
  );
  const bal = await aTokenContract.balanceOf(ATHENA_CONTRACT.address);
  return bal;
}

export default {
  getCurrentTime,
  reset,
  allSigners,
  impersonateAccount,
  setNextBlockTimestamp,
  WETH,
  USDT,
  ATEN,
  AAVE_LENDING_POOL,
  AAVE_REGISTRY,
  USDT_AAVE_ATOKEN,
  ARBITRATOR_ADDRESS,
  NULL_ADDRESS,
  USDT_balanceOf,
  USDT_transfer,
  USDT_approve,
  ATEN_balanceOf,
  ATEN_transfer,
  ATEN_approve,
  getATokenBalance,
};
