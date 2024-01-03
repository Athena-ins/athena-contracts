import { ethers } from "hardhat";
// Functions
import {
  entityProviderChainId,
  impersonateAccount,
  setNextBlockTimestamp,
} from "./hardhat";

// Types
import { BigNumber, BigNumberish, ContractTransaction, Signer } from "ethers";
import {
  ClaimManager,
  ERC20,
  ERC20__factory,
  ILendingPool__factory,
  IUniswapV2Factory__factory,
  //
  ATEN,
  Athena,
  PolicyManager,
  PositionsManager,
  ProtocolPool,
  ProtocolPool__factory,
  StakingPolicy,
  TokenVault,
} from "../../typechain";
import { ProtocolContracts } from "./deployers";

const { parseEther, parseUnits } = ethers.utils;

// =============== //
// === Helpers === //
// =============== //

export function toUsdt(amount: number) {
  return parseUnits(amount.toString(), 6);
}

export function toAten(amount: number) {
  return parseUnits(amount.toString(), 18);
}

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

export function uniswapV2Factory(chainId: number): string {
  if (chainId === 1) return "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
  if (chainId === 5) return "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
  throw Error("Unsupported chainId");
}

export function usdtTokenAddress(chainId: number): string {
  if (chainId === 1) return "0xdac17f958d2ee523a2206206994597c13d831ec7";
  if (chainId === 5) return "0x65E2fe35C30eC218b46266F89847c63c2eDa7Dc7";
  throw Error("Unsupported chainId");
}

export function klerosCourtAddress(chainId: number): string {
  if (chainId === 1) return "0x988b3a538b618c7a603e1c11ab82cd16dbe28069";
  throw Error("Unsupported chainId");
}

