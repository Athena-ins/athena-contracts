import { BigNumberish, BigNumber, Signer, ContractTransaction } from "ethers";
import { ethers } from "hardhat";

import HardhatHelper from "./hardhat";

// Functions
import {
  entityProviderChainId,
  setNextBlockTimestamp,
  transfer,
  approve,
  maxApprove,
} from "./hardhat";
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
  ProtocolPool,
  USDT,
  //
  ProtocolPool__factory,
  USDT__factory,
  ERC20__factory,
  ILendingPool__factory,
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

export function usdtTokenAddress(chainId: number): string {
  if (chainId === 1) return "0xdac17f958d2ee523a2206206994597c13d831ec7";
  if (chainId === 5) return "0x65E2fe35C30eC218b46266F89847c63c2eDa7Dc7";
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

export async function balanceOfAaveUsdt(
  signer: Signer,
  account: string | Signer,
): Promise<BigNumber> {
  const chainId = await entityProviderChainId(signer);

  const lendingPoolAddress = aaveLendingPoolV2Address(chainId);
  const lendingPoolContract = ILendingPool__factory.connect(
    lendingPoolAddress,
    signer,
  );

  const usdtAddress = usdtTokenAddress(chainId);
  const { aTokenAddress } =
    await lendingPoolContract.getReserveData(usdtAddress);
  const accountAddress =
    typeof account === "string" ? account : await account.getAddress();

  return ERC20__factory.connect(aTokenAddress, signer).balanceOf(
    accountAddress,
  );
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

export type ProtocolContracts = {
  ATEN: ATEN;
  USDT: USDT;
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
  const chainId = await entityProviderChainId(deployer);
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

  // Add USDT interface
  const usdtAddress = usdtTokenAddress(chainId);
  const USDT = USDT__factory.connect(usdtAddress, deployer);

  return {
    ATEN,
    USDT,
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
  protocolPoolName: string,
  tokenAddress?: string,
  incompatiblePoolIds: number[] = [],
  withdrawDelay: number = 14 * 24 * 60 * 60,
) {
  const chainId = await entityProviderChainId(contract);
  const asset = tokenAddress || usdtTokenAddress(chainId);

  return contract.addNewProtocol(
    asset,
    protocolPoolName,
    incompatiblePoolIds,
    withdrawDelay,
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
  user: Signer,
  USDT_amount: BigNumberish,
  ATEN_amount: BigNumberish,
  protocols: number[],
  timeLapse: number,
) {
  const account = await user.getAddress();

  await HardhatHelper.USDT_transfer(account, USDT_amount);
  await HardhatHelper.USDT_approve(user, contract.address, USDT_amount);

  if (BigNumber.from(ATEN_amount).gt(0)) {
    await HardhatHelper.ATEN_transfer(account, ATEN_amount);
    await HardhatHelper.ATEN_approve(user, contract.address, ATEN_amount);

    await (await contract.connect(user).stakeAtens(ATEN_amount)).wait();
  }

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await contract.connect(user).deposit(USDT_amount, protocols);
}

export async function buyPolicy(
  contract: Athena,
  user: Signer,
  capital: BigNumberish,
  premium: BigNumberish,
  atensLocked: BigNumberish,
  poolId: number,
  timeLapse: number,
) {
  const account = await user.getAddress();

  await HardhatHelper.USDT_transfer(account, premium);
  await HardhatHelper.USDT_approve(user, contract.address, premium);

  if (BigNumber.from(atensLocked).gt(0)) {
    await HardhatHelper.ATEN_transfer(account, atensLocked);
    await HardhatHelper.ATEN_approve(user, contract.address, atensLocked);
  }

  if (timeLapse) {
    await setNextBlockTimestamp(timeLapse);
  }

  return await contract
    .connect(user)
    .buyPolicies([capital], [premium], [atensLocked], [poolId]);
}

export async function buyPolicies(
  contract: Athena,
  user: Signer,
  capital: BigNumberish[],
  premium: BigNumberish[],
  atensLocked: BigNumberish[],
  poolId: number[],
  timeLapse: number,
) {
  const account = await user.getAddress();

  const premiumTotal = premium.reduce(
    (acc: BigNumber, el) => acc.add(BigNumber.from(el)),
    BigNumber.from(0),
  );

  const atensLockedTotal = atensLocked.reduce(
    (acc: BigNumber, el) => acc.add(BigNumber.from(el)),
    BigNumber.from(0),
  );

  await HardhatHelper.USDT_transfer(account, premiumTotal);
  await HardhatHelper.USDT_approve(user, contract.address, premiumTotal);

  if (atensLockedTotal.gt(0)) {
    await HardhatHelper.ATEN_transfer(account, atensLockedTotal);
    await HardhatHelper.ATEN_approve(user, contract.address, atensLockedTotal);
  }

  await setNextBlockTimestamp(timeLapse);

  return await contract
    .connect(user)
    .buyPolicies(capital, premium, atensLocked, poolId);
}

export async function createClaim(
  contract: ClaimManager,
  policyHolder: Signer,
  coverId: number,
  amountClaimed: string | number,
  valueOverride?: BigNumberish,
) {
  // Get the cost of arbitration + challenge collateral
  const [arbitrationCost, collateralAmount] = await Promise.all([
    contract.connect(policyHolder).arbitrationCost(),
    contract.connect(policyHolder).collateralAmount(),
  ]);

  const valueForTx = valueOverride || arbitrationCost.add(collateralAmount);

  const ipfsCid = "QmaRxRRcQXFRzjrr4hgBydu6QetaFr687kfd9EjtoLaSyq";

  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(ipfsCid));
  const signature = await evidenceGuardianWallet().signMessage(
    ethers.utils.arrayify(hash),
  );

  // Create the claim
  await contract
    .connect(policyHolder)
    .initiateClaim(coverId, amountClaimed, ipfsCid, signature, {
      value: valueForTx,
    });
}

export async function resolveClaimWithoutDispute(
  contract: ClaimManager,
  policyHolder: Signer,
  coverId: number,
  timeLapse: number,
) {
  const claimIds = await contract
    .connect(policyHolder)
    .getCoverIdToClaimIds(coverId);

  const latestClaimId = claimIds[claimIds.length - 1];

  await setNextBlockTimestamp(timeLapse);

  await contract
    .connect(policyHolder)
    .withdrawCompensationWithoutDispute(latestClaimId);
}

export async function takeInterest(
  contract: Athena,
  user: Signer,
  tokenId: BigNumberish,
  poolId: number,
  timeLapse: number,
  eventIndex: number = 0,
) {
  await setNextBlockTimestamp(timeLapse);

  const txReceipt = await contract
    .connect(user)
    .takeInterest(tokenId, poolId)
    .then((tx) => tx.wait());

  const event = txReceipt.events?.[eventIndex];
  if (!event) throw new Error("Event not found");

  return (
    await getProtocolPoolContract(contract, user, 0)
  ).interface.decodeEventLog(event.topics[0], event.data);
}

export async function stakingGeneralPoolDeposit(
  contract: Athena,
  user: Signer,
  amount: BigNumberish,
) {
  const account = await user.getAddress();

  await HardhatHelper.ATEN_transfer(account, amount);
  await HardhatHelper.ATEN_approve(user, contract.address, amount);

  return contract.connect(user).stakeAtens(amount);
}

export async function updateCover(
  contract: Athena,
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
  const account = await user.getAddress();

  if (action === "addPremiums") {
    await HardhatHelper.USDT_transfer(account, amount);
    await HardhatHelper.USDT_approve(user, contract.address, amount);
  }
  if (action === "addToCoverRefundStake") {
    await HardhatHelper.ATEN_transfer(account, amount);
    await HardhatHelper.ATEN_approve(user, contract.address, amount);
  }

  return (await contract.connect(user)[action](coverId, amount)).wait();
}

// ==================== //
// === View helpers === //
// ==================== //

export async function getProtocolPoolDataById(
  contract: Athena,
  protocolPoolId: number,
) {
  return contract.getProtocol(protocolPoolId);
}

export async function getProtocolPoolContract(
  contract: Athena,
  user: Signer,
  poolId: number,
): Promise<ProtocolPool> {
  const poolInfo = await contract.connect(user).getProtocol(poolId);
  return ProtocolPool__factory.connect(poolInfo.deployed, user);
}

export async function getAllUserCovers(contract: PolicyManager, user: Signer) {
  const account = await user.getAddress();
  return contract.connect(user).fullCoverDataByAccount(account);
}

export async function getOngoingCovers(contract: PolicyManager, user: Signer) {
  const account = await user.getAddress();
  const allCovers = await contract
    .connect(user)
    .fullCoverDataByAccount(account);

  return allCovers.filter((cover) => cover.endTimestamp.eq(0));
}

export async function getExpiredCovers(contract: PolicyManager, user: Signer) {
  const account = await user.getAddress();
  const allCovers = await contract
    .connect(user)
    .fullCoverDataByAccount(account);

  return allCovers.filter((cover) => !cover.endTimestamp.eq(0));
}

export async function getAccountCoverIdByIndex(
  contract: PolicyManager,
  user: Signer,
  index: number,
) {
  const account = await user.getAddress();
  const allCoverIds = await contract
    .connect(user)
    .allPolicyTokensOfOwner(account);

  return allCoverIds[index];
}

export async function getPoolOverlap(
  contract: PositionsManager,
  poolA: BigNumberish,
  poolB: BigNumberish,
) {
  return contract.getOverlappingCapital(poolA, poolB);
}

// ============================ //
// === Test context helpers === //
// ============================ //

type OmitContract<T extends (...args: any) => any> = T extends (
  ...args: [any, ...infer U]
) => infer R
  ? (...args: U) => R
  : never;

export type TestHelper = {
  // config / admin
  addNewProtocolPool: OmitContract<typeof addNewProtocolPool>;
  // write
  deposit: OmitContract<typeof deposit>;
  buyPolicy: OmitContract<typeof buyPolicy>;
  buyPolicies: OmitContract<typeof buyPolicies>;
  createClaim: OmitContract<typeof createClaim>;
  resolveClaimWithoutDispute: OmitContract<typeof resolveClaimWithoutDispute>;
  takeInterest: OmitContract<typeof takeInterest>;
  stakingGeneralPoolDeposit: OmitContract<typeof stakingGeneralPoolDeposit>;
  updateCover: OmitContract<typeof updateCover>;
  // read
  getProtocolPoolDataById: OmitContract<typeof getProtocolPoolDataById>;
  getProtocolPoolContract: OmitContract<typeof getProtocolPoolContract>;
  getAllUserCovers: OmitContract<typeof getAllUserCovers>;
  getOngoingCovers: OmitContract<typeof getOngoingCovers>;
  getExpiredCovers: OmitContract<typeof getExpiredCovers>;
  getAccountCoverIdByIndex: OmitContract<typeof getAccountCoverIdByIndex>;
  getPoolOverlap: OmitContract<typeof getPoolOverlap>;
  // Token
  transferAten: OmitContract<typeof transfer>;
  transferUsdt: OmitContract<typeof transfer>;
  approveAten: OmitContract<typeof approve>;
  approveUsdt: OmitContract<typeof approve>;
  maxApproveAten: OmitContract<typeof maxApprove>;
  maxApproveUsdt: OmitContract<typeof maxApprove>;
  balanceOfAaveUsdt: OmitContract<typeof balanceOfAaveUsdt>;
  //
  getATENContract: () => ATEN;
  getCentralizedArbitratorContract: () => CentralizedArbitrator;
  getAthenaContract: () => Athena;
  getProtocolFactoryContract: () => ProtocolFactory;
  getPriceOracleV1Contract: () => PriceOracleV1;
  getTokenVaultContract: () => TokenVault;
  getPositionsManagerContract: () => PositionsManager;
  getPolicyManagerContract: () => PolicyManager;
  getClaimManagerContract: () => ClaimManager;
  getStakingGeneralPoolContract: () => StakingGeneralPool;
  getStakingPolicyContract: () => StakingPolicy;
  //
};

export async function makeTestHelpers(
  deployer: Signer,
  contracts: ProtocolContracts,
): Promise<TestHelper> {
  const {
    ATEN,
    USDT,
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
  } = contracts;

  return {
    // config / admin
    addNewProtocolPool: (...args) => addNewProtocolPool(Athena, ...args),
    // write
    deposit: (...args) => deposit(Athena, ...args),
    buyPolicy: (...args) => buyPolicy(Athena, ...args),
    buyPolicies: (...args) => buyPolicies(Athena, ...args),
    createClaim: (...args) => createClaim(ClaimManager, ...args),
    resolveClaimWithoutDispute: (...args) =>
      resolveClaimWithoutDispute(ClaimManager, ...args),
    takeInterest: (...args) => takeInterest(Athena, ...args),
    stakingGeneralPoolDeposit: (...args) =>
      stakingGeneralPoolDeposit(Athena, ...args),
    updateCover: (...args) => updateCover(Athena, ...args),
    // read
    getProtocolPoolDataById: (...args) =>
      getProtocolPoolDataById(Athena, ...args),
    getProtocolPoolContract: (...args) =>
      getProtocolPoolContract(Athena, ...args),
    getAllUserCovers: (...args) => getAllUserCovers(PolicyManager, ...args),
    getOngoingCovers: (...args) => getOngoingCovers(PolicyManager, ...args),
    getExpiredCovers: (...args) => getExpiredCovers(PolicyManager, ...args),
    getAccountCoverIdByIndex: (...args) =>
      getAccountCoverIdByIndex(PolicyManager, ...args),
    getPoolOverlap: (...args) => getPoolOverlap(PositionsManager, ...args),
    // Token
    transferAten: (...args) => transfer(ATEN, ...args),
    transferUsdt: (...args) => transfer(USDT, ...args),
    approveAten: (...args) => approve(ATEN, ...args),
    approveUsdt: (...args) => approve(USDT, ...args),
    maxApproveAten: (...args) => maxApprove(ATEN, ...args),
    maxApproveUsdt: (...args) => maxApprove(USDT, ...args),
    balanceOfAaveUsdt: (...args) => balanceOfAaveUsdt(deployer, ...args),
    //
    getATENContract: () => ATEN,
    getCentralizedArbitratorContract: () => CentralizedArbitrator,
    getAthenaContract: () => Athena,
    getProtocolFactoryContract: () => ProtocolFactory,
    getPriceOracleV1Contract: () => PriceOracleV1,
    getTokenVaultContract: () => TokenVault,
    getPositionsManagerContract: () => PositionsManager,
    getPolicyManagerContract: () => PolicyManager,
    getClaimManagerContract: () => ClaimManager,
    getStakingGeneralPoolContract: () => StakingGeneralPool,
    getStakingPolicyContract: () => StakingPolicy,
  };
}
