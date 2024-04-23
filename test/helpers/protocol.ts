import { ethers } from "hardhat";
// Functions
import {
  entityProviderChainId,
  impersonateAccount,
  setNextBlockTimestamp,
  postTxHandler,
  getCurrentTime,
} from "./hardhat";
import { defaultProtocolConfig } from "./deployers";
// Types
import {
  BigNumber,
  BigNumberish,
  ContractTransaction,
  ContractReceipt,
  Wallet,
} from "ethers";
import {
  // Dao
  EcclesiaDao,
  // Claims
  MockArbitrator,
  // Managers
  ClaimManager,
  LiquidityManager,
  StrategyManager,
  // Rewards
  FarmingRange,
  RewardManager,
  Staking,
  // Tokens
  AthenaCoverToken,
  AthenaPositionToken,
  AthenaToken,
  // Other
  TetherToken,
  IERC20,
  IERC20__factory,
  ILendingPool__factory,
  IUniswapV2Factory__factory,
  IWETH__factory,
  IUniswapV2Router__factory,
} from "../../typechain";
import { ProtocolContracts } from "./deployers";

const { parseEther, parseUnits } = ethers.utils;

// =============== //
// === Helpers === //
// =============== //

export function toUsd(amount: number) {
  return parseUnits(amount.toString(), 6);
}

export function toErc20(amount: number) {
  return parseUnits(amount.toString(), 18);
}

export function makeIdArray(length: number) {
  return [...Array(length).keys()];
}

export function aaveLendingPoolProviderV2Address(chainId: number): string {
  if (chainId === 1)
    return "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5".toLowerCase();
  if (chainId === 5)
    return "0x5E52dEc931FFb32f609681B8438A51c675cc232d".toLowerCase();
  throw Error("Unsupported chainId");
}

export function aaveLendingPoolV2Address(chainId: number): string {
  if (chainId === 1)
    return "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9".toLowerCase();
  if (chainId === 5)
    return "0x4bd5643ac6f66a5237e18bfa7d47cf22f1c9f210".toLowerCase();
  throw Error("Unsupported chainId");
}

export function uniswapV2Factory(chainId: number): string {
  if (chainId === 1)
    return "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f".toLowerCase();
  // if (chainId === 5) return "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f".toLowerCase();
  throw Error("Unsupported chainId");
}

export function uniswapV2Router(chainId: number): string {
  if (chainId === 1)
    return "0x7a250d5630b4cf539739df2c5dacb4c659f2488d".toLowerCase();
  // if (chainId === 5) return "0x7a250d5630b4cf539739df2c5dacb4c659f2488d".toLowerCase();
  throw Error("Unsupported chainId");
}

export function usdtTokenAddress(chainId: number): string {
  if (chainId === 1)
    return "0xdac17f958d2ee523a2206206994597c13d831ec7".toLowerCase();
  if (chainId === 5)
    return "0x65E2fe35C30eC218b46266F89847c63c2eDa7Dc7".toLowerCase();
  throw Error("Unsupported chainId");
}

export function usdcTokenAddress(chainId: number): string {
  if (chainId === 1)
    return "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".toLowerCase();
  throw Error("Unsupported chainId");
}

export function klerosCourtAddress(chainId: number): string {
  if (chainId === 1)
    return "0x988b3a538b618c7a603e1c11ab82cd16dbe28069".toLowerCase();
  throw Error("Unsupported chainId");
}

export function wethTokenAddress(chainId: number): string {
  if (chainId === 1)
    return "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase();
  if (chainId === 5)
    return "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6".toLowerCase();
  throw Error("Unsupported chainId");
}

export function getTokenAddressBySymbol(
  contracts: ProtocolContracts,
  symbol: string,
  chainId = 1,
): string {
  switch (symbol) {
    case "USDT":
      return usdtTokenAddress(chainId);
    case "USDC":
      return usdcTokenAddress(chainId);
    case "WETH":
      return wethTokenAddress(chainId);
    case "ATEN":
      contracts.AthenaToken.address;
    default:
      throw Error("Unsupported token symbol");
  }
}

