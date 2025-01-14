import hre from "hardhat";
// typechain
import {
  // Dao
  EcclesiaDao,
  EcclesiaDao__factory,
  // Claims
  AthenaArbitrator,
  AthenaArbitrator__factory,
  // Managers
  ClaimManager,
  ClaimManager__factory,
  LiquidityManager,
  LiquidityManager__factory,
  StrategyManager,
  StrategyManager__factory,
  StrategyManagerVE,
  StrategyManagerVE__factory,
  StrategyManagerMorpho,
  StrategyManagerMorpho__factory,
  StrategyManagerVL,
  StrategyManagerVL__factory,
  StrategyManagerCore,
  StrategyManagerCore__factory,
  // Rewards
  FarmingRange,
  FarmingRange__factory,
  RewardManager,
  RewardManager__factory,
  Staking,
  Staking__factory,
  // Tokens
  AthenaCoverToken,
  AthenaCoverToken__factory,
  AthenaPositionToken,
  AthenaPositionToken__factory,
  AthenaToken,
  AthenaToken__factory,
  // Misc
  WrappedTokenGateway,
  WrappedTokenGateway__factory,
  BasicProxy,
  BasicProxy__factory,
  // Libs
  PoolMath,
  PoolMath__factory,
  VirtualPool,
  VirtualPool__factory,
  AthenaDataProvider,
  AthenaDataProvider__factory,
  // Tokens
  TetherToken,
  TetherToken__factory,
  IWETH,
  IWETH__factory,
  ERC20,
  ERC20__factory,
} from "../../typechain/";
import { ProtocolContracts } from "./deployers";
import { NetworkAddressDirectory } from "../../scripts/verificationData/addresses";
import { get } from "http";

export type ConnectWithAddress<F> = F extends {
  connect: (...args: any[]) => infer R;
}
  ? R & { address: string }
  : never;

async function connectWrapper<
  F extends {
    connect: (address: string, signer: any) => any;
  },
>(factory: F, address: string): Promise<ConnectWithAddress<F>> {
  const signer = (await hre.ethers.getSigners())[0];
  const contract = factory.connect(address, signer) as ConnectWithAddress<F>;

  // contract.address = address;
  return contract;
}

//====================//
//==== CONNECTORS ====//
//====================//

export async function getEcclesiaDao(address: string) {
  return connectWrapper(EcclesiaDao__factory, address);
}
export async function getAthenaArbitrator(address: string) {
  return connectWrapper(AthenaArbitrator__factory, address);
}
export async function getClaimManager(address: string) {
  return connectWrapper(ClaimManager__factory, address);
}
export async function getLiquidityManager(address: string) {
  return connectWrapper(LiquidityManager__factory, address);
}
export async function getStrategyManager(address: string) {
  return connectWrapper(StrategyManager__factory, address);
}
export async function getStrategyManagerVE(address: string) {
  return connectWrapper(StrategyManagerVE__factory, address);
}
export async function getStrategyManagerMorpho(address: string) {
  return connectWrapper(StrategyManagerMorpho__factory, address);
}
export async function getStrategyManagerVL(address: string) {
  return connectWrapper(StrategyManagerVL__factory, address);
}
export async function getStrategyManagerCore(address: string) {
  return connectWrapper(StrategyManagerCore__factory, address);
}
export async function getFarmingRange(address: string) {
  return connectWrapper(FarmingRange__factory, address);
}
export async function getRewardManager(address: string) {
  return connectWrapper(RewardManager__factory, address);
}
export async function getStaking(address: string) {
  return connectWrapper(Staking__factory, address);
}
export async function getAthenaCoverToken(address: string) {
  return connectWrapper(AthenaCoverToken__factory, address);
}
export async function getAthenaPositionToken(address: string) {
  return connectWrapper(AthenaPositionToken__factory, address);
}
export async function getAthenaToken(address: string) {
  return connectWrapper(AthenaToken__factory, address);
}
export async function getPoolMath(address: string) {
  return connectWrapper(PoolMath__factory, address);
}
export async function getVirtualPool(address: string) {
  return connectWrapper(VirtualPool__factory, address);
}
export async function getAthenaDataProvider(address: string) {
  return connectWrapper(AthenaDataProvider__factory, address);
}
export async function getTetherToken(address: string) {
  return connectWrapper(TetherToken__factory, address);
}
export async function getWETH(address: string) {
  return connectWrapper(IWETH__factory, address);
}
export async function getERC20(address: string) {
  return connectWrapper(ERC20__factory, address);
}
export async function getWrappedTokenGateway(address: string) {
  return connectWrapper(WrappedTokenGateway__factory, address);
}
export async function getBasicProxy(address: string) {
  return connectWrapper(BasicProxy__factory, address);
}

//==================//
//==== PROTOCOL ====//
//==================//

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
  StrategyManager:
    | ConnectWithAddress<StrategyManager>
    | ConnectWithAddress<StrategyManagerVE>
    | ConnectWithAddress<StrategyManagerMorpho>
    | ConnectWithAddress<StrategyManagerVL>
    | ConnectWithAddress<StrategyManagerCore>;
  FarmingRange: ConnectWithAddress<FarmingRange>;
  RewardManager: ConnectWithAddress<RewardManager>;
  Staking: ConnectWithAddress<Staking>;
  PoolMath: ConnectWithAddress<PoolMath>;
  VirtualPool: ConnectWithAddress<VirtualPool>;
  AthenaDataProvider: ConnectWithAddress<AthenaDataProvider>;
  WrappedTokenGateway: ConnectWithAddress<WrappedTokenGateway>;
  ProxyStrategyManager?: ConnectWithAddress<StrategyManager>;
};

