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
  usdcTokenAddress,
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
  AthenaDataProvider__factory,
  AthenaDataProvider,
  // Other
  // TestableVirtualPool__factory,
  // TestableVirtualPool,
  // TestableLiquidityManager__factory,
  // TestableLiquidityManager,
  TetherToken__factory,
  TetherToken,
  IWETH,
  IWETH__factory,
  ERC20,
  ERC20__factory,
} from "../../typechain/";
// Types
import { BigNumber, Wallet, Signer } from "ethers";
import { ConnectWithAddress } from "./contracts-getters";

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

export async function deployAthenaDataProvider(
  signer: Signer,
  args: Parameters<AthenaDataProvider__factory["deploy"]>,
  libAddresses: { PoolMath: string; VirtualPool: string },
): Promise<AthenaDataProvider> {
  return new AthenaDataProvider__factory(
    {
      ["src/libs/PoolMath.sol:PoolMath"]: libAddresses.PoolMath,
      ["src/libs/VirtualPool.sol:VirtualPool"]: libAddresses.VirtualPool,
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
  libAddresses: {
    VirtualPool: string;
    AthenaDataProvider: string;
  },
): Promise<LiquidityManager> {
  return new LiquidityManager__factory(
    {
      ["src/libs/VirtualPool.sol:VirtualPool"]: libAddresses.VirtualPool,
      ["src/misc/AthenaDataProvider.sol:AthenaDataProvider"]:
        libAddresses.AthenaDataProvider,
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
  yieldRewarder: string;
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
  farmingBlockStart: number; // leave 0 for dynamic
};

export const defaultProtocolConfig: ProtocolConfig = {
  subcourtId: 2,
  nbOfJurors: 4,
  arbitrationCollateral: utils.parseEther("0.05"), // in ETH
  evidenceGuardian: evidenceGuardianWallet(),
  buybackWallet: buybackWallet(),
  treasuryWallet: treasuryWallet(),
  leverageRiskWallet: leverageRiskWallet(),
  yieldRewarder: "0x0000000000000000000000000000000000000000",
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
  maxLeverage: 12, // max pools per position
  payoutDeductibleRate: toRay(0.1), // 10%
  performanceFee: toRay(0.5), // 50%
  farmingBlockStart: 0, // leave 0 for dynamic
};

export type DeployedProtocolContracts = {
  TetherToken: TetherToken;
  CircleToken: ERC20;
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
  PoolMath: PoolMath;
  VirtualPool: VirtualPool;
  AthenaDataProvider: AthenaDataProvider;
  // TestableVirtualPool: TestableVirtualPool;
};

export type ConnectedProtocolContracts = {
  TetherToken: ConnectWithAddress<TetherToken>;
  CircleToken: ConnectWithAddress<ERC20>;
  WethToken: ConnectWithAddress<IWETH>;
  AthenaCoverToken: ConnectWithAddress<AthenaCoverToken>;
  AthenaPositionToken: ConnectWithAddress<AthenaPositionToken>;
  AthenaToken: ConnectWithAddress<AthenaToken>;
  EcclesiaDao: ConnectWithAddress<EcclesiaDao>;
  MockArbitrator: ConnectWithAddress<MockArbitrator>;
  ClaimManager: ConnectWithAddress<ClaimManager>;
  LiquidityManager: ConnectWithAddress<LiquidityManager>;
  StrategyManager: ConnectWithAddress<StrategyManager>;
  FarmingRange: ConnectWithAddress<FarmingRange>;
  RewardManager: ConnectWithAddress<RewardManager>;
  Staking: ConnectWithAddress<Staking>;
  PoolMath: ConnectWithAddress<PoolMath>;
  VirtualPool: ConnectWithAddress<VirtualPool>;
  AthenaDataProvider: ConnectWithAddress<AthenaDataProvider>;
  // TestableVirtualPool: ConnectWithAddress<TestableVirtualPool>;
};

export type ProtocolContracts =
  | ConnectedProtocolContracts
  | DeployedProtocolContracts;

export const deploymentOrder = [
  "AthenaCoverToken",
  "AthenaPositionToken",
  "AthenaToken",
  "_approve",
  "PoolMath",
  "VirtualPool",
  "AthenaDataProvider",
  "ClaimManager",
  "StrategyManager",
  "LiquidityManager",
  "RewardManager",
  "EcclesiaDao",
  "MockArbitrator",
];

export async function deployAllContractsAndInitializeProtocol(
  deployer: Wallet,
  config: ProtocolConfig,
  logAddresses = false,
): Promise<ProtocolContracts> {
  const chainId = await entityProviderChainId(deployer);
  if (!chainId) throw Error("No chainId found for deployment signer");

  let txCount = 0;
  let deployExecutors = [];

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
  const TetherToken = TetherToken__factory.connect(usdtAddress, deployer);

  const usdcAddress = usdcTokenAddress(chainId);
  const CircleToken = ERC20__factory.connect(usdcAddress, deployer);

  const wethAddress = wethTokenAddress(chainId);
  const WethToken = IWETH__factory.connect(wethAddress, deployer);

  if (deploymentOrder[txCount] === "AthenaCoverToken") {
    deployExecutors.push(() =>
      deployAthenaCoverToken(deployer, [deployedAt.LiquidityManager]),
    );
    txCount++;
  }

  if (deploymentOrder[txCount] === "AthenaPositionToken") {
    deployExecutors.push(() =>
      deployAthenaPositionToken(deployer, [deployedAt.LiquidityManager]),
    );
    txCount++;
  }

  if (deploymentOrder[txCount] === "AthenaToken") {
    deployExecutors.push(() =>
      deployAthenaToken(deployer, [
        [deployedAt.EcclesiaDao, deployedAt.Staking],
      ]),
    );
    txCount++;
  }

  // Approve for initial minimal DAO lock
  if (deploymentOrder[txCount] === "_approve") {
    deployExecutors.push(() =>
      postTxHandler(
        AthenaToken__factory.connect(deployedAt.AthenaToken, deployer).approve(
          deployedAt.EcclesiaDao,
          utils.parseEther("1"),
        ),
      ),
    );
    txCount++;
  }

  // ======= Libs ======= //

  if (deploymentOrder[txCount] === "PoolMath") {
    deployExecutors.push(() => deployPoolMath(deployer, []));
    txCount++;
  }

  if (deploymentOrder[txCount] === "VirtualPool") {
    deployExecutors.push(() =>
      deployVirtualPool(deployer, [], {
        PoolMath: deployedAt.PoolMath,
      }),
    );
    txCount++;
  }

  if (deploymentOrder[txCount] === "AthenaDataProvider") {
    deployExecutors.push(() =>
      deployAthenaDataProvider(deployer, [], {
        PoolMath: deployedAt.PoolMath,
        VirtualPool: deployedAt.VirtualPool,
      }),
    );
    txCount++;
  }

  // ======= Managers ======= //

  if (deploymentOrder[txCount] === "ClaimManager") {
    deployExecutors.push(() =>
      deployClaimManager(deployer, [
        deployedAt.AthenaCoverToken, // IAthenaCoverToken coverToken_
        deployedAt.LiquidityManager, // ILiquidityManager liquidityManager_
        deployedAt.MockArbitrator, // IArbitrator arbitrator_
        config.evidenceGuardian.address, // address metaEvidenceGuardian_
        config.leverageRiskWallet.address, // address leverageRiskWallet_
        config.subcourtId, // uint256 subcourtId_
        config.nbOfJurors, // uint256 nbOfJurors_
      ]),
    );
    txCount++;
  }

  if (deploymentOrder[txCount] === "StrategyManager") {
    deployExecutors.push(() =>
      deployStrategyManager(deployer, [
        deployedAt.LiquidityManager,
        deployedAt.EcclesiaDao,
        config.buybackWallet.address,
        config.payoutDeductibleRate, // payoutDeductibleRate
        config.performanceFee, // performanceFee
      ]),
    );
    txCount++;
  }

  if (deploymentOrder[txCount] === "LiquidityManager") {
    deployExecutors.push(() =>
      deployLiquidityManager(
        deployer,
        [
          deployedAt.AthenaPositionToken,
          deployedAt.AthenaCoverToken,
          deployedAt.EcclesiaDao,
          deployedAt.StrategyManager,
          deployedAt.ClaimManager,
          config.yieldRewarder, // to be replaced by farming
          config.withdrawDelay,
          config.maxLeverage,
          config.leverageFeePerPool,
        ],
        {
          VirtualPool: deployedAt.VirtualPool,
          AthenaDataProvider: deployedAt.AthenaDataProvider,
        },
      ),
    );
    txCount++;
  }

  if (deploymentOrder[txCount] === "RewardManager") {
    deployExecutors.push(async () =>
      deployRewardManager(deployer, [
        deployedAt.LiquidityManager,
        deployedAt.EcclesiaDao,
        deployedAt.AthenaPositionToken,
        deployedAt.AthenaCoverToken,
        deployedAt.AthenaToken,
        config.farmingBlockStart || (await getCurrentBlockNumber()) + 40000,
        config.yieldBonuses,
      ]),
    );
    txCount++;
  }

  // ======= DAO ======= //

  if (deploymentOrder[txCount] === "EcclesiaDao") {
    deployExecutors.push(async () =>
      deployEcclesiaDao(deployer, [
        deployedAt.AthenaToken,
        deployedAt.Staking,
        deployedAt.LiquidityManager,
        deployedAt.StrategyManager,
        config.treasuryWallet.address,
        config.leverageRiskWallet.address,
      ]),
    );
    txCount++;
  }

  // ======= Claims ======= //
  if (deploymentOrder[txCount] === "MockArbitrator") {
    deployExecutors.push(async () =>
      deployMockArbitrator(deployer, [config.arbitrationCollateral]),
    );
    txCount++;
  }

  // Check that deploy order matches expected deployment count
  if (
    deploymentOrder.length !== deployExecutors.length ||
    txCount !== deploymentOrder.length
  ) {
    throw Error("Deployment order mismatch");
  }

  // Execute all deploy executors
  for (const executor of deployExecutors) {
    await executor();
  }

  const AthenaCoverToken = AthenaCoverToken__factory.connect(
    deployedAt.AthenaCoverToken,
    deployer,
  );
  const AthenaPositionToken = AthenaPositionToken__factory.connect(
    deployedAt.AthenaPositionToken,
    deployer,
  );
  const AthenaToken = AthenaToken__factory.connect(
    deployedAt.AthenaToken,
    deployer,
  );
  const EcclesiaDao = EcclesiaDao__factory.connect(
    deployedAt.EcclesiaDao,
    deployer,
  );
  const MockArbitrator = MockArbitrator__factory.connect(
    deployedAt.MockArbitrator,
    deployer,
  );
  const ClaimManager = ClaimManager__factory.connect(
    deployedAt.ClaimManager,
    deployer,
  );
  const LiquidityManager = LiquidityManager__factory.connect(
    deployedAt.LiquidityManager,
    deployer,
  );
  const StrategyManager = StrategyManager__factory.connect(
    deployedAt.StrategyManager,
    deployer,
  );
  const RewardManager = RewardManager__factory.connect(
    deployedAt.RewardManager,
    deployer,
  );
  const FarmingRange = FarmingRange__factory.connect(
    deployedAt.FarmingRange,
    deployer,
  );
  const Staking = Staking__factory.connect(deployedAt.Staking, deployer);

  const PoolMath = PoolMath__factory.connect(deployedAt.PoolMath, deployer);
  const VirtualPool = VirtualPool__factory.connect(
    deployedAt.VirtualPool,
    deployer,
  );
  const AthenaDataProvider = AthenaDataProvider__factory.connect(
    deployedAt.AthenaDataProvider,
    deployer,
  );

  const contracts = {
    TetherToken,
    CircleToken,
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
    FarmingRange,
    Staking,
    PoolMath,
    VirtualPool,
    AthenaDataProvider,
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