export function evidenceGuardianWallet() {
  const EVIDENCE_GUARDIAN_PK = process.env.EVIDENCE_GUARDIAN_PK;
  if (!EVIDENCE_GUARDIAN_PK) throw new Error("EVIDENCE_GUARDIAN_PK not set");
  return new ethers.Wallet(EVIDENCE_GUARDIAN_PK);
}

export function buybackWallet() {
  const BUYBACK_PK = process.env.BUYBACK_PK;
  if (!BUYBACK_PK) throw new Error("BUYBACK_PK not set");
  return new ethers.Wallet(BUYBACK_PK);
}

export function treasuryWallet() {
  const TREASURY_PK = process.env.TREASURY_PK;
  if (!TREASURY_PK) throw new Error("TREASURY_PK not set");
  return new ethers.Wallet(TREASURY_PK);
}

export function leverageRiskWallet() {
  const RISK_GUARD_PK = process.env.RISK_GUARD_PK;
  if (!RISK_GUARD_PK) throw new Error("RISK_GUARD_PK not set");
  return new ethers.Wallet(RISK_GUARD_PK);
}

export async function balanceOfAaveUsdt(
  signer: Wallet,
  account: string | Wallet,
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

  return IERC20__factory.connect(aTokenAddress, signer).balanceOf(
    accountAddress,
  );
}

export async function balanceOfAaveUsdc(
  signer: Wallet,
  account: string | Wallet,
): Promise<BigNumber> {
  const chainId = await entityProviderChainId(signer);

  const lendingPoolAddress = aaveLendingPoolV2Address(chainId);
  const lendingPoolContract = ILendingPool__factory.connect(
    lendingPoolAddress,
    signer,
  );

  const usdcAddress = usdcTokenAddress(chainId);
  const { aTokenAddress } =
    await lendingPoolContract.getReserveData(usdcAddress);
  const accountAddress =
    typeof account === "string" ? account : await account.getAddress();

  return IERC20__factory.connect(aTokenAddress, signer).balanceOf(
    accountAddress,
  );
}

// ===================== //
// === Token helpers === //
// ===================== //

async function transfer<T extends IERC20>(
  contract: T | TetherToken,
  signer: Wallet,
  ...args: Parameters<IERC20["transfer"]>
): Promise<ContractReceipt> {
  return postTxHandler(contract.connect(signer).transfer(...args));
}

export async function approve<T extends IERC20>(
  contract: T | TetherToken,
  signer: Wallet,
  ...args: Parameters<IERC20["approve"]>
): Promise<ContractReceipt> {
  return postTxHandler(contract.connect(signer).approve(...args)).catch(
    async () => {
      // Similar to force approve for tokes who require reseting allowance to 0
      await postTxHandler(contract.approve(args[0], 0));
      return await postTxHandler(contract.approve(...args));
    },
  );
}

async function maxApprove<T extends IERC20>(
  contract: T | TetherToken,
  signer: Wallet,
  spender: string,
): Promise<ContractReceipt> {
  return postTxHandler(
    contract.connect(signer).approve(spender, BigNumber.from(2).pow(256)),
  );
}

export async function getTokens(
  signer: Wallet,
  token: string,
  to: string,
  amount: BigNumberish,
): Promise<ContractReceipt> {
  const chainId = await entityProviderChainId(signer);

  const routerAddress = uniswapV2Router(chainId);
  const uniswapRouter = IUniswapV2Router__factory.connect(
    routerAddress,
    signer,
  );

  const wethAddress = wethTokenAddress(chainId);
  const weth = IWETH__factory.connect(wethAddress, signer);

  await postTxHandler(weth.approve(routerAddress, parseEther("500")));

  return postTxHandler(
    uniswapRouter.swapTokensForExactTokens(
      amount, // uint amountOut,
      parseEther("500"), // uint amountInMax,
      [wethAddress, token], // address[] calldata path,
      to, // address to,
      9999999999, // uint deadline
    ),
  );
}