export function wethTokenAddress(chainId: number): string {
  if (chainId === 1) return "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  if (chainId === 5) return "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";
  throw Error("Unsupported chainId");
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

// ===================== //
// === Token helpers === //
// ===================== //

async function transfer<T extends ERC20>(
  contract: T,
  signer: Signer,
  ...args: Parameters<ERC20["transfer"]>
) {
  return contract
    .connect(signer)
    .transfer(...args)
    .then((tx) => tx.wait());
}

async function approve<T extends ERC20>(
  contract: T,
  signer: Signer,
  ...args: Parameters<ERC20["approve"]>
) {
  return contract
    .connect(signer)
    .approve(...args)
    .then((tx) => tx.wait());
}

async function maxApprove<T extends ERC20>(
  contract: T,
  signer: Signer,
  spender: string,
) {
  return contract
    .connect(signer)
    .approve(spender, BigNumber.from(2).pow(256))
    .then((tx) => tx.wait());
}

async function getTokens(
  signer: Signer,
  token: string,
  to: string,
  amount: BigNumberish,
) {
  const chainId = await entityProviderChainId(signer);

  const uniswapFactory = uniswapV2Factory(chainId);
  const dexFactory = IUniswapV2Factory__factory.connect(uniswapFactory, signer);

  const wethAddress = wethTokenAddress(chainId);
  const pool = await dexFactory.getPair(token, wethAddress);
  const poolSigner = await impersonateAccount(pool);

  return ERC20__factory.connect(token, poolSigner)
    .transfer(to, amount)
    .then((tx) => tx.wait());
}

// ======================= //
// === Protocol config === //
// ======================= //

type CoverRefundConfig = {
  shortCoverDuration: number;
  refundRate: number;
  basePenaltyRate: number;
  durationPenaltyRate: number;
};

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

async function addNewProtocolPool(
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

async function deposit(
  contract: Athena,
  tokenHelpers: TokenHelpers,
  user: Signer,
  USDT_amount: BigNumberish,
  ATEN_amount: BigNumberish,
  protocols: number[],
  timeLapse: number,
) {
  const account = await user.getAddress();

  await tokenHelpers.getUsdt(account, USDT_amount);
  await tokenHelpers.approveUsdt(user, contract.address, USDT_amount);

  if (BigNumber.from(ATEN_amount).gt(0)) {
    await tokenHelpers.getAten(account, ATEN_amount);
    await tokenHelpers.approveAten(user, contract.address, ATEN_amount);

    await (await contract.connect(user).stakeAtens(ATEN_amount)).wait();
  }

  await setNextBlockTimestamp(timeLapse);

  await contract.connect(user).deposit(USDT_amount, protocols);
}

async function buyPolicy(
  contract: Athena,
  tokenHelpers: TokenHelpers,
  user: Signer,
  capital: BigNumberish,
  premium: BigNumberish,
  atensLocked: BigNumberish,
  poolId: number,
  timeLapse: number,
) {
  const account = await user.getAddress();

  await tokenHelpers.getUsdt(account, premium);
  await tokenHelpers.approveUsdt(user, contract.address, premium);

  if (BigNumber.from(atensLocked).gt(0)) {
    await tokenHelpers.getAten(account, atensLocked);
    await tokenHelpers.approveAten(user, contract.address, atensLocked);
  }

  if (timeLapse) {
    await setNextBlockTimestamp(timeLapse);
  }

  return await contract
    .connect(user)
    .buyPolicies([capital], [premium], [atensLocked], [poolId]);
}

async function buyPolicies(
  contract: Athena,
  tokenHelpers: TokenHelpers,
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

  await tokenHelpers.getUsdt(account, premiumTotal);
  await tokenHelpers.approveUsdt(user, contract.address, premiumTotal);

  if (atensLockedTotal.gt(0)) {
    await tokenHelpers.getAten(account, atensLockedTotal);
    await tokenHelpers.approveAten(user, contract.address, atensLockedTotal);
  }

  await setNextBlockTimestamp(timeLapse);

  return await contract
    .connect(user)
    .buyPolicies(capital, premium, atensLocked, poolId);
}

async function createClaim(
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

async function resolveClaimWithoutDispute(
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

async function takeInterest(
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

async function stakingGeneralPoolDeposit(
  contract: Athena,
  tokenHelpers: TokenHelpers,
  user: Signer,
  amount: BigNumberish,
) {
  const account = await user.getAddress();

  await tokenHelpers.getAten(account, amount);
  await tokenHelpers.approveAten(user, contract.address, amount);

  return contract.connect(user).stakeAtens(amount);
}

async function updateCover(
  contract: Athena,
  tokenHelpers: TokenHelpers,
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
    await tokenHelpers.getUsdt(account, amount);
    await tokenHelpers.approveUsdt(user, contract.address, amount);
  }
  if (action === "addToCoverRefundStake") {
    await tokenHelpers.getAten(account, amount);
    await tokenHelpers.approveAten(user, contract.address, amount);
  }

  return (await contract.connect(user)[action](coverId, amount)).wait();
}

// ==================== //
// === View helpers === //
// ==================== //

async function getProtocolPoolDataById(
  contract: Athena,
  protocolPoolId: number,
) {
  return contract.getProtocol(protocolPoolId);
}

async function getProtocolPoolContract(
  contract: Athena,
  user: Signer,
  poolId: number,
): Promise<ProtocolPool> {
  const poolInfo = await contract.connect(user).getProtocol(poolId);
  return ProtocolPool__factory.connect(poolInfo.deployed, user);
}

async function getAllUserCovers(contract: PolicyManager, user: Signer) {
  const account = await user.getAddress();
  return contract.connect(user).fullCoverDataByAccount(account);
}

async function getOngoingCovers(contract: PolicyManager, user: Signer) {
  const account = await user.getAddress();
  const allCovers = await contract
    .connect(user)
    .fullCoverDataByAccount(account);

  return allCovers.filter((cover) => cover.endTimestamp.eq(0));
}

async function getExpiredCovers(contract: PolicyManager, user: Signer) {
  const account = await user.getAddress();
  const allCovers = await contract
    .connect(user)
    .fullCoverDataByAccount(account);

  return allCovers.filter((cover) => !cover.endTimestamp.eq(0));
}

async function getAccountCoverIdByIndex(
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

async function getPoolOverlap(
  contract: PositionsManager,
  poolA: BigNumberish,
  poolB: BigNumberish,
) {
  return contract.getOverlappingCapital(poolA, poolB);
}

// ============================ //
// === Test context helpers === //
// ============================ //

type OmitFirstArg<T extends (...args: any) => any> = T extends (
  ...args: [any, ...infer U]
) => infer R
  ? (...args: U) => R
  : never;

type OmitFirstTwoArgs<T extends (...args: any) => any> = T extends (
  ...args: [any, any, ...infer U]
) => infer R
  ? (...args: U) => R
  : never;

// Token
type TokenHelpers = {
  transferAten: OmitFirstArg<typeof transfer>;
  transferUsdt: OmitFirstArg<typeof transfer>;
  approveAten: OmitFirstArg<typeof approve>;
  approveUsdt: OmitFirstArg<typeof approve>;
  maxApproveAten: OmitFirstArg<typeof maxApprove>;
  maxApproveUsdt: OmitFirstArg<typeof maxApprove>;
  balanceOfAaveUsdt: OmitFirstArg<typeof balanceOfAaveUsdt>;
  getUsdt: OmitFirstTwoArgs<typeof getTokens>;
  getAten: OmitFirstTwoArgs<typeof transfer>;
};

export type TestHelper = TokenHelpers & {
  // config / admin
  addNewProtocolPool: OmitFirstArg<typeof addNewProtocolPool>;
  // write
  deposit: OmitFirstTwoArgs<typeof deposit>;
  buyPolicy: OmitFirstTwoArgs<typeof buyPolicy>;
  buyPolicies: OmitFirstTwoArgs<typeof buyPolicies>;
  createClaim: OmitFirstArg<typeof createClaim>;
  resolveClaimWithoutDispute: OmitFirstArg<typeof resolveClaimWithoutDispute>;
  takeInterest: OmitFirstArg<typeof takeInterest>;
  stakingGeneralPoolDeposit: OmitFirstTwoArgs<typeof stakingGeneralPoolDeposit>;
  updateCover: OmitFirstTwoArgs<typeof updateCover>;
  // read
  getProtocolPoolDataById: OmitFirstArg<typeof getProtocolPoolDataById>;
  getProtocolPoolContract: OmitFirstArg<typeof getProtocolPoolContract>;
  getAllUserCovers: OmitFirstArg<typeof getAllUserCovers>;
  getOngoingCovers: OmitFirstArg<typeof getOngoingCovers>;
  getExpiredCovers: OmitFirstArg<typeof getExpiredCovers>;
  getAccountCoverIdByIndex: OmitFirstArg<typeof getAccountCoverIdByIndex>;
  getPoolOverlap: OmitFirstArg<typeof getPoolOverlap>;
};

export async function makeTestHelpers(
  deployer: Signer,
  contracts: ProtocolContracts,
): Promise<TestHelper> {
  const { ATEN, USDT, Athena, PositionsManager, PolicyManager, ClaimManager } =
    contracts;

  const tokenHelpers: TokenHelpers = {
    transferAten: (...args) => transfer(ATEN, ...args),
    transferUsdt: (...args) => transfer(USDT, ...args),
    approveAten: (...args) => approve(ATEN, ...args),
    approveUsdt: (...args) => approve(USDT, ...args),
    maxApproveAten: (...args) => maxApprove(ATEN, ...args),
    maxApproveUsdt: (...args) => maxApprove(USDT, ...args),
    balanceOfAaveUsdt: (...args) => balanceOfAaveUsdt(deployer, ...args),
    getUsdt: (...args) => getTokens(deployer, USDT.address, ...args),
    getAten: (...args) => transfer(ATEN, deployer, ...args),
  };

  return {
    // config / admin
    addNewProtocolPool: (...args) => addNewProtocolPool(Athena, ...args),
    // write
    deposit: (...args) => deposit(Athena, tokenHelpers, ...args),
    buyPolicy: (...args) => buyPolicy(Athena, tokenHelpers, ...args),
    buyPolicies: (...args) => buyPolicies(Athena, tokenHelpers, ...args),
    createClaim: (...args) => createClaim(ClaimManager, ...args),
    resolveClaimWithoutDispute: (...args) =>
      resolveClaimWithoutDispute(ClaimManager, ...args),
    takeInterest: (...args) => takeInterest(Athena, ...args),
    stakingGeneralPoolDeposit: (...args) =>
      stakingGeneralPoolDeposit(Athena, tokenHelpers, ...args),
    updateCover: (...args) => updateCover(Athena, tokenHelpers, ...args),
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
    ...tokenHelpers,
  };
}
