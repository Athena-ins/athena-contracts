import { BigNumberish, BigNumber, Signer, ContractTransaction } from "ethers";
import { ethers } from "hardhat";

import HardhatHelper from "./HardhatHelper";

// import { contract } from "./TypedContracts";
// import { abi as abiProtocolPool } from "../../artifacts/contracts/ProtocolPool.sol/ProtocolPool.json";
// import { ProtocolPool as typeProtocolPool } from "../../typechain/ProtocolPool";

// Functions
import { signerChainId } from "./HardhatHelper";
import {
  deployATEN,
  deployCentralizedArbitrator,
  deployAthena,
  deployProtocolFactory,
  deployPriceOracleV1,
  deployTokenVault,
  deployPositionsManager,
  deployPolicyManager,
  deployClaimManager,
  deployStakingGeneralPool,
  deployStakingPolicy,
} from "./deployers";
// Types
import {
  ATEN,
  CentralizedArbitrator,
  Athena,
  ProtocolFactory,
  PriceOracleV1,
  TokenVault,
  PositionsManager,
  PolicyManager,
  ClaimManager,
  StakingGeneralPool,
  StakingPolicy,
} from "../../typechain";

const { parseEther, parseUnits } = ethers.utils;

// =============== //
// === Helpers === //
// =============== //

export function aaveLendingPoolProviderV2Address(chainId: number): string {
  if (chainId === 1) return "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5";
  if (chainId === 5) return "0x5E52dEc931FFb32f609681B8438A51c675cc232d";
  throw Error("Unsupported chainId");
}

export function aaveLendingPoolV2Address(chainId: number): string {
  if (chainId === 1) return "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
  if (chainId === 5) return "0x4bd5643ac6f66a5237e18bfa7d47cf22f1c9f210";
  throw Error("Unsupported chainId");
}

export function toUsdt(amount: number) {
  return parseUnits(amount.toString(), 6);
}

export function toAten(amount: number) {
  return parseUnits(amount.toString(), 18);
}

export function evidenceGuardianWallet() {
  const EVIDENCE_GUARDIAN_PK = process.env.EVIDENCE_GUARDIAN_PK;
  if (!EVIDENCE_GUARDIAN_PK) throw new Error("EVIDENCE_GUARDIAN_PK not set");
  return new ethers.Wallet(EVIDENCE_GUARDIAN_PK);
}

// ======================= //
// === Deploy protocol === //
// ======================= //

type CoverRefundConfig = {
  shortCoverDuration: number;
  refundRate: number;
  basePenaltyRate: number;
  durationPenaltyRate: number;
};

export type ProtocolConfig = {
  arbitrationFee: BigNumberish;
  initialAtenPrice: BigNumberish;
  feeLevels: { atenAmount: number; feeRate: number }[];
  rewardRates: { amountSupplied: number; aprStaking: number }[];
  coverRefundConfig: CoverRefundConfig;
};

export const defaultProtocolConfig: ProtocolConfig = {
  arbitrationFee: parseEther("0.01"), // in ETH
  initialAtenPrice: parseEther("25"), // nb ATEN for $1
  feeLevels: [
    { atenAmount: 0, feeRate: 250 },
    { atenAmount: 1_000, feeRate: 200 },
    { atenAmount: 100_000, feeRate: 150 },
    { atenAmount: 1_000_000, feeRate: 50 },
  ],
  rewardRates: [
    { amountSupplied: 0, aprStaking: 1_000 },
    { amountSupplied: 10_000, aprStaking: 1_200 },
    { amountSupplied: 100_000, aprStaking: 1_600 },
    { amountSupplied: 1_000_000, aprStaking: 2_000 },
  ],
  coverRefundConfig: {
    shortCoverDuration: 180 * 24 * 60 * 60,
    refundRate: 10_000, // 10_000 = 100%
    basePenaltyRate: 1_000, // 10_000 = 100%
    durationPenaltyRate: 3_500, // 10_000 = 100%
  },
};

type ProtocolContracts = {
  ATEN: ATEN;
  CentralizedArbitrator: CentralizedArbitrator;
  Athena: Athena;
  ProtocolFactory: ProtocolFactory;
  PriceOracleV1: PriceOracleV1;
  TokenVault: TokenVault;
  PositionsManager: PositionsManager;
  PolicyManager: PolicyManager;
  ClaimManager: ClaimManager;
  StakingGeneralPool: StakingGeneralPool;
  StakingPolicy: StakingPolicy;
};

