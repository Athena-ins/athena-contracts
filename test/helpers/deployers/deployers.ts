import { BigNumber, constants, Signer, Wallet } from "ethers";
// typechain
import {
  AthenaArbitrator,
  AthenaArbitrator__factory,
  AthenaCoverToken,
  // Tokens
  AthenaCoverToken__factory,
  AthenaDataProvider,
  AthenaDataProvider__factory,
  AthenaPositionToken,
  AthenaPositionToken__factory,
  AthenaToken,
  AthenaToken__factory,
  BasicProxy,
  BasicProxy__factory,
  ClaimManager,
  // Managers
  ClaimManager__factory,
  EcclesiaDao,
  // Dao
  EcclesiaDao__factory,
  ERC20,
  FarmingRange,
  // Rewards
  FarmingRange__factory,
  // Other
  IGnosisSafeWallet,
  // Claims
  IKlerosLiquid,
  IWETH,
  LiquidityManager,
  LiquidityManager__factory,
  MockToken,
  MockToken__factory,
  PoolManager,
  PoolManager__factory,
  PoolMath,
  // Libs
  PoolMath__factory,
  ProtocolManager,
  ProtocolManager__factory,
  RewardManager,
  RewardManager__factory,
  SafeProxy,
  SafeProxy__factory,
  Staking,
  Staking__factory,
  StrategyManager,
  StrategyManager__factory,
  StrategyManagerCore,
  StrategyManagerCore__factory,
  StrategyManagerEthereum,
  StrategyManagerEthereum__factory,
  StrategyManagerLisk,
  StrategyManagerLisk__factory,
  TetherToken,
  VirtualPool,
  VirtualPool__factory,
  WrappedTokenGateway,
  WrappedTokenGateway__factory,
} from "../../../typechain";
// Types
import { ConnectedProtocolContracts } from "../contracts-getters";

// ================================= //
// === Deploy contract functions === //
// ================================= //

type WithAddress<T> = T & { address: string };

export async function deployMockToken(
  signer: Signer,
  args: Parameters<MockToken__factory["deploy"]>,
): Promise<WithAddress<MockToken>> {
  return new MockToken__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy MockToken:\n${err}`);
  });
}

export async function deployPoolMath(
  signer: Signer,
  args: Parameters<PoolMath__factory["deploy"]>,
): Promise<WithAddress<PoolMath>> {
  return new PoolMath__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy PoolMath:\n${err}`);
  });
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
  )
    .deploy(...args)
    .catch((err) => {
      throw Error(`Deploy VirtualPool:\n${err}`);
    });
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
  )
    .deploy(...args)
    .catch((err) => {
      throw Error(`Deploy AthenaDataProvider:\n${err}`);
    });
}

export async function deployAthenaArbitrator(
  signer: Signer,
  args: Parameters<AthenaArbitrator__factory["deploy"]>,
): Promise<WithAddress<AthenaArbitrator>> {
  return new AthenaArbitrator__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy AthenaArbitrator:\n${err}`);
  });
}

export async function deployEcclesiaDao(
  signer: Signer,
  args: Parameters<EcclesiaDao__factory["deploy"]>,
): Promise<WithAddress<EcclesiaDao>> {
  return new EcclesiaDao__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy EcclesiaDao:\n${err}`);
  });
}

export async function deployClaimManager(
  signer: Signer,
  args: Parameters<ClaimManager__factory["deploy"]>,
): Promise<WithAddress<ClaimManager>> {
  return new ClaimManager__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy ClaimManager:\n${err}`);
  });
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
  )
    .deploy(...args)
    .catch((err) => {
      throw Error(`Deploy LiquidityManager:\n${err}`);
    });
}

export async function deployStrategyManager(
  signer: Signer,
  args: Parameters<StrategyManager__factory["deploy"]>,
): Promise<WithAddress<StrategyManager>> {
  return new StrategyManager__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy StrategyManager:\n${err}`);
  });
}

export async function deployStrategyManagerEthereum(
  signer: Signer,
  args: Parameters<StrategyManagerEthereum__factory["deploy"]>,
): Promise<WithAddress<StrategyManagerEthereum>> {
  return new StrategyManagerEthereum__factory(signer)
    .deploy(...args)
    .catch((err) => {
      throw Error(`Deploy StrategyManagerEthereum:\n${err}`);
    });
}

export async function deployStrategyManagerLisk(
  signer: Signer,
  args: Parameters<StrategyManagerLisk__factory["deploy"]>,
): Promise<WithAddress<StrategyManagerLisk>> {
  return new StrategyManagerLisk__factory(signer)
    .deploy(...args)
    .catch((err) => {
      throw Error(`Deploy StrategyManagerLisk:\n${err}`);
    });
}
export async function deployStrategyManagerCore(
  signer: Signer,
  args: Parameters<StrategyManagerCore__factory["deploy"]>,
): Promise<WithAddress<StrategyManagerCore>> {
  return new StrategyManagerCore__factory(signer)
    .deploy(...args)
    .catch((err) => {
      throw Error(`Deploy StrategyManagerCore:\n${err}`);
    });
}

