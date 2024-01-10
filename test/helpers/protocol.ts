import { ethers } from "hardhat";
// Functions
import {
  entityProviderChainId,
  impersonateAccount,
  setNextBlockTimestamp,
  postTxHandler,
} from "./hardhat";

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
  // if (chainId === 5) return "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
  throw Error("Unsupported chainId");
}

export function uniswapV2Router(chainId: number): string {
  if (chainId === 1) return "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";
  // if (chainId === 5) return "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";
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

async function approve<T extends IERC20>(
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

async function getTokens(
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
      2000000000, // uint deadline
    ),
  );
}

// ======================= //
// === Protocol config === //
// ======================= //

// ============================ //
// === Admin action helpers === //
// ============================ //

// =========================== //
// === User action helpers === //
// =========================== //

// ======== LP Positions ======== //

async function createPosition(
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
    contract.connect(user).createPosition(amount, isWrapped, poolIds),
  );
}

async function increasePosition(
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
    contract.connect(user).increasePosition(tokenId, amount, isWrapped),
  );
}

// ======== Covers ======== //

async function buyCover(
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
    contract.connect(user).buyCover(poolId, coverAmount, premiums),
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
    contract.covers(coverId).then((cover) => cover.poolId),
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

// async function updateCover(
//   contract: LiquidityManager,
//   tokenHelpers: TokenHelpers,
//   user: Wallet,
//   action:
//     | "increaseCover"
//     | "decreaseCover"
//     | "addPremiums"
//     | "removePremiums"
//     | "addToCoverRefundStake"
//     | "withdrawCoverRefundStakedAten",
//   coverId: BigNumberish,
//   amount: BigNumberish,
// ): Promise<ContractReceipt> {
//   const account = await user.getAddress();

//   if (action === "addPremiums") {
//     await tokenHelpers.getUsdt(account, amount);
//     await tokenHelpers.approveUsdt(user, contract.address, amount);
//   }
//   if (action === "addToCoverRefundStake") {
//     await tokenHelpers.getAten(account, amount);
//     await tokenHelpers.approveAten(user, contract.address, amount);
//   }

//   return (await contract.connect(user)[action](coverId, amount)).wait();
// }

// ======== Claims ======== //

// async function createClaim(
//   contract: ClaimManager,
//   policyHolder: Wallet,
//   coverId: number,
//   amountClaimed: string | number,
//   valueOverride?: BigNumberish,
// ): Promise<ContractReceipt> {
//   // Get the cost of arbitration + challenge collateral
//   const [arbitrationCost, collateralAmount] = await Promise.all([
//     contract.connect(policyHolder).arbitrationCost(),
//     contract.connect(policyHolder).collateralAmount(),
//   ]);

//   const valueForTx = valueOverride || arbitrationCost.add(collateralAmount);

//   const ipfsCid = "QmaRxRRcQXFRzjrr4hgBydu6QetaFr687kfd9EjtoLaSyq";

//   const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(ipfsCid));
//   const signature = await evidenceGuardianWallet().signMessage(
//     ethers.utils.arrayify(hash),
//   );

//   // Create the claim
//   await contract
//     .connect(policyHolder)
//     .initiateClaim(coverId, amountClaimed, ipfsCid, signature, {
//       value: valueForTx,
//     });
// }

// async function resolveClaimWithoutDispute(
//   contract: ClaimManager,
//   policyHolder: Wallet,
//   coverId: number,
//   timeLapse: number,
// ): Promise<ContractReceipt> {
//   const claimIds = await contract
//     .connect(policyHolder)
//     .getCoverIdToClaimIds(coverId);

//   const latestClaimId = claimIds[claimIds.length - 1];

//   await setNextBlockTimestamp(timeLapse);

//   await contract
//     .connect(policyHolder)
//     .withdrawCompensationWithoutDispute(latestClaimId);
// }

// ==================== //
// === View helpers === //
// ==================== //

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
  // write
  createPosition: OmitFirstArg<typeof createPosition>;
  buyCover: OmitFirstArg<typeof buyCover>;
  increasePosition: OmitFirstArg<typeof increasePosition>;
  updateCover: OmitFirstArg<typeof updateCover>;
};

export async function makeTestHelpers(
  deployer: Wallet,
  contracts: ProtocolContracts,
): Promise<TestHelper> {
  const { AthenaToken, TetherToken, LiquidityManager, ClaimManager } =
    contracts;

  const tokenHelpers: TokenHelpers = {
    transferAten: (...args) => transfer(AthenaToken, ...args),
    transferUsdt: (...args) => transfer(TetherToken, ...args),
    approveAten: (...args) => approve(AthenaToken, ...args),
    approveUsdt: (...args) => approve(TetherToken, ...args),
    maxApproveAten: (...args) => maxApprove(AthenaToken, ...args),
    maxApproveUsdt: (...args) => maxApprove(TetherToken, ...args),
    balanceOfAaveUsdt: (...args) => balanceOfAaveUsdt(deployer, ...args),
    getUsdt: (...args) => getTokens(deployer, TetherToken.address, ...args),
    getAten: (...args) => transfer(AthenaToken, deployer, ...args),
  };

  return {
    // write
    createPosition: (...args) => createPosition(LiquidityManager, ...args),
    buyCover: (...args) => buyCover(LiquidityManager, ...args),
    increasePosition: (...args) => increasePosition(LiquidityManager, ...args),
    updateCover: (...args) => updateCover(LiquidityManager, ...args),
    // tokens
    ...tokenHelpers,
  };
}