// ============================ //
// === Admin action helpers === //
// ============================ //

// =========================== //
// === User action helpers === //
// =========================== //

// ======== DAO ======== //

async function createDaoLock(
  contract: EcclesiaDao,
  atenContract: AthenaToken,
  deployer: Wallet,
  user: Wallet,
  amount: BigNumberish,
  lockTimeSec: number,
): Promise<ContractReceipt> {
  const [userAccount, unlockTimestamp] = await Promise.all([
    user.getAddress(),
    getCurrentTime().then((ts) => ts + lockTimeSec),
  ]);

  await Promise.all([
    postTxHandler(atenContract.connect(deployer).transfer(userAccount, amount)),
    postTxHandler(atenContract.connect(user).approve(contract.address, amount)),
  ]);

  return postTxHandler(
    contract.connect(user).createLock(amount, unlockTimestamp),
  );
}

// ======== LP Positions ======== //

async function openPosition(
  contract: LiquidityManager,
  user: Wallet,
  amount: BigNumberish,
  isWrapped: boolean,
  poolIds: number[],
): Promise<ContractReceipt> {
  const [userAccount, token] = await Promise.all([
    user.getAddress(),
    contract
      .poolInfo(poolIds[0])
      .then((poolInfo) =>
        IERC20__factory.connect(
          isWrapped ? poolInfo.wrappedAsset : poolInfo.underlyingAsset,
          user,
        ),
      ),
  ]);

  await Promise.all([
    getTokens(user, token.address, userAccount, amount),
    postTxHandler(token.connect(user).approve(contract.address, amount)),
  ]);

  return postTxHandler(
    contract.connect(user).openPosition(amount, isWrapped, poolIds),
  );
}

async function addLiquidity(
  contract: LiquidityManager,
  user: Wallet,
  tokenId: BigNumberish,
  amount: BigNumberish,
  isWrapped: boolean,
): Promise<ContractReceipt> {
  const poolIds = await contract
    .positions(tokenId)
    .then((position) => position.poolIds);

  const [userAccount, token] = await Promise.all([
    user.getAddress(),
    contract
      .poolInfo(poolIds[0])
      .then((poolInfo) =>
        IERC20__factory.connect(
          isWrapped ? poolInfo.wrappedAsset : poolInfo.underlyingAsset,
          user,
        ),
      ),
  ]);

  await Promise.all([
    getTokens(user, token.address, userAccount, amount),
    postTxHandler(token.connect(user).approve(contract.address, amount)),
  ]);

  return postTxHandler(
    contract.connect(user).addLiquidity(tokenId, amount, isWrapped),
  );
}

// ======== Covers ======== //

async function openCover(
  contract: LiquidityManager,
  user: Wallet,
  poolId: number,
  coverAmount: BigNumberish,
  premiums: BigNumberish,
): Promise<ContractReceipt> {
  const [userAccount, token] = await Promise.all([
    user.getAddress(),
    contract
      .poolInfo(poolId)
      .then((poolInfo) =>
        IERC20__factory.connect(poolInfo.underlyingAsset, user),
      ),
  ]);

  await Promise.all([
    getTokens(user, token.address, userAccount, premiums),
    token.connect(user).approve(contract.address, premiums),
  ]);

  return postTxHandler(
    contract.connect(user).openCover(poolId, coverAmount, premiums),
  );
}

