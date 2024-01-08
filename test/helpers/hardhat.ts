import { BaseContract, BigNumberish, Signer, Wallet, utils } from "ethers";
import hre, { ethers, network } from "hardhat";
import { HardhatNetworkConfig, HardhatRuntimeEnvironment } from "hardhat/types";

const keccak256 = utils.keccak256;
type BytesLike = utils.BytesLike;

// =============== //
// === Helpers === //
// =============== //

export async function getCurrentTime() {
  return (await ethers.provider.getBlock("latest")).timestamp;
}

export async function getCurrentBlockNumber() {
  return (await ethers.provider.getBlock("latest")).number;
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
      // console.log("=> Chain snapshot restored");
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

export async function impersonateAccount(address: string) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  return await ethers.getSigner(address);
}

// ========================== //
// === Contract addresses === //
// ========================== //

export function formatNonce(nonce: number) {
  if (nonce == 0) nonce = 1;
  const hexNonce = nonce.toString(16);
  return hexNonce.length % 2 ? `0${hexNonce}` : hexNonce;
}

export async function genContractAddress(
  signer: Wallet,
  nonceAdd = 0, // to compute futur addresses
) {
  const fromUnsigned = signer.address.slice(2);
  const nonce = await signer.getTransactionCount();
  const formatedNonce = formatNonce(nonce + nonceAdd);

  let nonceLength = "";
  if (parseInt(nonce.toString(), 16) > 127) {
    nonceLength = (128 + formatedNonce.length / 2).toString(16);
  }

  let totalLength = (
    192 + // base value of 0xc0
    21 + // nb bytes for address length + address
    nonceLength.length / 2 +
    formatedNonce.length / 2
  ).toString(16);

  return `0x${keccak256(
    `0x${totalLength}94${fromUnsigned}${nonceLength}${formatedNonce}`,
  ).slice(-40)}`;
}

export function genCreate2Address(
  from: string, // from contract address
  salt: any, // generally number
  productByteHash: BytesLike, // keccak256(artifactProduct.bytecode).slice(2)
) {
  if (from.length !== 42) throw Error("Helper: incorrect 'from' length");

  if (typeof salt !== "string") salt = salt.toString();

  const fromFormated = from.slice(2);
  const saltFormated = keccak256("0x" + salt.padStart(64, "0")).slice(2);
  const toHash = `0xff${fromFormated}${saltFormated}${productByteHash}`;

  return `0x${keccak256(toHash).slice(-40)}`;
}
