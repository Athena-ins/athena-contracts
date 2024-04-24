import hre from "hardhat";
// typechain
import {
  // Dao
  EcclesiaDao__factory,
  // Claims
  MockArbitrator__factory,
  // Managers
  ClaimManager__factory,
  LiquidityManager__factory,
  StrategyManager__factory,
  // Rewards
  FarmingRange__factory,
  RewardManager__factory,
  Staking__factory,
  // Tokens
  AthenaCoverToken__factory,
  AthenaPositionToken__factory,
  AthenaToken__factory,
  // Libs
  PoolMath__factory,
  VirtualPool__factory,
  AthenaDataProvider__factory,
  // Tokens
  TetherToken__factory,
  IWETH,
  IWETH__factory,
  ERC20,
  ERC20__factory,
} from "../../typechain/";
import { ProtocolContracts, ConnectedProtocolContracts } from "./deployers";

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

  contract.address = address;
  return contract;
}

//====================//
//==== CONNECTORS ====//
//====================//

export async function getEcclesiaDao(address: string) {
  return connectWrapper(EcclesiaDao__factory, address);
}
export async function getMockArbitrator(address: string) {
  return connectWrapper(MockArbitrator__factory, address);
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

//==================//
//==== PROTOCOL ====//
//==================//

export type ProtocolContractsAddresses = {
  [K in keyof ProtocolContracts]: string;
};

export async function getConnectedProtocolContracts(
  addresses: ProtocolContractsAddresses,
): Promise<ConnectedProtocolContracts> {
  const [
    EcclesiaDao,
    MockArbitrator,
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
  ] = await Promise.all([
    getEcclesiaDao(addresses.EcclesiaDao),
    getMockArbitrator(addresses.MockArbitrator),
    getClaimManager(addresses.ClaimManager),
    getLiquidityManager(addresses.LiquidityManager),
    getStrategyManager(addresses.StrategyManager),
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
  ]);

  return {
    EcclesiaDao,
    MockArbitrator,
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
  };
}

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
