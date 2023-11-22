import { BaseContract, BigNumber, Signer } from "ethers";
import hre, { ethers, network } from "hardhat";
import { HardhatNetworkConfig } from "hardhat/types";
import { ERC20 } from "../../typechain";

// =============== //
// === Helpers === //
// =============== //

export async function getCurrentTime() {
  return (await ethers.provider.getBlock("latest")).timestamp;
}

export function entityProviderChainId(
  entity: Signer | BaseContract,
): Promise<number> {
  const chainId = entity.provider
    ?.getNetwork()
    .then((network) => network.chainId);

  if (!chainId) {
    throw Error("Could not get chainId from entity's provider");
  } else {
    return chainId;
  }
}

// Gets the custom Solidity error on tx revert
export async function getCustomError(
  txPromise: Promise<any>,
  requireError = true,
): Promise<string> {
  try {
    await txPromise;
    throw Error("Transaction did not throw");
  } catch (err: any) {
    if (err.errorName) {
      return err.errorName;
    }
    if (err.reason?.includes("reverted with custom error")) {
      return err.reason.slice(
        err.reason.indexOf("reverted with custom error") + 28,
        err.reason.length - 3,
      );
    }

    // For tests we generally want to verify the presence of the custom error
    if (requireError) {
      throw Error(`Transaction did not revert with custom error: ${err}`);
    } else {
      return "";
    }
  }
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

export async function allSigners() {
  return await ethers.getSigners();
}

export async function impersonateAccount(address: string) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  return await ethers.getSigner(address);
}