export async function deployAllContractsAndInitializeProtocol(
  deployer: Signer,
  config: ProtocolConfig,
): Promise<ProtocolContracts> {
  const chainId = await signerChainId(deployer);
  if (!chainId) throw Error("No chainId found for deployment signer");

  const ATEN = await deployATEN(deployer, []);
  const CentralizedArbitrator = await deployCentralizedArbitrator(deployer, [
    config.arbitrationFee,
  ]);

  // Deploy core
  const aaveLendingPool = aaveLendingPoolProviderV2Address(chainId);
  const Athena = await deployAthena(deployer, [ATEN.address, aaveLendingPool]);

  // Deploy peripherals
  const ProtocolFactory = await deployProtocolFactory(deployer, [
    Athena.address,
  ]);
  const PriceOracleV1 = await deployPriceOracleV1(deployer, [
    config.initialAtenPrice,
  ]);
  const TokenVault = await deployTokenVault(deployer, [
    ATEN.address,
    Athena.address,
  ]);

  // Deploy managers
  const PositionsManager = await deployPositionsManager(deployer, [
    Athena.address,
    ProtocolFactory.address,
  ]);
  const PolicyManager = await deployPolicyManager(deployer, [
    Athena.address,
    ProtocolFactory.address,
  ]);
  const evidenceGuardian = evidenceGuardianWallet();
  const ClaimManager = await deployClaimManager(deployer, [
    Athena.address,
    PolicyManager.address,
    ProtocolFactory.address,
    CentralizedArbitrator.address,
    evidenceGuardian.address,
  ]);

  // Deploy staking
  const StakingGeneralPool = await deployStakingGeneralPool(deployer, [
    ATEN.address,
    Athena.address,
    PositionsManager.address,
  ]);
  const StakingPolicy = await deployStakingPolicy(deployer, [
    Athena.address,
    ATEN.address,
    PriceOracleV1.address,
    TokenVault.address,
    PolicyManager.address,
  ]);

  await Athena.initialize(
    PositionsManager.address, // positionManager
    PolicyManager.address, // policyManager
    ClaimManager.address, // claimManager
    StakingGeneralPool.address, // stakedAtensGP
    StakingPolicy.address, // stakedAtensPo
    ProtocolFactory.address, // protocolFactory
    TokenVault.address, // atensVault
    PriceOracleV1.address, // priceOracle
  ).then((tx) => tx.wait());

  await ProtocolFactory.setClaimAndPositionManagers(
    ClaimManager.address,
    PositionsManager.address,
  );
  await StakingGeneralPool.setFeeLevelsWithAten(config.feeLevels);
  await StakingGeneralPool.setStakingRewardRates(config.rewardRates);

  await setCoverRefundConfig(deployer, StakingPolicy, config.coverRefundConfig);

  const rewardsAmount = parseEther("20000000"); // 20M ATEN
  await depositRewardsToVault(deployer, ATEN, TokenVault, rewardsAmount);

  return {
    ATEN,
    CentralizedArbitrator,
    Athena,
    ProtocolFactory,
    PriceOracleV1,
    TokenVault,
    PositionsManager,
    PolicyManager,
    ClaimManager,
    StakingGeneralPool,
    StakingPolicy,
  };
}

// ======================= //
// === Protocol config === //
// ======================= //

export async function setCoverRefundConfig(
  owner: Signer,
  contract: StakingPolicy,
  config: CoverRefundConfig,
): Promise<ContractTransaction> {
  await contract
    .connect(owner)
    .setShortCoverDuration(config.shortCoverDuration);

  return contract
    .connect(owner)
    .setRefundAndPenaltyRate(
      config.refundRate,
      config.basePenaltyRate,
      config.durationPenaltyRate,
    );
}

export async function depositRewardsToVault(
  owner: Signer,
  atenContract: ATEN,
  vaultContract: TokenVault,
  amount: BigNumberish,
): Promise<ContractTransaction> {
  await atenContract
    .connect(owner)
    .approve(vaultContract.address, BigNumber.from(amount).mul(2));
  await vaultContract.connect(owner).depositCoverRefundRewards(amount);
  return vaultContract.connect(owner).depositStakingRewards(amount);
}

// ============================ //
// === Admin action helpers === //
// ============================ //

export async function addNewProtocolPool(
  contract: Athena,
  tokenAddress: string,
  protocolPoolName: string,
  incompatiblePoolIds?: number[],
  withdrawDelay?: number,
) {
  const incompatiblePools = incompatiblePoolIds || [];
  const delay = withdrawDelay || 14 * 24 * 60 * 60;

  return contract.addNewProtocol(
    tokenAddress,
    protocolPoolName,
    incompatiblePools,
    delay,
    `bafybeiafebm3zdtzmn5mcquacgd47enhsjnebvegnzfun${protocolPoolName}`,
    BigNumber.from(75).mul(BigNumber.from(10).pow(27)), // uOptimal_
    BigNumber.from(1).mul(BigNumber.from(10).pow(27)), // r0_
    BigNumber.from(5).mul(BigNumber.from(10).pow(27)), // rSlope1_
    BigNumber.from(11).mul(BigNumber.from(10).pow(26)), // rSlope2_
  );
}

