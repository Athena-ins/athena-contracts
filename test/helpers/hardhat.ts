import {
  BaseContract,
  BigNumberish,
  ContractTransaction,
  Signer,
  Wallet,
  utils,
} from "ethers";
import hre, { ethers, network } from "hardhat";
import { HardhatNetworkConfig, HardhatRuntimeEnvironment } from "hardhat/types";
import { ERC20__factory } from "../../typechain";
import { BigNumber } from "ethers";

const { keccak256 } = utils;
const { MaxUint256 } = ethers.constants;
type BytesLike = utils.BytesLike;

// ================ //
// === Accounts === //
// ================ //

export function deployerWallet() {
  const DEPLOYER_PK = process.env.DEPLOYER_PK;
  if (!DEPLOYER_PK) throw new Error("DEPLOYER_PK not set");
  return new ethers.Wallet(DEPLOYER_PK, getProviderFromHardhat());
}

export function evidenceGuardianWallet() {
  const EVIDENCE_GUARDIAN_PK = process.env.EVIDENCE_GUARDIAN_PK;
  if (!EVIDENCE_GUARDIAN_PK) throw new Error("EVIDENCE_GUARDIAN_PK not set");
  return new ethers.Wallet(EVIDENCE_GUARDIAN_PK, getProviderFromHardhat());
}

export function buybackWallet() {
  const BUYBACK_PK = process.env.BUYBACK_PK;
  if (!BUYBACK_PK) throw new Error("BUYBACK_PK not set");
  return new ethers.Wallet(BUYBACK_PK, getProviderFromHardhat());
}

export function treasuryWallet() {
  const TREASURY_PK = process.env.TREASURY_PK;
  if (!TREASURY_PK) throw new Error("TREASURY_PK not set");
  return new ethers.Wallet(TREASURY_PK, getProviderFromHardhat());
}

export function leverageRiskWallet() {
  const RISK_GUARD_PK = process.env.RISK_GUARD_PK;
  if (!RISK_GUARD_PK) throw new Error("RISK_GUARD_PK not set");
  return new ethers.Wallet(RISK_GUARD_PK, getProviderFromHardhat());
}

// =============== //
// === Helpers === //
// =============== //

export function isNonNullAddress(address: string | undefined): boolean {
  return !!address && address !== ethers.constants.AddressZero;
}

function getProviderFromHardhat() {
  return hre.ethers.provider;
}

export function fromFork() {
  const networkName = hre.network.name.toLowerCase();
  const forkTarget = process.env.HARDHAT_FORK_TARGET?.toLowerCase();

  // Checks that the target chain has adequate configuration
  if (networkName !== "hardhat" && forkTarget !== networkName) {
    throw Error("Target chain mismatch");
  }

  if (!forkTarget) {
    throw Error("Missing or erroneous fork target");
  }

  return forkTarget;
}

export async function postTxHandler(txPromise: Promise<ContractTransaction>) {
  return txPromise
    .then((tx) => tx.wait())
    .catch((err) => {
      let info = "";
      const customError = extractError(err, false);
      if (customError) info += `Custom error: ${customError}\n`;
      if (err.tx) info += `Transaction: ${JSON.stringify(err.tx, null, 2)}\n`;

      throw Error(
        `POST TX\n${info}${err.reason || err.name || err.message || err}`.red,
      );
    });
}

export async function getCurrentTime() {
  return (await ethers.provider.getBlock("latest")).timestamp;
}

export async function getCurrentBlockNumber() {
  return (await ethers.provider.getBlock("latest")).number;
}

export async function getTxCount(address: string): Promise<number> {
  return ethers.provider.getTransactionCount(address);
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

function extractError(err: any, requireError = false) {
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

// Gets the custom Solidity error on tx revert
export async function getCustomError(
  txPromise: Promise<any>,
  requireError = true,
): Promise<string> {
  try {
    await txPromise;
    throw Error("Transaction did not throw");
  } catch (err: any) {
    return extractError(err, requireError);
  }
}

// ========================== //
// === Chain manipulation === //
// ========================== //

export async function evmSnapshot(): Promise<string> {
  return hre.ethers.provider.send("evm_snapshot", []) as Promise<string>;
}
export async function evmRevert(snapshotId: string) {
  return hre.ethers.provider.send("evm_revert", [snapshotId]).then(() => {
    // console.log("=> Chain snapshot restored");
  });
}

export type TimeTravelOptions = {
  seconds?: number;
  minutes?: number;
  hours?: number;
  days?: number;
  months?: number;
};

export async function setNextBlockTimestamp(timeToAdd: TimeTravelOptions) {
  const secondsToAdd =
    (timeToAdd.seconds || 0) +
    (timeToAdd.minutes || 0) * 60 +
    (timeToAdd.hours || 0) * 60 * 60 +
    (timeToAdd.days || 0) * 60 * 60 * 24 +
    (timeToAdd.months || 0) * 60 * 60 * 24 * 30;

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
  const hexNonce = nonce.toString(16);
  return hexNonce.length % 2 ? `0${hexNonce}` : hexNonce;
}

export async function genContractAddress(
  signer: Wallet | string,
  nonceAdd = 0, // to compute futur addresses
): Promise<string> {
  const [fromUnsigned, nonce] =
    typeof signer === "string"
      ? [signer, await getTxCount(signer)]
      : [signer.address, await signer.getTransactionCount()];

  const formatedNonce = formatNonce(nonce + nonceAdd);

  // Handle the special case for nonce 0
  if (formatedNonce === "00") {
    return `0x${keccak256(`0xd694${fromUnsigned.slice(2)}80`).slice(-40)}`;
  }

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
    `0x${totalLength}94${fromUnsigned.slice(2)}${nonceLength}${formatedNonce}`,
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

// ============== //
// === Tokens === //
// ============== //

// @dev allow usage of special term "max" for max uint256 value
export async function convertToCurrencyDecimals(
  tokenAddress: string,
  amount: BigNumberish | "maxUint",
): Promise<BigNumber> {
  if (amount === "maxUint") return MaxUint256;

  const token = ERC20__factory.connect(tokenAddress, getProviderFromHardhat());
  let decimals = (await token.decimals()).toString();

  return ethers.utils.parseUnits(amount.toString(), decimals);
}