export type DefaultConnectedProtocolContracts = ConnectedProtocolContracts & {
  StrategyManager: ConnectWithAddress<StrategyManager>;
};
export type VEConnectedProtocolContracts = ConnectedProtocolContracts & {
  StrategyManager: ConnectWithAddress<StrategyManagerVE>;
};
export type MorphoConnectedProtocolContracts = ConnectedProtocolContracts & {
  StrategyManager: ConnectWithAddress<StrategyManagerMorpho>;
};
export type VLConnectedProtocolContracts = ConnectedProtocolContracts & {
  StrategyManager: ConnectWithAddress<StrategyManagerVL>;
};
export type CoreConnectedProtocolContracts = ConnectedProtocolContracts & {
  StrategyManager: ConnectWithAddress<StrategyManagerCore>;
};

export async function getConnectedProtocolContracts(
  addresses: NetworkAddressDirectory,
  version: "ethereum-amphor",
): Promise<VEConnectedProtocolContracts>;

export async function getConnectedProtocolContracts(
  addresses: NetworkAddressDirectory,
  version: "ethereum-morpho",
): Promise<MorphoConnectedProtocolContracts>;

export async function getConnectedProtocolContracts(
  addresses: NetworkAddressDirectory,
  version: "lisk",
): Promise<VLConnectedProtocolContracts>;

export async function getConnectedProtocolContracts(
  addresses: NetworkAddressDirectory,
  version: "core",
): Promise<CoreConnectedProtocolContracts>;

export async function getConnectedProtocolContracts(
  addresses: NetworkAddressDirectory,
  version: undefined,
): Promise<DefaultConnectedProtocolContracts>;

export async function getConnectedProtocolContracts(
  addresses: NetworkAddressDirectory,
  version?: "ethereum-amphor" | "ethereum-morpho" | "lisk" | "core",
): Promise<ConnectedProtocolContracts> {
  let stratManagerGetter:
    | typeof getStrategyManager
    | typeof getStrategyManagerVE
    | typeof getStrategyManagerMorpho
    | typeof getStrategyManagerVL
    | typeof getStrategyManagerCore = getStrategyManager;

  if (version === "ethereum-amphor") stratManagerGetter = getStrategyManagerVE;
  if (version === "ethereum-morpho")
    stratManagerGetter = getStrategyManagerMorpho;
  if (version === "lisk") stratManagerGetter = getStrategyManagerVL;
  if (version === "core") stratManagerGetter = getStrategyManagerCore;

  const [
    EcclesiaDao,
    AthenaArbitrator,
    ClaimManager,
    LiquidityManager,
    StrategyManager,
    FarmingRange,
    RewardManager,
    Staking,
    AthenaCoverToken,
    AthenaPositionToken,
    AthenaToken,
    PoolMath,
    VirtualPool,
    AthenaDataProvider,
    TetherToken,
    CircleToken,
    WethToken,
    WrappedTokenGateway,
  ] = await Promise.all([
    getEcclesiaDao(addresses.EcclesiaDao),
    getAthenaArbitrator(addresses.AthenaArbitrator),
    getClaimManager(addresses.ClaimManager),
    getLiquidityManager(addresses.LiquidityManager),
    stratManagerGetter(addresses.StrategyManager),
    getFarmingRange(addresses.FarmingRange),
    getRewardManager(addresses.RewardManager),
    getStaking(addresses.Staking),
    getAthenaCoverToken(addresses.AthenaCoverToken),
    getAthenaPositionToken(addresses.AthenaPositionToken),
    getAthenaToken(addresses.AthenaToken),
    getPoolMath(addresses.PoolMath),
    getVirtualPool(addresses.VirtualPool),
    getAthenaDataProvider(addresses.AthenaDataProvider),
    getTetherToken(addresses.TetherToken),
    getERC20(addresses.CircleToken),
    getWETH(addresses.WethToken),
    getWrappedTokenGateway(addresses.WrappedTokenGateway),
  ]);

  return {
    EcclesiaDao,
    AthenaArbitrator,
    ClaimManager,
    LiquidityManager,
    StrategyManager,
    FarmingRange,
    RewardManager,
    Staking,
    AthenaCoverToken,
    AthenaPositionToken,
    AthenaToken,
    PoolMath,
    VirtualPool,
    AthenaDataProvider,
    TetherToken,
    CircleToken,
    WethToken,
    WrappedTokenGateway,
  };
}

//===============//
//==== OTHER ====//
//===============//

export async function getConnectedTokenContracts(
  tokenData: {
    name: string;
    symbol: string;
    decimals: bigint;
    address: string;
    wrapped?: boolean;
  }[],
): Promise<ConnectWithAddress<ERC20 | IWETH>[]> {
  return Promise.all(
    tokenData.map(async (token) =>
      token.symbol === "WETH" || token.symbol === "WMATIC" || token.wrapped
        ? await getWETH(token.address)
        : await getERC20(token.address),
    ),
  );
}
