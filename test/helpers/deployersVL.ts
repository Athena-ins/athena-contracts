import { TetherToken } from "./../../typechain/TetherToken.d";
import { utils } from "ethers";
import {
  entityProviderChainId,
  genContractAddress,
  getCurrentBlockNumber,
  postTxHandler,
  isNonNullAddress,
} from "./hardhat";
import {
  aaveLendingPoolV3Address,
  usdcTokenAddress,
  usdtTokenAddress,
  wethTokenAddress,
} from "./protocol";
// typechain
import {
  // Claims
  AthenaArbitrator__factory,
  // Tokens
  AthenaCoverToken__factory,
  AthenaDataProvider__factory,
  AthenaPositionToken__factory,
  AthenaToken__factory,
  // Managers
  ClaimManager__factory,
  ERC20__factory,
  // Dao
  EcclesiaDao__factory,
  // Rewards
  FarmingRange__factory,
  IWETH__factory,
  LiquidityManager__factory,
  // Libs
  PoolMath__factory,
  RewardManager__factory,
  Staking__factory,
  StrategyManagerVL__factory,
  StrategyManagerVL,
  // Other
  TetherToken__factory,
  VirtualPool__factory,
  MockToken__factory,
} from "../../typechain";
import {
  deployAthenaArbitrator,
  deployAthenaCoverToken,
  deployAthenaDataProvider,
  deployAthenaPositionToken,
  deployAthenaToken,
  deployClaimManager,
  deployEcclesiaDao,
  deployLiquidityManager,
  deployPoolMath,
  deployRewardManager,
  deployStrategyManagerVL,
  deployVirtualPool,
  deployMockToken,
} from "./deployers";
// Types
import { Wallet } from "ethers";
import { ProtocolConfig, ProtocolContracts } from "./deployers";

const { parseUnits } = utils;

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

// ======================= //
// === Deploy protocol === //
// ======================= //

export type VLProtocolContracts = ProtocolContracts & {
  StrategyManager: StrategyManagerVL;
};

export const deploymentOrder: Partial<keyof ProtocolContracts | "_approve">[] =
  [
    "TetherToken",
    "CircleToken",
    "AthenaCoverToken",
    "AthenaPositionToken",
    // "AthenaToken",
    // "_approve",
    "PoolMath",
    "VirtualPool",
    "AthenaDataProvider",
    "ClaimManager",
    "StrategyManager",
    "LiquidityManager",
    // "RewardManager",
    // "EcclesiaDao",
    "AthenaArbitrator",
  ];

export async function deployAllContractsAndInitializeProtocolVL(
  deployer: Wallet,
  config: ProtocolConfig,
  addresses?: { [key: string]: string },
  logAddresses = false,
): Promise<ProtocolContracts> {
  const chainId = await entityProviderChainId(deployer);
  if (!chainId) throw Error("No chainId found for deployment signer");

  let txCount = 0;
  let deployExecutors = [];

  const deployedAt: { [key: string]: string } = addresses || {};

  await Promise.all(
    deploymentOrder.map((name, i) =>
      genContractAddress(deployer, i).then((address: string) => {
        deployedAt[name] = address;
      }),
    ),
  );

  // Add token interface

  // Compute deployment addresses of reward manager deployed contracts
  if (deploymentOrder.includes("RewardManager")) {
    deployedAt.FarmingRange = await genContractAddress(
      deployedAt.RewardManager,
      1,
    );
    deployedAt.Staking = await genContractAddress(deployedAt.RewardManager, 2);
  }

  // Add token interface
  const wethAddress = wethTokenAddress(chainId);
  const WethToken = IWETH__factory.connect(wethAddress, deployer);

  if (deploymentOrder[txCount] === "TetherToken") {
    deployExecutors.push(() =>
      deployMockToken(deployer, [
        "Tether USD",
        "USDT",
        utils.parseUnits("1000000", 18),
      ]),
    );
    txCount++;
  }

  if (deploymentOrder[txCount] === "CircleToken") {
    deployExecutors.push(() =>
      deployMockToken(deployer, [
        "Lisk",
        "LSK",
        utils.parseUnits("1000000", 18),
      ]),
    );
    txCount++;
  }

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
    deployExecutors.push(() => deployAthenaToken(deployer, [[]]));
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
    if (!deployedAt.TetherToken || !deployedAt.CircleToken)
      throw Error("Missing lisk strategy params");

    if (
      !isNonNullAddress(deployedAt.LiquidityManager) ||
      !isNonNullAddress(config.buybackWallet.address)
    ) {
      throw Error("Missing address");
    }

    deployExecutors.push(() =>
      deployStrategyManagerVL(deployer, [
        deployedAt.LiquidityManager,
        deployer.address, // EcclesiaDao
        aaveLendingPoolV3Address(chainId),
        deployedAt.CircleToken,
        config.buybackWallet.address,
        config.payoutDeductibleRate, // payoutDeductibleRate
        config.strategyFeeRate, // strategyFeeRate
        deployedAt.CircleToken,
        deployedAt.CircleToken,
        deployedAt.CircleToken,
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
          deployer.address, // EcclesiaDao
          deployedAt.StrategyManager,
          deployer.address, // ClaimManager
          deployer.address, // to be replaced by farming/yieldRewarder
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

  const TetherToken = MockToken__factory.connect(
    deployedAt.TetherToken || ADDRESS_ZERO,
    deployer,
  );
  const CircleToken = MockToken__factory.connect(
    deployedAt.CircleToken || ADDRESS_ZERO,
    deployer,
  );

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
  const StrategyManager = StrategyManagerVL__factory.connect(
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

  // Force cast because of mock tokens
  return contracts as unknown as ProtocolContracts;
}