async function updateCover(
  contract: LiquidityManager,
  user: Wallet,
  coverId: BigNumberish,
  coverToAdd: BigNumberish,
  coverToRemove: BigNumberish,
  premiumsToAdd: BigNumberish,
  premiumsToRemove: BigNumberish,
): Promise<ContractReceipt> {
  const [userAccount, poolId] = await Promise.all([
    user.getAddress(),
    contract.coverInfo(coverId).then((cover) => cover.poolId),
  ]);

  if (BigNumber.from(premiumsToAdd).gt(0)) {
    const token = await contract
      .poolInfo(poolId)
      .then((poolInfo) =>
        IERC20__factory.connect(poolInfo.underlyingAsset, user),
      );
    await Promise.all([
      getTokens(user, token.address, userAccount, premiumsToAdd),
      token.connect(user).approve(contract.address, premiumsToAdd),
    ]);
  }

  return postTxHandler(
    contract
      .connect(user)
      .updateCover(
        coverId,
        coverToAdd,
        coverToRemove,
        premiumsToAdd,
        premiumsToRemove,
      ),
  );
}

// ======== Claims ======== //

export async function getTestingCidAndSig(
  cid?: string,
): Promise<{ ipfsCid: string; cidSignature: string }> {
  const ipfsCid = cid || "Qma00000000000000000000000000000000000000_test";
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(ipfsCid));
  const cidSignature = await evidenceGuardianWallet().signMessage(
    ethers.utils.arrayify(hash),
  );

  return { ipfsCid, cidSignature };
}

async function initiateClaim(
  contract: ClaimManager,
  user: Wallet,
  coverId: number,
  amountClaimed: BigNumberish,
): Promise<ContractReceipt> {
  // Get the cost of arbitration + challenge collateral
  const [arbitrationCost, collateralAmount] = await Promise.all([
    contract.connect(user).arbitrationCost(),
    contract.connect(user).collateralAmount(),
  ]);

  const valueForTx = arbitrationCost.add(collateralAmount);

  const { ipfsCid, cidSignature } = await getTestingCidAndSig();

  // Create the claim
  return postTxHandler(
    contract
      .connect(user)
      .initiateClaim(coverId, amountClaimed, ipfsCid, cidSignature, {
        value: valueForTx,
      }),
  );
}

async function withdrawCompensation(
  contract: ClaimManager,
  user: Wallet,
  coverId: number,
): Promise<ContractReceipt> {
  const claimIds = await contract.connect(user).getCoverIdToClaimIds(coverId);
  const latestClaimId = claimIds[claimIds.length - 1];

  return postTxHandler(
    contract.connect(user).withdrawCompensation(latestClaimId),
  );
}

// ===================== //
// === Setup helpers === //
// ===================== //

