import { utils } from "ethers";
import {
  genContractAddress,
  entityProviderChainId,
  getCurrentBlockNumber,
  postTxHandler,
} from "./hardhat";
import {
  toErc20,
  usdtTokenAddress,
  wethTokenAddress,
  evidenceGuardianWallet,
  buybackWallet,
  treasuryWallet,
  leverageRiskWallet,
} from "./protocol";
import { toRay } from "./utils/poolRayMath";
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
  // Libs
  PoolMath__factory,
  PoolMath,
  VirtualPool__factory,
  VirtualPool,
  // Other
  // TestableVirtualPool__factory,
  // TestableVirtualPool,
  // TestableLiquidityManager__factory,
  // TestableLiquidityManager,
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

export async function deployPoolMath(
  signer: Signer,
  args: Parameters<PoolMath__factory["deploy"]>,
): Promise<PoolMath> {
  return new PoolMath__factory(signer).deploy(...args);
}

export async function deployVirtualPool(
  signer: Signer,
  args: Parameters<VirtualPool__factory["deploy"]>,
  libAddresses: { PoolMath: string },
): Promise<VirtualPool> {
  return new VirtualPool__factory(
    {
      ["src/libs/PoolMath.sol:PoolMath"]: libAddresses.PoolMath,
    },
    signer,
  ).deploy(...args);
}

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
  libAddresses: { PoolMath: string; VirtualPool: string },
): Promise<LiquidityManager> {
  return new LiquidityManager__factory(
    {
      ["src/libs/PoolMath.sol:PoolMath"]: libAddresses.PoolMath,
      ["src/libs/VirtualPool.sol:VirtualPool"]: libAddresses.VirtualPool,
    },
    signer,
  ).deploy(...args);
}

// export async function deployTestableLiquidityManager(
//   signer: Signer,
//   args: Parameters<TestableLiquidityManager__factory["deploy"]>,
// ): Promise<TestableLiquidityManager> {
//   return new TestableLiquidityManager__factory(signer).deploy(...args);
// }

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
  subcourtId: number;
  nbOfJurors: number;
  arbitrationCollateral: BigNumber;
  evidenceGuardian: Wallet;
  buybackWallet: Wallet;
  treasuryWallet: Wallet;
  leverageRiskWallet: Wallet;
  leverageFeePerPool: BigNumber;
  poolFormula: {
    feeRate: BigNumber;
    uOptimal: BigNumber;
    r0: BigNumber;
    rSlope1: BigNumber;
    rSlope2: BigNumber;
  };
  yieldBonuses: { atenAmount: BigNumber; yieldBonus: BigNumber }[];
  withdrawDelay: number;
  maxLeverage: number;
  payoutDeductibleRate: BigNumber;
  performanceFee: BigNumber;
};

