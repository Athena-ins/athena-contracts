import hre from "hardhat";
import { ProtocolContracts } from "../../test/helpers/deployers";

export type ProtocolContractsAddresses = {
  [K in keyof ProtocolContracts]: string;
};

function fromFork() {
  const forkTarget = process.env.HARDHAT_FORK_TARGET?.toLowerCase();

  if (!forkTarget || forkTarget !== "arbitrum") {
    throw Error("Missing or erroneous fork target");
  }

  return forkTarget === "arbitrum" ? "arbitrum" : "";
}

const networkAddresses: {
  [key: string]: ProtocolContractsAddresses;
} = {
  arbitrum: {
    TetherToken: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    CircleToken: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    WethToken: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    AthenaCoverToken: "0x69a3d9c2a61157d5796cc83bc8e09b99afa42453",
    AthenaPositionToken: "0x0f91759a2a56c50ef45a9ebb6b022f28f1cb4e5a",
    AthenaToken: "0x0b11cf2a9d2b7ba7314c9cc515da314cb65ae1f1",
    EcclesiaDao: "0x0000000000000000000000000000000000000000",
    MockArbitrator: "0x0000000000000000000000000000000000000000",
    ClaimManager: "0x0000000000000000000000000000000000000000",
    LiquidityManager: "0xdfd097cd3fe208fcbbee09b4bef79442f5693071",
    StrategyManager: "0x8a440da566b74c811e6ad1df6d36f888db451a31",
    RewardManager: "0x0000000000000000000000000000000000000000",
    FarmingRange: "0x0000000000000000000000000000000000000000",
    Staking: "0x0000000000000000000000000000000000000000",
    PoolMath: "0x1c98f659c0f293cdf2d7bc98cac1f11ca4e8fb37",
    VirtualPool: "0x7c0ca0e6d4ad499706a7433fa4b69bc969294282",
    AthenaDataProvider: "0x6affa1c136dfaa81c980724130056fa8b7b7daf1",
  },
};

export function getNetworkAddresses() {
  const networkName = hre.network.name;
  const addresses =
    networkName === "hardhat"
      ? networkAddresses[fromFork()]
      : networkAddresses[networkName];

  if (!addresses) throw Error(`Missing addresses for network ${networkName}`);

  return addresses;
}