async function createPoolsWithLiquidity(
  contracts: ProtocolContracts,
  deployer: Wallet,
  params: {
    user: Wallet;
    nbPools: number;
    nbLpProviders: number;
    lpAmount: BigNumberish;
  },
) {
  params = {
    user: params.user ?? deployer,
    nbPools: params.nbPools ?? 2,
    nbLpProviders: params.nbLpProviders ?? 2,
    lpAmount: params.lpAmount ?? toErc20(1000),
  };

  const { uOptimal, r0, rSlope1, rSlope2 } = defaultProtocolConfig.poolFormula;

  await Promise.all(
    makeIdArray(params.nbPools).map((poolId) =>
      postTxHandler(
        contracts.LiquidityManager.createPool(
          contracts.CircleToken.address, // paymentAsset
          0, // strategyId
          0, // feeRate
          uOptimal,
          r0,
          rSlope1,
          rSlope2,
          makeIdArray(params.nbPools).filter((id) => id != poolId), // compatiblePools
        ),
      ),
    ),
  );

  await Promise.all(
    makeIdArray(params.nbLpProviders).map(() =>
      openPosition(
        contracts.LiquidityManager,
        deployer,
        params.lpAmount,
        false,
        makeIdArray(params.nbPools),
      ),
    ),
  );
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

type OmitThreeArgs<T extends (...args: any) => any> = T extends (
  ...args: [any, any, any, ...infer U]
) => infer R
  ? (...args: U) => R
  : never;

// Token
type TokenHelpers = {
  transferAten: OmitFirstArg<typeof transfer>;
  approveAten: OmitFirstArg<typeof approve>;
  maxApproveAten: OmitFirstArg<typeof maxApprove>;
  getAten: OmitFirstTwoArgs<typeof transfer>;
  transferUsdt: OmitFirstArg<typeof transfer>;
  approveUsdt: OmitFirstArg<typeof approve>;
  maxApproveUsdt: OmitFirstArg<typeof maxApprove>;
  getUsdt: OmitFirstTwoArgs<typeof getTokens>;
  balanceOfAaveUsdt: OmitFirstArg<typeof balanceOfAaveUsdt>;
  transferUsdc: OmitFirstArg<typeof transfer>;
  approveUsdc: OmitFirstArg<typeof approve>;
  maxApproveUsdc: OmitFirstArg<typeof maxApprove>;
  getUsdc: OmitFirstTwoArgs<typeof getTokens>;
  balanceOfAaveUsdc: OmitFirstArg<typeof balanceOfAaveUsdc>;
};

export type TestHelper = TokenHelpers & {
  // write
  createDaoLock: OmitThreeArgs<typeof createDaoLock>;
  openPosition: OmitFirstArg<typeof openPosition>;
  openCover: OmitFirstArg<typeof openCover>;
  addLiquidity: OmitFirstArg<typeof addLiquidity>;
  updateCover: OmitFirstArg<typeof updateCover>;
  initiateClaim: OmitFirstArg<typeof initiateClaim>;
  withdrawCompensation: OmitFirstArg<typeof withdrawCompensation>;
  createPoolsWithLiquidity: OmitFirstTwoArgs<typeof createPoolsWithLiquidity>;
};

export async function makeTestHelpers(
  deployer: Wallet,
  contracts: ProtocolContracts,
): Promise<TestHelper> {
  const {
    AthenaToken,
    TetherToken,
    CircleToken,
    LiquidityManager,
    ClaimManager,
    EcclesiaDao,
  } = contracts;

  const tokenHelpers: TokenHelpers = {
    transferAten: (...args) => transfer(AthenaToken, ...args),
    approveAten: (...args) => approve(AthenaToken, ...args),
    maxApproveAten: (...args) => maxApprove(AthenaToken, ...args),
    getAten: (...args) => transfer(AthenaToken, deployer, ...args),
    //
    transferUsdt: (...args) => transfer(TetherToken, ...args),
    approveUsdt: (...args) => approve(TetherToken, ...args),
    maxApproveUsdt: (...args) => maxApprove(TetherToken, ...args),
    balanceOfAaveUsdt: (...args) => balanceOfAaveUsdt(deployer, ...args),
    getUsdt: (...args) => getTokens(deployer, TetherToken.address, ...args),
    //
    transferUsdc: (...args) => transfer(CircleToken, ...args),
    approveUsdc: (...args) => approve(CircleToken, ...args),
    maxApproveUsdc: (...args) => maxApprove(CircleToken, ...args),
    balanceOfAaveUsdc: (...args) => balanceOfAaveUsdc(deployer, ...args),
    getUsdc: (...args) => getTokens(deployer, CircleToken.address, ...args),
  };

  return {
    // write
    createDaoLock: (...args) =>
      createDaoLock(EcclesiaDao, AthenaToken, deployer, ...args),
    openPosition: (...args) => openPosition(LiquidityManager, ...args),
    openCover: (...args) => openCover(LiquidityManager, ...args),
    addLiquidity: (...args) => addLiquidity(LiquidityManager, ...args),
    updateCover: (...args) => updateCover(LiquidityManager, ...args),
    initiateClaim: (...args) => initiateClaim(ClaimManager, ...args),
    withdrawCompensation: (...args) =>
      withdrawCompensation(ClaimManager, ...args),
    createPoolsWithLiquidity: (...args) =>
      createPoolsWithLiquidity(contracts, deployer, ...args),
    // tokens
    ...tokenHelpers,
  };
}
