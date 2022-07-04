import hre, { ethers as hre_ethers } from "hardhat";

let currentTime = 1646220000;

async function reset() {
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

  currentTime = 1646220000;
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

export default {
  getCurrentTime,
  reset,
  allSigners,
  impersonateAccount,
  setNextBlockTimestamp,
};
