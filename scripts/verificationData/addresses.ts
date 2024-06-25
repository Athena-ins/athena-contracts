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
    AthenaCoverToken: "0x5d104467f1f6e904bd4e20ea3a372e03c4eacba5",
    AthenaPositionToken: "0xa6bf65ab9768493322c991e055a5d115e9a83bc3",
    AthenaToken: "0x57c664411f0abe04ab24ae7b8a24ffbad8aad474",
    EcclesiaDao: "0x0000000000000000000000000000000000000000",
    MockArbitrator: "0x0000000000000000000000000000000000000000",
    ClaimManager: "0x0000000000000000000000000000000000000000",
    LiquidityManager: "0x1a1625963133ff8290666d0d2f33f6fb3fd36042",
    StrategyManager: "0x95c6b6db864aca6eab206a1726a8fec2ac8e0730",
    RewardManager: "0x0000000000000000000000000000000000000000",
    FarmingRange: "0x0000000000000000000000000000000000000000",
    Staking: "0x0000000000000000000000000000000000000000",
    PoolMath: "0x70e2334e8d6969db7f3c1d7d561297ca224c22d1",
    VirtualPool: "0x882bab766ed86fec56e583c07d319eeb9474e3c7",
    AthenaDataProvider: "0x2303b1c8135016a521aaea8b52a17047c8a52963",
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
