import { utils } from "ethers";
import {
  entityProviderChainId,
  genContractAddress,
  getCurrentBlockNumber,
  isNonNullAddress,
  postTxHandler,
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
  StrategyManagerVE,
  StrategyManagerVE__factory,
  // Other
  TetherToken__factory,
  VirtualPool__factory,
  WrappedTokenGateway__factory,
  PoolManager__factory,
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
  deployStrategyManagerVE,
  deployVirtualPool,
  deployWrappedTokenGateway,
  deployPoolManager,
} from "./deployers";
// Types
import { Wallet } from "ethers";
import { ProtocolConfig, ProtocolContracts } from "./deployers";

const { parseUnits } = utils;

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

// ======================= //
// === Deploy protocol === //
// ======================= //

export const deploymentOrder: Partial<keyof ProtocolContracts | "_approve">[] =
  [
    // "AthenaCoverToken",
    // "AthenaPositionToken",
    // "AthenaToken",
    // "_approve",
    // "PoolMath",
    // "VirtualPool",
    // "AthenaDataProvider",
    // "ClaimManager",
    // "StrategyManager",
    // "LiquidityManager",
    // "RewardManager",
    // "EcclesiaDao",
    // "AthenaArbitrator",
  ];

export type VEProtocolContracts = ProtocolContracts & {
  StrategyManager: StrategyManagerVE;
};

export async function deployAllContractsAndInitializeProtocolVE(
  deployer: Wallet,
  config: ProtocolConfig,
  addresses?: { [key: string]: string },
  logAddresses = false,
): Promise<VEProtocolContracts> {
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
    if (!isNonNullAddress(deployedAt.LiquidityManager)) {
      throw Error("Missing address");
    }

    deployExecutors.push(() =>
      deployAthenaCoverToken(deployer, [deployedAt.LiquidityManager]),
    );
    txCount++;
  }

  if (deploymentOrder[txCount] === "AthenaPositionToken") {
    if (!isNonNullAddress(deployedAt.LiquidityManager)) {
      throw Error("Missing address");
    }

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
    if (!isNonNullAddress(deployedAt.AthenaToken)) {
      throw Error("Missing address");
    }

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
    if (!isNonNullAddress(deployedAt.PoolMath)) {
      throw Error("Missing address");
    }

    deployExecutors.push(() =>
      deployVirtualPool(deployer, [], {
        PoolMath: deployedAt.PoolMath,
      }),
    );
    txCount++;
  }

  if (deploymentOrder[txCount] === "AthenaDataProvider") {
    if (
      !isNonNullAddress(deployedAt.PoolMath) ||
      !isNonNullAddress(deployedAt.VirtualPool)
    ) {
      throw Error("Missing address");
    }

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
    if (
      !isNonNullAddress(deployedAt.AthenaCoverToken) ||
      !isNonNullAddress(deployedAt.LiquidityManager) ||
      !isNonNullAddress(deployedAt.AthenaArbitrator)
    ) {
      throw Error("Missing address");
    }

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
    if (!config.wstETH || !config.amphrETH || !config.amphrLRT)
      throw Error("Missing amphor strategy params");

    if (
      !isNonNullAddress(deployedAt.LiquidityManager) ||
      !isNonNullAddress(config.buybackWallet.address)
    ) {
      throw Error("Missing address");
    }

    deployExecutors.push(() =>
      deployStrategyManagerVE(deployer, [
        deployedAt.LiquidityManager,
        deployer.address, // EcclesiaDao
        aaveLendingPoolV3Address(chainId),
        usdcTokenAddress(chainId),
        config.buybackWallet.address,
        config.payoutDeductibleRate, // payoutDeductibleRate
        config.strategyFeeRate, // strategyFeeRate
        config.wstETH as string,
        config.amphrETH as string,
        config.amphrLRT as string,
      ]),
    );
    txCount++;
  }

  if (deploymentOrder[txCount] === "LiquidityManager") {
    if (
      !isNonNullAddress(deployedAt.AthenaPositionToken) ||
      !isNonNullAddress(deployedAt.AthenaCoverToken) ||
      !isNonNullAddress(deployedAt.StrategyManager) ||
      !isNonNullAddress(deployedAt.ClaimManager)
    ) {
      throw Error("Missing address");
    }

    deployExecutors.push(() =>
      deployLiquidityManager(
        deployer,
        [
          deployedAt.AthenaPositionToken,
          deployedAt.AthenaCoverToken,
          deployer.address, // EcclesiaDao
          deployedAt.StrategyManager,
          deployedAt.ClaimManager, // ClaimManager
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
    if (
      !isNonNullAddress(deployedAt.LiquidityManager) ||
      !isNonNullAddress(deployedAt.AthenaPositionToken) ||
      !isNonNullAddress(deployedAt.AthenaCoverToken) ||
      !isNonNullAddress(deployedAt.AthenaToken)
    ) {
      throw Error("Missing address");
    }

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
    if (
      !isNonNullAddress(deployedAt.AthenaToken) ||
      !isNonNullAddress(deployedAt.Staking) ||
      !isNonNullAddress(deployedAt.LiquidityManager) ||
      !isNonNullAddress(deployedAt.StrategyManager) ||
      !isNonNullAddress(config.treasuryWallet.address) ||
      !isNonNullAddress(config.leverageRiskWallet.address)
    ) {
      throw Error("Missing address");
    }

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
    if (!isNonNullAddress(deployedAt.ClaimManager)) {
      throw Error("Missing address");
    }

    deployExecutors.push(async () =>
      deployAthenaArbitrator(deployer, [
        deployedAt.ClaimManager,
        config.arbitrationCost,
      ]),
    );
    txCount++;
  }

  // ======= MISC ======= //

  if (deploymentOrder[txCount] === "WrappedTokenGateway") {
    if (!config.wstETH)
      throw Error("Missing Lido wrapped staked ETH addresses");

    deployExecutors.push(async () =>
      deployWrappedTokenGateway(deployer, [
        wethAddress, // weth
        config.wstETH as string, // wsteth
        deployedAt.LiquidityManager, // liquidityManager
        deployedAt.AthenaPositionToken, // positionToken
        deployedAt.AthenaCoverToken, // coverToken
      ]),
    );
    txCount++;
  }

  if (deploymentOrder[txCount] === "PoolManager") {
    deployExecutors.push(async () =>
      deployPoolManager(deployer, [
        deployedAt.LiquidityManager, // liquidityManager
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
  const StrategyManager = StrategyManagerVE__factory.connect(
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

  const WrappedTokenGateway = WrappedTokenGateway__factory.connect(
    deployedAt.WrappedTokenGateway || ADDRESS_ZERO,
    deployer,
  );

  const PoolManager = PoolManager__factory.connect(
    deployedAt.PoolManager || ADDRESS_ZERO,
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
    WrappedTokenGateway,
    PoolManager,
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
