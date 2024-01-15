import { utils } from "ethers";
import {
  genContractAddress,
  entityProviderChainId,
  getCurrentBlockNumber,
} from "./hardhat";
import {
  usdtTokenAddress,
  wethTokenAddress,
  evidenceGuardianWallet,
} from "./protocol";
// typechain
import {
  // Dao
  EcclesiaDao__factory,
  EcclesiaDao,
  // Claims
  MockArbitrator__factory,
  MockArbitrator,
  // Managers
  ClaimManager__factory,
  ClaimManager,
  LiquidityManager__factory,
  LiquidityManager,
  StrategyManager__factory,
  StrategyManager,
  // Rewards
  FarmingRange__factory,
  FarmingRange,
  RewardManager__factory,
  RewardManager,
  Staking__factory,
  Staking,
  // Tokens
  AthenaCoverToken__factory,
  AthenaCoverToken,
  AthenaPositionToken__factory,
  AthenaPositionToken,
  AthenaToken__factory,
  AthenaToken,
  // Other
  TetherToken__factory,
  TetherToken,
  IWETH,
  IWETH__factory,
} from "../../typechain/";
// Types
import { BigNumber, Wallet, Signer } from "ethers";

// ================================= //
// === Deploy contract functions === //
// ================================= //

export async function deployMockArbitrator(
  signer: Signer,
  args: Parameters<MockArbitrator__factory["deploy"]>,
): Promise<MockArbitrator> {
  return new MockArbitrator__factory(signer).deploy(...args);
}

export async function deployEcclesiaDao(
  signer: Signer,
  args: Parameters<EcclesiaDao__factory["deploy"]>,
): Promise<EcclesiaDao> {
  return new EcclesiaDao__factory(signer).deploy(...args);
}

export async function deployClaimManager(
  signer: Signer,
  args: Parameters<ClaimManager__factory["deploy"]>,
): Promise<ClaimManager> {
  return new ClaimManager__factory(signer).deploy(...args);
}

export async function deployLiquidityManager(
  signer: Signer,
  args: Parameters<LiquidityManager__factory["deploy"]>,
): Promise<LiquidityManager> {
  return new LiquidityManager__factory(signer).deploy(...args);
}

export async function deployStrategyManager(
  signer: Signer,
  args: Parameters<StrategyManager__factory["deploy"]>,
): Promise<StrategyManager> {
  return new StrategyManager__factory(signer).deploy(...args);
}

export async function deployFarmingRange(
  signer: Signer,
  args: Parameters<FarmingRange__factory["deploy"]>,
): Promise<FarmingRange> {
  return new FarmingRange__factory(signer).deploy(...args);
}

export async function deployRewardManager(
  signer: Signer,
  args: Parameters<RewardManager__factory["deploy"]>,
): Promise<RewardManager> {
  return new RewardManager__factory(signer).deploy(...args);
}

export async function deployStaking(
  signer: Signer,
  args: Parameters<Staking__factory["deploy"]>,
): Promise<Staking> {
  return new Staking__factory(signer).deploy(...args);
}

export async function deployAthenaCoverToken(
  signer: Signer,
  args: Parameters<AthenaCoverToken__factory["deploy"]>,
): Promise<AthenaCoverToken> {
  return new AthenaCoverToken__factory(signer).deploy(...args);
}

export async function deployAthenaPositionToken(
  signer: Signer,
  args: Parameters<AthenaPositionToken__factory["deploy"]>,
): Promise<AthenaPositionToken> {
  return new AthenaPositionToken__factory(signer).deploy(...args);
}

export async function deployAthenaToken(
  signer: Signer,
  args: Parameters<AthenaToken__factory["deploy"]>,
): Promise<AthenaToken> {
  return new AthenaToken__factory(signer).deploy(...args);
}

// ======================= //
// === Deploy protocol === //
// ======================= //

export type ProtocolConfig = {
  arbitrationCollateral: BigNumber;
  evidenceGuardian: Wallet;
  poolMarket: [BigNumber, BigNumber, BigNumber, BigNumber];
  feeDiscounts: { atenAmount: number; feeDiscount: number }[];
};

export const defaultProtocolConfig: ProtocolConfig = {
  arbitrationCollateral: utils.parseEther("0.05"), // in ETH
  evidenceGuardian: evidenceGuardianWallet(),
  poolMarket: [
    BigNumber.from(75).mul(BigNumber.from(10).pow(27)), // uOptimal_
    BigNumber.from(1).mul(BigNumber.from(10).pow(27)), // r0_
    BigNumber.from(5).mul(BigNumber.from(10).pow(27)), // rSlope1_
    BigNumber.from(11).mul(BigNumber.from(10).pow(26)), // rSlope2_
  ],
  feeDiscounts: [
    { atenAmount: 0, feeDiscount: 250 },
    { atenAmount: 1_000, feeDiscount: 200 },
    { atenAmount: 100_000, feeDiscount: 150 },
    { atenAmount: 1_000_000, feeDiscount: 50 },
  ],
};

