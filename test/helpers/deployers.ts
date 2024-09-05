import { utils } from "ethers";
import {
  genContractAddress,
  entityProviderChainId,
  getCurrentBlockNumber,
  postTxHandler,
} from "./hardhat";
import {
  usdtTokenAddress,
  usdcTokenAddress,
  wethTokenAddress,
  aaveLendingPoolV3Address,
} from "./protocol";
import {
  evidenceGuardianWallet,
  buybackWallet,
  treasuryWallet,
  leverageRiskWallet,
} from "./hardhat";
import { toRay } from "./utils/poolRayMath";
// typechain
import {
  // Dao
  EcclesiaDao__factory,
  EcclesiaDao,
  // Claims
  AthenaArbitrator__factory,
  AthenaArbitrator,
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

const { parseUnits } = utils;

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
const DAY_SECONDS = 24 * 60 * 60;

// ================================= //
// === Deploy contract functions === //
// ================================= //

type WithAddress<T> = T & { address: string };

export async function deployPoolMath(
  signer: Signer,
  args: Parameters<PoolMath__factory["deploy"]>,
): Promise<WithAddress<PoolMath>> {
  return new PoolMath__factory(signer).deploy(...args);
}

export async function deployVirtualPool(
  signer: Signer,
  args: Parameters<VirtualPool__factory["deploy"]>,
  libAddresses: { PoolMath: string },
): Promise<WithAddress<VirtualPool>> {
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
): Promise<WithAddress<AthenaDataProvider>> {
  return new AthenaDataProvider__factory(
    {
      ["src/libs/PoolMath.sol:PoolMath"]: libAddresses.PoolMath,
      ["src/libs/VirtualPool.sol:VirtualPool"]: libAddresses.VirtualPool,
    },
    signer,
  ).deploy(...args);
}

export async function deployAthenaArbitrator(
  signer: Signer,
  args: Parameters<AthenaArbitrator__factory["deploy"]>,
): Promise<WithAddress<AthenaArbitrator>> {
  return new AthenaArbitrator__factory(signer).deploy(...args);
}

export async function deployEcclesiaDao(
  signer: Signer,
  args: Parameters<EcclesiaDao__factory["deploy"]>,
): Promise<WithAddress<EcclesiaDao>> {
  return new EcclesiaDao__factory(signer).deploy(...args);
}

export async function deployClaimManager(
  signer: Signer,
  args: Parameters<ClaimManager__factory["deploy"]>,
): Promise<WithAddress<ClaimManager>> {
  return new ClaimManager__factory(signer).deploy(...args);
}

export async function deployLiquidityManager(
  signer: Signer,
  args: Parameters<LiquidityManager__factory["deploy"]>,
  libAddresses: {
    VirtualPool: string;
    AthenaDataProvider: string;
  },
): Promise<WithAddress<LiquidityManager>> {
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
// ): Promise<WithAddress<TestableLiquidityManager>> {
//   return new TestableLiquidityManager__factory(signer).deploy(...args);
// }

export async function deployStrategyManager(
  signer: Signer,
  args: Parameters<StrategyManager__factory["deploy"]>,
): Promise<WithAddress<StrategyManager>> {
  return new StrategyManager__factory(signer).deploy(...args);
}

export async function deployFarmingRange(
  signer: Signer,
  args: Parameters<FarmingRange__factory["deploy"]>,
): Promise<WithAddress<FarmingRange>> {
  return new FarmingRange__factory(signer).deploy(...args);
}

export async function deployRewardManager(
  signer: Signer,
  args: Parameters<RewardManager__factory["deploy"]>,
): Promise<WithAddress<RewardManager>> {
  return new RewardManager__factory(signer).deploy(...args);
}

export async function deployStaking(
  signer: Signer,
  args: Parameters<Staking__factory["deploy"]>,
): Promise<WithAddress<Staking>> {
  return new Staking__factory(signer).deploy(...args);
}

export async function deployAthenaCoverToken(
  signer: Signer,
  args: Parameters<AthenaCoverToken__factory["deploy"]>,
): Promise<WithAddress<AthenaCoverToken>> {
  return new AthenaCoverToken__factory(signer).deploy(...args);
}

export async function deployAthenaPositionToken(
  signer: Signer,
  args: Parameters<AthenaPositionToken__factory["deploy"]>,
): Promise<WithAddress<AthenaPositionToken>> {
  return new AthenaPositionToken__factory(signer).deploy(...args);
}

export async function deployAthenaToken(
  signer: Signer,
  args: Parameters<AthenaToken__factory["deploy"]>,
): Promise<WithAddress<AthenaToken>> {
  return new AthenaToken__factory(signer).deploy(...args);
}

// ======================= //
// === Deploy protocol === //
// ======================= //

export type ProtocolConfig = {
  subcourtId: number;
  nbOfJurors: number;
  challengePeriod: number;
  overrulePeriod: number;
  evidenceUploadPeriod: number;
  baseMetaEvidenceURI: string;
  claimCollateral: BigNumber;
  arbitrationCost: BigNumber; // in ETH for centralized AthenaArbitrator
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
  strategyFeeRate: BigNumber;
  farmingBlockStart: number; // leave 0 for dynamic
};

export type DeployedProtocolContracts = {
  TetherToken: WithAddress<TetherToken>;
  CircleToken: WithAddress<ERC20>;
  WethToken: WithAddress<IWETH>;
  AthenaCoverToken: WithAddress<AthenaCoverToken>;
  AthenaPositionToken: WithAddress<AthenaPositionToken>;
  AthenaToken: WithAddress<AthenaToken>;
  EcclesiaDao: WithAddress<EcclesiaDao>;
  AthenaArbitrator: WithAddress<AthenaArbitrator>;
  ClaimManager: WithAddress<ClaimManager>;
  LiquidityManager: WithAddress<LiquidityManager>;
  StrategyManager: WithAddress<StrategyManager>;
  FarmingRange: WithAddress<FarmingRange>;
  RewardManager: WithAddress<RewardManager>;
  Staking: WithAddress<Staking>;
  PoolMath: WithAddress<PoolMath>;
  VirtualPool: WithAddress<VirtualPool>;
  AthenaDataProvider: WithAddress<AthenaDataProvider>;
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
  AthenaArbitrator: ConnectWithAddress<AthenaArbitrator>;
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
  "AthenaArbitrator",
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

  // Compute deployment addresses of reward manager deployed contracts
  if (deploymentOrder.includes("RewardManager")) {
    deployedAt.FarmingRange = await genContractAddress(
      deployedAt.RewardManager,
      1,
    );
    deployedAt.Staking = await genContractAddress(deployedAt.RewardManager, 2);
  }

  // Add token interface
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
        deployedAt.AthenaArbitrator, // IArbitrator arbitrator_
        config.evidenceGuardian.address, // address metaEvidenceGuardian_
        config.subcourtId, // uint256 subcourtId_
        config.nbOfJurors, // uint256 nbOfJurors_
        config.claimCollateral, // uint256 claimCollateral_
        config.challengePeriod, // uint256 challengePeriod_
        config.overrulePeriod, // uint256 overrulePeriod_
        config.evidenceUploadPeriod, // uint256 evidenceUploadPeriod_
        config.baseMetaEvidenceURI, // string baseMetaEvidenceURI_
      ]),
    );
    txCount++;
  }

  if (deploymentOrder[txCount] === "StrategyManager") {
    deployExecutors.push(() =>
      deployStrategyManager(deployer, [
        deployedAt.LiquidityManager,
        deployedAt.EcclesiaDao,
        aaveLendingPoolV3Address(chainId),
        usdcTokenAddress(chainId),
        config.buybackWallet.address,
        config.payoutDeductibleRate, // payoutDeductibleRate
        config.strategyFeeRate, // strategyFeeRate
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
  if (deploymentOrder[txCount] === "AthenaArbitrator") {
    deployExecutors.push(async () =>
      deployAthenaArbitrator(deployer, [
        deployedAt.ClaimManager,
        config.arbitrationCost,
      ]),
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
    deployedAt.AthenaCoverToken || ADDRESS_ZERO,
    deployer,
  );
  const AthenaPositionToken = AthenaPositionToken__factory.connect(
    deployedAt.AthenaPositionToken || ADDRESS_ZERO,
    deployer,
  );
  const AthenaToken = AthenaToken__factory.connect(
    deployedAt.AthenaToken || ADDRESS_ZERO,
    deployer,
  );
  const EcclesiaDao = EcclesiaDao__factory.connect(
    deployedAt.EcclesiaDao || ADDRESS_ZERO,
    deployer,
  );
  const AthenaArbitrator = AthenaArbitrator__factory.connect(
    deployedAt.AthenaArbitrator || ADDRESS_ZERO,
    deployer,
  );
  const ClaimManager = ClaimManager__factory.connect(
    deployedAt.ClaimManager || ADDRESS_ZERO,
    deployer,
  );
  const LiquidityManager = LiquidityManager__factory.connect(
    deployedAt.LiquidityManager || ADDRESS_ZERO,
    deployer,
  );
  const StrategyManager = StrategyManager__factory.connect(
    deployedAt.StrategyManager || ADDRESS_ZERO,
    deployer,
  );
  const RewardManager = RewardManager__factory.connect(
    deployedAt.RewardManager || ADDRESS_ZERO,
    deployer,
  );
  const FarmingRange = FarmingRange__factory.connect(
    deployedAt.FarmingRange || ADDRESS_ZERO,
    deployer,
  );
  const Staking = Staking__factory.connect(
    deployedAt.Staking || ADDRESS_ZERO,
    deployer,
  );

  const PoolMath = PoolMath__factory.connect(
    deployedAt.PoolMath || ADDRESS_ZERO,
    deployer,
  );
  const VirtualPool = VirtualPool__factory.connect(
    deployedAt.VirtualPool || ADDRESS_ZERO,
    deployer,
  );
  const AthenaDataProvider = AthenaDataProvider__factory.connect(
    deployedAt.AthenaDataProvider || ADDRESS_ZERO,
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
    AthenaArbitrator,
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
