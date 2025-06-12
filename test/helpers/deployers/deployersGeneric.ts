import { utils, constants } from "ethers";
import {
  genContractAddress,
  entityProviderChainId,
  getCurrentBlockNumber,
  postTxHandler,
} from "../hardhat";
import {
  usdtTokenAddress,
  usdcTokenAddress,
  wethTokenAddress,
  aaveLendingPoolV3Address,
} from "../protocol";
// typechain
import {
  // Dao
  EcclesiaDao__factory,
  EcclesiaDao,
  // Claims
  IKlerosLiquid,
  AthenaArbitrator__factory,
  AthenaArbitrator,
  // Managers
  ClaimManager__factory,
  ClaimManager,
  LiquidityManager__factory,
  LiquidityManager,
  StrategyManager__factory,
  StrategyManager,
  StrategyManagerEthereum__factory,
  StrategyManagerEthereum,
  StrategyManagerLisk__factory,
  StrategyManagerLisk,
  StrategyManagerCore__factory,
  StrategyManagerCore,
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
  IGnosisSafeWallet,
  SafeProxy__factory,
  SafeProxy,
  WrappedTokenGateway__factory,
  WrappedTokenGateway,
  PoolManager__factory,
  PoolManager,
  ProtocolManager__factory,
  ProtocolManager,
  BasicProxy__factory,
  BasicProxy,
  TetherToken__factory,
  TetherToken,
  IWETH,
  IWETH__factory,
  ERC20,
  ERC20__factory,
  MockToken__factory,
  MockToken,
} from "../../../typechain";
// Types
import { BigNumber, Wallet, Signer } from "ethers";
import { ConnectedProtocolContracts } from "../contracts-getters";
import {
  ProtocolContracts,
  ProtocolConfig,
  deployAthenaCoverToken,
  deployAthenaPositionToken,
  deployAthenaToken,
  deployClaimManager,
  deployEcclesiaDao,
  deployLiquidityManager,
  deployPoolMath,
  deployRewardManager,
  deployStrategyManager,
  deployVirtualPool,
  deployAthenaArbitrator,
  deployWrappedTokenGateway,
  deployPoolManager,
  deployAthenaDataProvider,
  DeploymentList,
  ADDRESS_ZERO,
} from "../deployers";

const deployments: DeploymentList = [
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
  "WrappedTokenGateway",
];

export async function deployAllContractsAndInitializeProtocol(
  deployer: Wallet,
  config: ProtocolConfig,
  addresses?: {
    [key: string]: string;
  },
  logAddresses = false,
  deploymentOrder: DeploymentList = deployments,
): Promise<ProtocolContracts> {
  const chainId = await entityProviderChainId(deployer);
  if (!chainId) throw Error("No chainId found for deployment signer");

  let txCount = 0;
  let deployExecutors = [];

  const deployedAt: { [key: string]: string } = addresses || {};

  await Promise.all(
    deploymentOrder.map((name, i) =>
      genContractAddress(deployer, i).then((address: string) => {
        if (name !== "_approve") deployedAt[name] = address;
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
        config.baseMetaEvidenceURI, // string memory baseMetaEvidenceURI_
        [
          config.claimPeriods.challenge,
          config.claimPeriods.evidenceUpload,
          config.claimPeriods.overrule,
        ],
        [
          config.claimMultipliers.winner,
          config.claimMultipliers.loser,
          config.claimMultipliers.loserAppealPeriodMultiplier,
        ],
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
        config.appealCost,
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