export type ProtocolContracts = {
  TetherToken: TetherToken;
  WethToken: IWETH;
  AthenaCoverToken: AthenaCoverToken;
  AthenaPositionToken: AthenaPositionToken;
  AthenaToken: AthenaToken;
  EcclesiaDao: EcclesiaDao;
  MockArbitrator: MockArbitrator;
  ClaimManager: ClaimManager;
  LiquidityManager: LiquidityManager;
  StrategyManager: StrategyManager;
  FarmingRange: FarmingRange;
  RewardManager: RewardManager;
  Staking: Staking;
};

export async function deployAllContractsAndInitializeProtocol(
  deployer: Wallet,
  config: ProtocolConfig,
  logAddresses = false,
): Promise<ProtocolContracts> {
  const chainId = await entityProviderChainId(deployer);
  if (!chainId) throw Error("No chainId found for deployment signer");

  const deploymentOrder = [
    "AthenaCoverToken",
    "AthenaPositionToken",
    "AthenaToken",
    "ClaimManager",
    "StrategyManager",
    "RewardManager",
    "LiquidityManager",
    "EcclesiaDao",
    "MockArbitrator",
  ];

  const deployedAt: { [key: string]: string } = {};

  await Promise.all(
    deploymentOrder.map((name, i) =>
      genContractAddress(deployer, i).then((address: string) => {
        deployedAt[name] = address;
      }),
    ),
  );

  // Add USDT & WETH interface
  const usdtAddress = usdtTokenAddress(chainId);
  const UsdtToken = TetherToken__factory.connect(usdtAddress, deployer);
  const wethAddress = wethTokenAddress(chainId);
  const WethToken = IWETH__factory.connect(wethAddress, deployer);

  const AthenaCoverToken = await deployAthenaCoverToken(deployer, [
    deployedAt.LiquidityManager,
  ]);
  const AthenaPositionToken = await deployAthenaPositionToken(deployer, [
    deployedAt.LiquidityManager,
  ]);
  const AthenaToken = await deployAthenaToken(deployer, []);

  // ======= Managers ======= //

  const ClaimManager = await deployClaimManager(deployer, [
    deployedAt.AthenaCoverToken,
    deployedAt.LiquidityManager,
    deployedAt.MockArbitrator,
    config.evidenceGuardian.address,
  ]);
  const StrategyManager = await deployStrategyManager(deployer, [
    deployedAt.LiquidityManager,
  ]);

  const campaignStartBlock = (await getCurrentBlockNumber()) + 4;
  const RewardManager = await deployRewardManager(deployer, [
    deployedAt.LiquidityManager,
    deployedAt.AthenaPositionToken,
    deployedAt.AthenaCoverToken,
    deployedAt.AthenaToken,
    campaignStartBlock,
    config.feeDiscounts,
  ]);
  // Required for DAO & Liquidity Manager contract
  deployedAt.Staking = await RewardManager.staking();
  deployedAt.FarmingRange = await RewardManager.farming();

  const LiquidityManager = await deployLiquidityManager(deployer, [
    deployedAt.AthenaPositionToken,
    deployedAt.AthenaCoverToken,
    deployedAt.Staking,
    deployedAt.EcclesiaDao,
    deployedAt.StrategyManager,
    deployedAt.ClaimManager,
  ]);

  // ======= DAO ======= //
  const EcclesiaDao = await deployEcclesiaDao(deployer, [
    deployedAt.AthenaToken,
    deployedAt.Staking,
    deployedAt.LiquidityManager,
  ]);

  // ======= Claims ======= //
  const MockArbitrator = await deployMockArbitrator(deployer, [
    config.arbitrationCollateral,
  ]);

  const contracts = {
    TetherToken: UsdtToken,
    WethToken,
    AthenaCoverToken,
    AthenaPositionToken,
    AthenaToken,
    EcclesiaDao,
    MockArbitrator,
    ClaimManager,
    LiquidityManager,
    StrategyManager,
    RewardManager,
    FarmingRange: FarmingRange__factory.connect(
      deployedAt.FarmingRange,
      deployer,
    ),
    Staking: Staking__factory.connect(deployedAt.Staking, deployer),
  };

  if (logAddresses) {
    console.log(
      "Deployed & initialized Athena: ",
      JSON.stringify(
        (Object.keys(contracts) as Array<keyof typeof contracts>).reduce(
          (acc: { [key: string]: string }, name: keyof typeof contracts) => {
            acc[name] = contracts[name].address;
            return acc;
          },
          {},
        ),
        null,
        2,
      ),
    );
  }

  return contracts;
}
