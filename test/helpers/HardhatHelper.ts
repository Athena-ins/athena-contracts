import hre, { ethers as hre_ethers, network } from "hardhat";
import { HardhatNetworkConfig } from "hardhat/types";
import { ethers } from "ethers";
import weth_abi from "../../abis/weth.json";
import lendingPoolAbi from "../../abis/lendingPool.json";
import { CONTRACT } from "./ProtocolHelper";

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const ATEN =
  CONTRACT?.ATEN?.address || "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";

// ==== Mainnet ==== //
// const USDT_HOLDER = "0xF977814e90dA44bFA03b6295A0616a897441aceC"; // Mainnet
// const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
// const USDT_AAVE_ATOKEN = "0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811";
// const AAVE_REGISTRY = "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5";
// const AAVE_LENDING_POOL = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
// const ARBITRATOR_ADDRESS = "0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069";

// ==== Goerli ==== //
const USDT_HOLDER = "0x745A6BE3C44883979FC43e1Df2F7e83eE7b9f73A"; //1Md2 USDT
const USDT = "0x65E2fe35C30eC218b46266F89847c63c2eDa7Dc7"; // AAVE v2 USDT
const USDT_AAVE_ATOKEN = "0xDCb84F51dd4BeA1ce4b6118F087B260a71BB656c"; // AAVE v2 aUSDT
const AAVE_REGISTRY = "0x5e52dec931ffb32f609681b8438a51c675cc232d";
const AAVE_LENDING_POOL = "0x4bd5643ac6f66a5237e18bfa7d47cf22f1c9f210";
const ARBITRATOR_ADDRESS = "0x77AB8C2174A770BdbFF9a4eda19C8c4D609A8eA4"; // Self deployed

const USDT_TOKEN_CONTRACT = new hre_ethers.Contract(USDT, weth_abi);
const ATEN_TOKEN_CONTRACT = new hre_ethers.Contract(ATEN, weth_abi);

const NULL_ADDRESS = "0x" + "0".repeat(40);

let binanceSigner: ethers.Signer;
let atenOwnerSigner: ethers.Signer;

let currentTime = 1646220000;

async function allSigners() {
  return await hre_ethers.getSigners();
}

async function reset() {
  currentTime = 1646220000;

  const originalFork = (network.config as HardhatNetworkConfig).forking?.url;
  const forkTarget = originalFork || process.env.GOERLI_URL;

  const originalForkBlock = (network.config as HardhatNetworkConfig).forking
    ?.blockNumber;
  const forkTargetBlock =
    originalForkBlock || Number(process.env.FORKING_BLOCK || 8299451);

  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: forkTarget,
          blockNumber: forkTargetBlock,
        },
      },
    ],
  });

  binanceSigner = await impersonateAccount(USDT_HOLDER);
  const getAllSigners: any = allSigners();
  atenOwnerSigner = getAllSigners[0];
}

async function initSigners() {
  binanceSigner = await impersonateAccount(USDT_HOLDER);
  const getAllSigners: any = allSigners();
  atenOwnerSigner = getAllSigners[0];
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
  sender: ethers.Signer,
  recipient: string,
  amount: ethers.BigNumber
) {
  return await USDT_TOKEN_CONTRACT.connect(sender).approve(recipient, amount);
}

async function USDT_maxApprove(sender: ethers.Signer, recipient: string) {
  return await USDT_TOKEN_CONTRACT.connect(sender).approve(
    recipient,
    ethers.BigNumber.from(2).pow(256).sub(1)
  );
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
  initSigners,
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
  USDT_maxApprove,
  ATEN_balanceOf,
  ATEN_transfer,
  ATEN_approve,
  getATokenBalance,
};
