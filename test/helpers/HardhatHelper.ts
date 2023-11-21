import hre, { ethers, network } from "hardhat";
import { HardhatNetworkConfig } from "hardhat/types";
import {
  BigNumber,
  BigNumberish,
  Signer,
  Contract,
  ContractReceipt,
  ContractTransaction,
} from "ethers";
import weth_abi from "../abis/weth.json";
import lendingPoolAbi from "../abis/lendingPool.json";
import { contract, deploymentAddress } from "./TypedContracts";

const NULL_ADDRESS = "0x" + "0".repeat(40);

let binanceSigner: Signer;
let atenOwnerSigner: Signer;

// =============== //
// === Helpers === //
// =============== //

export async function getCurrentTime() {
  return (await ethers.provider.getBlock("latest")).timestamp;
}

// ========================== //
// === Chain manipulation === //
// ========================== //

export async function makeForkSnapshot(): Promise<string> {
  return hre.network.provider.request({
    method: "evm_snapshot",
    params: [],
  }) as Promise<string>;
}
export async function restoreForkSnapshot(snapshotId: string) {
  return hre.network.provider
    .request({
      method: "evm_revert",
      params: [snapshotId],
    })
    .then(() => {
      console.log("=> Chain snapshot restored");
    });
}

export async function resetFork() {
  const originalFork = (network.config as HardhatNetworkConfig).forking?.url;
  // @bw should replace call to env with config file for type safety
  const forkTarget = originalFork || process.env.GOERLI_RPC_URL;

  const originalForkBlock = (network.config as HardhatNetworkConfig).forking
    ?.blockNumber;
  const forkTargetBlock = originalForkBlock || "latest";

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

  console.log("=> Forked chain reset");

  // binanceSigner = await impersonateAccount(deploymentAddress.deployer);
  // const getAllSigners: any = await allSigners();
  // atenOwnerSigner = getAllSigners[0];
}

export async function setNextBlockTimestamp(secondsToAdd: number) {
  if (secondsToAdd <= 0) return;
  const latestTimeStamp = await getCurrentTime();
  const newTime = latestTimeStamp + secondsToAdd;

  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [newTime],
  });
  await hre.network.provider.request({ method: "evm_mine" });
}

// ======================== //
// === Wallet & signers === //
// ======================== //

export function signerChainId(signer: Signer): Promise<number> | undefined {
  return signer.provider?.getNetwork().then((network) => network.chainId);
}

export async function allSigners() {
  return await ethers.getSigners();
}

export async function deployerSigner() {
  const getAllSigners = await allSigners();
  return getAllSigners[0];
}

const getMetaEvidenceGuardian = () => {
  const EVIDENCE_GUARDIAN_PK = process.env.EVIDENCE_GUARDIAN_PK;
  if (!EVIDENCE_GUARDIAN_PK) throw new Error("EVIDENCE_GUARDIAN_PK not set");
  return new ethers.Wallet(EVIDENCE_GUARDIAN_PK);
};

export async function initSigners() {
  binanceSigner = await impersonateAccount(deploymentAddress.deployer);
  const getAllSigners: any = await allSigners();
  atenOwnerSigner = getAllSigners[0];
}

export async function impersonateAccount(address: string) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  return await ethers.getSigner(address);
}

// ===================== //
// === Token helpers === //
// ===================== //

export async function USDT_spenderBalance() {
  const spenderAddress = await binanceSigner.getAddress();
  return await contract.USDT.connect(binanceSigner).balanceOf(spenderAddress);
}

export async function USDT_balanceOf(address: string) {
  return await contract.USDT.connect(binanceSigner).balanceOf(address);
}

export async function USDT_transfer(address: string, amount: BigNumberish) {
  return (
    await contract.USDT.connect(binanceSigner).transfer(address, amount)
  ).wait();
}

export async function USDT_approve(
  owner: Signer,
  spender: string,
  amount: BigNumberish,
) {
  return (await contract.USDT.connect(owner).approve(spender, amount)).wait();
}

export async function USDT_maxApprove(owner: Signer, spender: string) {
  return (
    await contract.USDT.connect(owner).approve(
      spender,
      BigNumber.from(2).pow(256).sub(1),
    )
  ).wait();
}

export async function ATEN_spenderBalance() {
  const spenderAddress = await atenOwnerSigner.getAddress();
  return await contract.ATEN.connect(atenOwnerSigner).balanceOf(spenderAddress);
}

export async function ATEN_balanceOf(address: string) {
  return await contract.ATEN.connect(atenOwnerSigner).balanceOf(address);
}

export async function ATEN_transfer(address: string, amount: BigNumberish) {
  // Add 20% to cover transfer fees
  const amountForFees = BigNumber.from(amount).mul(120).div(100);

  (
    await contract.ATEN.connect(atenOwnerSigner).transfer(
      address,
      amountForFees,
    )
  ).wait();
}

export async function ATEN_approve(
  owner: Signer,
  spender: string,
  amount: BigNumberish,
) {
  return (await contract.ATEN.connect(owner).approve(spender, amount)).wait();
}

export async function getATokenBalance(user: Signer) {
  const AAVE_LENDING_POOL_CONTRACT = new Contract(
    deploymentAddress.aave_lending_pool,
    lendingPoolAbi,
    user,
  );
  const athenaAddress = contract.ATHENA.address;
  const usdtAddress = contract.USDT.address;
  // we fetch lending pool data for USDT to get aToken address
  const data = await AAVE_LENDING_POOL_CONTRACT.getReserveData(usdtAddress);
  // and now check our aToken balance in contract
  const aTokenContract = new Contract(data.aTokenAddress, weth_abi, user);
  const bal = await aTokenContract.balanceOf(athenaAddress);
  return bal;
}

export default {
  getCurrentTime,
  resetFork,
  initSigners,
  allSigners,
  deployerSigner,
  getMetaEvidenceGuardian,
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