// =========================== //
// === User action helpers === //
// =========================== //

export async function deposit(
  contract: Athena,
  USDT_amount: BigNumberish,
  ATEN_amount: BigNumberish,
  protocols: number[],
  timeLapse: number,
) {
  const userAddress = await user.getAddress();

  await HardhatHelper.USDT_transfer(userAddress, USDT_amount);
  await HardhatHelper.USDT_approve(user, contract.address, USDT_amount);

  if (BigNumber.from(ATEN_amount).gt(0)) {
    await HardhatHelper.ATEN_transfer(userAddress, ATEN_amount);
    await HardhatHelper.ATEN_approve(user, contract.address, ATEN_amount);

    await (await contract.connect(user).stakeAtens(ATEN_amount)).wait();
  }

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await contract.connect(user).deposit(USDT_amount, protocols);
}

export async function buyPolicy(
  user: Signer,
  capital: BigNumberish,
  premium: BigNumberish,
  atensLocked: BigNumberish,
  poolId: number,
  timeLapse: number,
) {
  const userAddress = await user.getAddress();

  await HardhatHelper.USDT_transfer(userAddress, premium);
  await HardhatHelper.USDT_approve(user, contract.ATHENA.address, premium);

  if (BigNumber.from(atensLocked).gt(0)) {
    await HardhatHelper.ATEN_transfer(userAddress, atensLocked);
    await HardhatHelper.ATEN_approve(
      user,
      contract.ATHENA.address,
      atensLocked,
    );
  }

  if (timeLapse) {
    await HardhatHelper.setNextBlockTimestamp(timeLapse);
  }

  return await contract.ATHENA.connect(user).buyPolicies(
    [capital],
    [premium],
    [atensLocked],
    [poolId],
  );
}

export async function buyPolicies(
  user: Signer,
  capital: BigNumberish[],
  premium: BigNumberish[],
  atensLocked: BigNumberish[],
  poolId: number[],
  timeLapse: number,
) {
  const userAddress = await user.getAddress();

  const premiumTotal = premium.reduce(
    (acc: BigNumber, el) => acc.add(BigNumber.from(el)),
    BigNumber.from(0),
  );

  const atensLockedTotal = atensLocked.reduce(
    (acc: BigNumber, el) => acc.add(BigNumber.from(el)),
    BigNumber.from(0),
  );

  await HardhatHelper.USDT_transfer(userAddress, premiumTotal);
  await HardhatHelper.USDT_approve(user, contract.ATHENA.address, premiumTotal);

  if (atensLockedTotal.gt(0)) {
    await HardhatHelper.ATEN_transfer(userAddress, atensLockedTotal);
    await HardhatHelper.ATEN_approve(
      user,
      contract.ATHENA.address,
      atensLockedTotal,
    );
  }

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  return await contract.ATHENA.connect(user).buyPolicies(
    capital,
    premium,
    atensLocked,
    poolId,
  );
}

export async function createClaim(
  policyHolder: Signer,
  coverId: number,
  amountClaimed: string | number,
  valueOverride?: BigNumberish,
) {
  // Get the cost of arbitration + challenge collateral
  const [arbitrationCost, collateralAmount] = await Promise.all([
    contract.CLAIM_MANAGER.connect(policyHolder).arbitrationCost(),
    contract.CLAIM_MANAGER.connect(policyHolder).collateralAmount(),
  ]);

  const valueForTx = valueOverride || arbitrationCost.add(collateralAmount);

  const ipfsCid = "QmaRxRRcQXFRzjrr4hgBydu6QetaFr687kfd9EjtoLaSyq";

  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(ipfsCid));
  const signature = await HardhatHelper.getMetaEvidenceGuardian().signMessage(
    ethers.utils.arrayify(hash),
  );

  // Create the claim
  await contract.CLAIM_MANAGER.connect(policyHolder).initiateClaim(
    coverId,
    amountClaimed,
    ipfsCid,
    signature,
    { value: valueForTx },
  );
}