export async function deployFarmingRange(
  signer: Signer,
  args: Parameters<FarmingRange__factory["deploy"]>,
): Promise<WithAddress<FarmingRange>> {
  return new FarmingRange__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy FarmingRange:\n${err}`);
  });
}

export async function deployRewardManager(
  signer: Signer,
  args: Parameters<RewardManager__factory["deploy"]>,
): Promise<WithAddress<RewardManager>> {
  return new RewardManager__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy RewardManager:\n${err}`);
  });
}

export async function deployStaking(
  signer: Signer,
  args: Parameters<Staking__factory["deploy"]>,
): Promise<WithAddress<Staking>> {
  return new Staking__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy Staking:\n${err}`);
  });
}

export async function deployAthenaCoverToken(
  signer: Signer,
  args: Parameters<AthenaCoverToken__factory["deploy"]>,
): Promise<WithAddress<AthenaCoverToken>> {
  return new AthenaCoverToken__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy AthenaCoverToken:\n${err}`);
  });
}

export async function deployAthenaPositionToken(
  signer: Signer,
  args: Parameters<AthenaPositionToken__factory["deploy"]>,
): Promise<WithAddress<AthenaPositionToken>> {
  return new AthenaPositionToken__factory(signer)
    .deploy(...args)
    .catch((err) => {
      throw Error(`Deploy AthenaPositionToken:\n${err}`);
    });
}

export async function deployAthenaToken(
  signer: Signer,
  args: Parameters<AthenaToken__factory["deploy"]>,
): Promise<WithAddress<AthenaToken>> {
  return new AthenaToken__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy AthenaToken:\n${err}`);
  });
}

export async function deployWrappedTokenGateway(
  signer: Signer,
  args: Parameters<WrappedTokenGateway__factory["deploy"]>,
): Promise<WithAddress<WrappedTokenGateway>> {
  return new WrappedTokenGateway__factory(signer)
    .deploy(...args)
    .catch((err) => {
      throw Error(`Deploy WrappedTokenGateway:\n${err}`);
    });
}

export async function deployPoolManager(
  signer: Signer,
  args: Parameters<PoolManager__factory["deploy"]>,
): Promise<WithAddress<PoolManager>> {
  return new PoolManager__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy PoolManager:\n${err}`);
  });
}

export async function deployProtocolManager(
  signer: Signer,
  args: Parameters<ProtocolManager__factory["deploy"]>,
): Promise<WithAddress<ProtocolManager>> {
  return new ProtocolManager__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy ProtocolManager:\n${err}`);
  });
}

export async function deploySafeProxy(
  signer: Signer,
  args: Parameters<SafeProxy__factory["deploy"]>,
): Promise<WithAddress<SafeProxy>> {
  return new SafeProxy__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy SafeProxy:\n${err}`);
  });
}

export async function deployBasicProxy(
  signer: Signer,
  args: Parameters<BasicProxy__factory["deploy"]>,
): Promise<WithAddress<BasicProxy>> {
  return new BasicProxy__factory(signer).deploy(...args).catch((err) => {
    throw Error(`Deploy BasicProxy:\n${err}`);
  });
}

export async function deployProxyStrategyManager(
  signer: Signer,
  args: Parameters<BasicProxy__factory["deploy"]>,
): Promise<WithAddress<StrategyManager>> {
  return deployBasicProxy(
    signer,
    args,
  ) as unknown as WithAddress<StrategyManager>;
}

// ======================= //
// === Deploy protocol === //
// ======================= //

export type ProtocolConfig = {
  subcourtId: number;
  nbOfJurors: number;
  baseMetaEvidenceURI: string;
  claimCollateral: BigNumber;
  arbitrationCost: BigNumber; // in ETH for centralized AthenaArbitrator
  appealCost: BigNumber; // in ETH for centralized AthenaArbitrator
  // in seconds
  claimPeriods: {
    challenge: number;
    evidenceUpload: number;
    overrule: number;
  };
  // base 10_000
  claimMultipliers: {
    winner: number;
    loser: number;
    loserAppealPeriodMultiplier: number;
  };
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
  // For Amphor strategy
  wstETH?: string;
  amphrETH?: string;
  amphrLRT?: string;
  morphoMevVault?: string;
  inceptionVault?: string;
  // For Lisk strategy
  usdt?: string;
  lsk?: string;
  // For Core strategy
  colendLendingPool?: string;
  USDC?: string;
  sUSDC?: string;
  wCORE?: string;
  stCORE?: string;
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
  WrappedTokenGateway: WithAddress<WrappedTokenGateway>;
  ProxyStrategyManager?: WithAddress<StrategyManager>;
  PoolManager?: WithAddress<PoolManager>;
  KlerosLiquid?: WithAddress<IKlerosLiquid>;
  GnosisSafeWallet?: WithAddress<IGnosisSafeWallet>;
  AthenaMultisig?: WithAddress<SafeProxy>;
  ProtocolManager?: WithAddress<ProtocolManager>;
};

export type ProtocolContracts =
  | ConnectedProtocolContracts
  | DeployedProtocolContracts;

export type DeploymentList = Partial<keyof ProtocolContracts | "_approve">[];

export const ADDRESS_ZERO = constants.AddressZero;
