import hre, { ethers as hre_ethers, network } from "hardhat";
import { HardhatNetworkConfig } from "hardhat/types";
import { ethers, BigNumber, BigNumberish } from "ethers";
import weth_abi from "../../abis/weth.json";
import lendingPoolAbi from "../../abis/lendingPool.json";
import { contract, deploymentAddress } from "./TypedContracts";

const NULL_ADDRESS = "0x" + "0".repeat(40);

let binanceSigner: ethers.Signer;
let atenOwnerSigner: ethers.Signer;

let currentTime = 1674000000;

async function allSigners() {
  return await hre_ethers.getSigners();
}

async function reset() {
  currentTime = 1674000000;

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

  binanceSigner = await impersonateAccount(deploymentAddress.deployer);
  const getAllSigners: any = await allSigners();
  atenOwnerSigner = getAllSigners[0];
}

async function initSigners() {
  binanceSigner = await impersonateAccount(deploymentAddress.deployer);
  const getAllSigners: any = await allSigners();
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
  if (addingTime <= 0) return;
  const latestTimeStamp = (await hre.ethers.provider.getBlock("latest"))
    .timestamp;

  const newTime = latestTimeStamp + addingTime;

  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [newTime],
  });
  await hre.network.provider.request({ method: "evm_mine" });
}

async function getCurrentTime() {
  return (await hre.ethers.provider.getBlock("latest")).timestamp;
}

async function USDT_spenderBalance() {
  const spenderAddress = await binanceSigner.getAddress();
  return await contract.USDT.connect(binanceSigner).balanceOf(spenderAddress);
}

async function USDT_balanceOf(address: string) {
  return await contract.USDT.connect(binanceSigner).balanceOf(address);
}

async function USDT_transfer(address: string, amount: BigNumberish) {
  return (
    await contract.USDT.connect(binanceSigner).transfer(address, amount)
  ).wait();
}

async function USDT_approve(
  owner: ethers.Signer,
  spender: string,
  amount: BigNumberish
) {
  return (await contract.USDT.connect(owner).approve(spender, amount)).wait();
}

async function USDT_maxApprove(owner: ethers.Signer, spender: string) {
  return (
    await contract.USDT.connect(owner).approve(
      spender,
      ethers.BigNumber.from(2).pow(256).sub(1)
    )
  ).wait();
}

async function ATEN_spenderBalance() {
  const spenderAddress = await atenOwnerSigner.getAddress();
  return await contract.ATEN.connect(atenOwnerSigner).balanceOf(spenderAddress);
}

async function ATEN_balanceOf(address: string) {
  return await contract.ATEN.connect(atenOwnerSigner).balanceOf(address);
}

async function ATEN_transfer(address: string, amount: BigNumberish) {
  // Add 20% to cover transfer fees
  const amountForFees = BigNumber.from(amount).mul(120).div(100);

  (
    await contract.ATEN.connect(atenOwnerSigner).transfer(
      address,
      amountForFees
    )
  ).wait();
}

async function ATEN_approve(
  owner: ethers.Signer,
  spender: string,
  amount: BigNumberish
) {
  return (await contract.ATEN.connect(owner).approve(spender, amount)).wait();
}

async function getATokenBalance(user: ethers.Signer) {
  const AAVE_LENDING_POOL_CONTRACT = new ethers.Contract(
    deploymentAddress.aave_lending_pool,
    lendingPoolAbi,
    user
  );
  const athenaAddress = contract.ATHENA.address;
  const usdtAddress = contract.USDT.address;
  // we fetch lending pool data for USDT to get aToken address
  const data = await AAVE_LENDING_POOL_CONTRACT.getReserveData(usdtAddress);
  // and now check our aToken balance in contract
  const aTokenContract = new ethers.Contract(
    data.aTokenAddress,
    weth_abi,
    user
  );
  const bal = await aTokenContract.balanceOf(athenaAddress);
  return bal;
}

export default {
  getCurrentTime,
  reset,
  initSigners,
  allSigners,
  impersonateAccount,
  setNextBlockTimestamp,
  NULL_ADDRESS,
  //
  AAVE_LENDING_POOL: deploymentAddress.aave_lending_pool,
  AAVE_REGISTRY: deploymentAddress.aave_registry,
  ARBITRATOR_ADDRESS: deploymentAddress.ARBITRATOR,
  getATokenBalance,
  // USDT
  USDT: deploymentAddress.USDT,
  USDT_balanceOf,
  USDT_transfer,
  USDT_approve,
  USDT_maxApprove,
  USDT_spenderBalance,
  // ATEN
  ATEN: deploymentAddress.ATEN,
  ATEN_balanceOf,
  ATEN_transfer,
  ATEN_approve,
  ATEN_spenderBalance,
};