export async function resolveClaimWithoutDispute(
  policyHolder: Signer,
  coverId: number,
  timeLapse: number,
) {
  const claimIds =
    await contract.CLAIM_MANAGER.connect(policyHolder).getCoverIdToClaimIds(
      coverId,
    );

  const latestClaimId = claimIds[claimIds.length - 1];

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await contract.CLAIM_MANAGER.connect(
    policyHolder,
  ).withdrawCompensationWithoutDispute(latestClaimId);
}

export async function takeInterest(
  user: Signer,
  tokenId: BigNumberish,
  poolId: number,
  timeLapse: number,
  eventIndex: number = 0,
) {
  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  const tx = await contract.ATHENA.connect(user).takeInterest(tokenId, poolId);
  const events = (await tx.wait()).events;
  const event = events?.[eventIndex];

  if (!event) throw new Error("Event not found");
  return (await getProtocolPoolContract(user, 0)).interface.decodeEventLog(
    event.topics[0],
    event.data,
  );
}

// export async function atenAmountPostHelperTransfer(amount: BigNumberish) {
//   if (BigNumber.from(amount).eq(0)) return BigNumber.from(0);
//   return BigNumber.from(amount)
//     .mul(120)
//     .mul(99975)
//     .div(100 * 100000);
// }

export async function stakingGeneralPoolDeposit(
  user: Signer,
  amount: BigNumberish,
) {
  const userAddress = await user.getAddress();

  await HardhatHelper.ATEN_transfer(userAddress, amount);
  await HardhatHelper.ATEN_approve(user, contract.ATHENA.address, amount);

  await contract.ATHENA.connect(user).stakeAtens(amount);
}

export async function updateCover(
  user: Signer,
  action:
    | "increaseCover"
    | "decreaseCover"
    | "addPremiums"
    | "removePremiums"
    | "addToCoverRefundStake"
    | "withdrawCoverRefundStakedAten",
  coverId: BigNumberish,
  amount: BigNumberish,
) {
  const userAddress = await user.getAddress();

  if (action === "addPremiums") {
    await HardhatHelper.USDT_transfer(userAddress, amount);
    await HardhatHelper.USDT_approve(user, contract.ATHENA.address, amount);
  }
  if (action === "addToCoverRefundStake") {
    await HardhatHelper.ATEN_transfer(userAddress, amount);
    await HardhatHelper.ATEN_approve(user, contract.ATHENA.address, amount);
  }

  return await (
    await contract.ATHENA.connect(user)[action](coverId, amount)
  ).wait();
}

// ==================== //
// === View helpers === //
// ==================== //

export async function getProtocolPoolDataById(protocolPoolId: number) {
  return await contract.ATHENA.getProtocol(protocolPoolId);
}

export async function getProtocolPoolContract(user: Signer, poolId: number) {
  const protocol = await contract.ATHENA.connect(user).getProtocol(poolId);

  return new ethers.Contract(
    protocol.deployed,
    abiProtocolPool,
    user,
  ) as typeProtocolPool;
}

export async function getAllUserCovers(user: Signer) {
  return await contract.POLICY_MANAGER.connect(user).fullCoverDataByAccount(
    await user.getAddress(),
  );
}

export async function getOngoingCovers(user: Signer) {
  const allCovers = await contract.POLICY_MANAGER.connect(
    user,
  ).fullCoverDataByAccount(await user.getAddress());

  return allCovers.filter((cover) => cover.endTimestamp.eq(0));
}

export async function getExpiredCovers(user: Signer) {
  const allCovers = await contract.POLICY_MANAGER.connect(
    user,
  ).fullCoverDataByAccount(await user.getAddress());

  return allCovers.filter((cover) => !cover.endTimestamp.eq(0));
}

export async function getAccountCoverIdByIndex(user: Signer, index: number) {
  const account = await user.getAddress();
  const allCoverIds =
    await contract.POLICY_MANAGER.connect(user).allPolicyTokensOfOwner(account);

  return allCoverIds[index];
}

export async function getPoolOverlap(poolA: BigNumberish, poolB: BigNumberish) {
  const { POSITIONS_MANAGER } = contract;
  return await POSITIONS_MANAGER.getOverlappingCapital(poolA, poolB);
}

export default {
  addNewProtocolPool,
  getProtocolPoolDataById,
  getProtocolPoolContract,
  deposit,
  buyPolicy,
  buyPolicies,
  createClaim,
  resolveClaimWithoutDispute,
  depositRewardsToVault,
  takeInterest,
  stakingGeneralPoolDeposit,
  setCoverRefundConfig,
  getAllUserCovers,
  getOngoingCovers,
  getExpiredCovers,
  getAccountCoverIdByIndex,
  getPoolOverlap,
  toUsdt,
  toAten,
  updateCover,
};
