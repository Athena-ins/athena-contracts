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
    AthenaCoverToken: "0x19a488cc734e578d9431d6a83439b80824569bb9",
    AthenaPositionToken: "0x2d7382d9d020532a937bd2231376bbcd99168393",
    AthenaToken: "0x7ea5687dda47947468ced48503626a05e42ffee4",
    EcclesiaDao: "0x0000000000000000000000000000000000000000",
    MockArbitrator: "0x0000000000000000000000000000000000000000",
    ClaimManager: "0x0000000000000000000000000000000000000000",
    LiquidityManager: "0x87d786c5ed25c58b6401f42593dee8da1f234585",
    StrategyManager: "0x9d162e2dd7fc8f5008cc268d44701d7880c423b4",
    RewardManager: "0x0000000000000000000000000000000000000000",
    FarmingRange: "0x0000000000000000000000000000000000000000",
    Staking: "0x0000000000000000000000000000000000000000",
    PoolMath: "0xbb00f924e1bf263c343cbd32d0213a93b0c8a2ee",
    VirtualPool: "0xfb1e29d1e8e39c26819b85489690b610c0f05973",
    AthenaDataProvider: "0x4114a3e9359e20c7f3761e267b4f51e87c3b4682",
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