export const defaultProtocolConfig: ProtocolConfig = {
  subcourtId: 2,
  nbOfJurors: 4,
  arbitrationCollateral: utils.parseEther("0.05"), // in ETH
  evidenceGuardian: evidenceGuardianWallet(),
  buybackWallet: buybackWallet(),
  treasuryWallet: treasuryWallet(),
  leverageRiskWallet: leverageRiskWallet(),
  leverageFeePerPool: toRay(1.5, 2), // 1.5% base 100
  poolFormula: {
    feeRate: toRay(0.1), // 10%
    uOptimal: toRay(75),
    r0: toRay(1),
    rSlope1: toRay(5),
    rSlope2: toRay(10),
  },
  yieldBonuses: [
    { atenAmount: toErc20(0), yieldBonus: toRay(250, 4) },
    { atenAmount: toErc20(1_000), yieldBonus: toRay(200, 4) },
    { atenAmount: toErc20(100_000), yieldBonus: toRay(150, 4) },
    { atenAmount: toErc20(1_000_000), yieldBonus: toRay(50, 4) },
  ],
  withdrawDelay: 14 * 24 * 60 * 60, // 14 days
  maxLeverage: 30, // max pools per position
  payoutDeductibleRate: toRay(0.1), // 10%
  performanceFee: toRay(0.5), // 50%
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
  // TestableVirtualPool: TestableVirtualPool;
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
    "_approve",
    "PoolMath",
    "VirtualPool",
    "ClaimManager",
    "StrategyManager",
    "LiquidityManager",
    "RewardManager",
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

  await genContractAddress(deployedAt.RewardManager, 1).then(
    (address) => (deployedAt.FarmingRange = address),
  );
  await genContractAddress(deployedAt.RewardManager, 2).then(
    (address) => (deployedAt.Staking = address),
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
  const AthenaToken = await deployAthenaToken(deployer, [
    [deployedAt.EcclesiaDao, deployedAt.Staking],
  ]);

  // Approve for initial minimal DAO lock
  await postTxHandler(
    AthenaToken.connect(deployer).approve(
      deployedAt.EcclesiaDao,
      utils.parseEther("1"),
    ),
  );

  // ======= Libs ======= //

  const PoolMath = await deployPoolMath(deployer, []);
  const VirtualPool = await deployVirtualPool(deployer, [], {
    PoolMath: PoolMath.address,
  });

  // ======= Managers ======= //

  const ClaimManager = await deployClaimManager(deployer, [
    deployedAt.AthenaCoverToken, // IAthenaCoverToken coverToken_
    deployedAt.LiquidityManager, // ILiquidityManager liquidityManager_
    deployedAt.MockArbitrator, // IArbitrator arbitrator_
    config.evidenceGuardian.address, // address metaEvidenceGuardian_
    config.leverageRiskWallet.address, // address leverageRiskWallet_
    config.subcourtId, // uint256 subcourtId_
    config.nbOfJurors, // uint256 nbOfJurors_
  ]);
  const StrategyManager = await deployStrategyManager(deployer, [
    deployedAt.LiquidityManager,
    deployedAt.EcclesiaDao,
    config.buybackWallet.address,
    config.payoutDeductibleRate, // payoutDeductibleRate
    config.performanceFee, // performanceFee
  ]);

  const LiquidityManager = await deployLiquidityManager(
    deployer,
    [
      deployedAt.AthenaPositionToken,
      deployedAt.AthenaCoverToken,
      deployedAt.Staking,
      deployedAt.FarmingRange,
      deployedAt.EcclesiaDao,
      deployedAt.StrategyManager,
      deployedAt.ClaimManager,
      config.withdrawDelay,
      config.maxLeverage,
      config.leverageFeePerPool,
    ],
    {
      PoolMath: PoolMath.address,
      VirtualPool: VirtualPool.address,
    },
  );

  const campaignStartBlock = (await getCurrentBlockNumber()) + 4;
  const RewardManager = await deployRewardManager(deployer, [
    deployedAt.LiquidityManager,
    deployedAt.EcclesiaDao,
    deployedAt.AthenaPositionToken,
    deployedAt.AthenaCoverToken,
    deployedAt.AthenaToken,
    campaignStartBlock,
    config.yieldBonuses,
  ]);

  // ======= DAO ======= //

  const EcclesiaDao = await deployEcclesiaDao(deployer, [
    deployedAt.AthenaToken,
    deployedAt.Staking,
    deployedAt.LiquidityManager,
    deployedAt.StrategyManager,
    config.treasuryWallet.address,
    config.leverageRiskWallet.address,
  ]);

  // ======= Claims ======= //
  const MockArbitrator = await deployMockArbitrator(deployer, [
    config.arbitrationCollateral,
  ]);

  // Use on chain addresses to check if were correctly precomputed
  const FarmingRangeAddress = await RewardManager.farming();
  const StakingAddress = await RewardManager.staking();

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
    FarmingRange: FarmingRange__factory.connect(FarmingRangeAddress, deployer),
    Staking: Staking__factory.connect(StakingAddress, deployer),
    // Mocks or testing contracts
    // TestableVirtualPool: TestableVirtualPool__factory.connect(
    //   deployedAt.LiquidityManager,
    //   deployer,
    // ),
  };

  // Check predicted deployment addresses
  for (const [name, contract] of Object.entries(contracts)) {
    if (
      deployedAt[name] &&
      contract.address.toLowerCase() !== deployedAt[name].toLowerCase()
    )
      throw Error(`Contract ${name} address mismatch`);
  }

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
