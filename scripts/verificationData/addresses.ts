import hre from "hardhat";
import { ProtocolContracts } from "../../test/helpers/deployers";

export type ProtocolContractsAddresses = {
  [K in keyof ProtocolContracts]: string;
};

function fromFork() {
  const forkTarget = process.env.HARDHAT_FORK_TARGET?.toLowerCase();

  if (!forkTarget) {
    throw Error("Missing or erroneous fork target");
  }

  return forkTarget;
}

const networkAddresses: {
  [key: string]: ProtocolContractsAddresses;
} = {
  // === Dev addresses === //
  arbitrum: {
    TetherToken: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    CircleToken: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    WethToken: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    AthenaCoverToken: "0x5d104467f1f6e904bd4e20ea3a372e03c4eacba5",
    AthenaPositionToken: "0xa6bf65ab9768493322c991e055a5d115e9a83bc3",
    AthenaToken: "0x57c664411f0abe04ab24ae7b8a24ffbad8aad474",
    EcclesiaDao: "0x0000000000000000000000000000000000000000",
    AthenaArbitrator: "0xdea901a47374d10a81e314958dc484fa40d9d771",
    ClaimManager: "0x3f170340aa3e3b1d22f68ebacf3a12fdff977344",
    LiquidityManager: "0x1a1625963133ff8290666d0d2f33f6fb3fd36042",
    StrategyManager: "0x2c2991be28e66ec528bb5621f96a4d472ef9332d",
    RewardManager: "0x0000000000000000000000000000000000000000",
    FarmingRange: "0x0000000000000000000000000000000000000000",
    Staking: "0x0000000000000000000000000000000000000000",
    PoolMath: "0x70e2334e8d6969db7f3c1d7d561297ca224c22d1",
    VirtualPool: "0x882bab766ed86fec56e583c07d319eeb9474e3c7",
    AthenaDataProvider: "0x2303b1c8135016a521aaea8b52a17047c8a52963",
  },
  // === Production addresses === //
  // arbitrum: {
  //   TetherToken: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  //   CircleToken: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  //   WethToken: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  //   AthenaCoverToken: "0x69a3d9c2a61157d5796cc83bc8e09b99afa42453",
  //   AthenaPositionToken: "0x0f91759a2a56c50ef45a9ebb6b022f28f1cb4e5a",
  //   AthenaToken: "0x0b11cf2a9d2b7ba7314c9cc515da314cb65ae1f1",
  //   EcclesiaDao: "0x0000000000000000000000000000000000000000",
  //   AthenaArbitrator: "0xe239082dd5a34354764dcd5e927045ba52f46f1e",
  //   ClaimManager: "0x0adca246213398db35bcdd5676784dc9f5662f54",
  //   LiquidityManager: "0xdfd097cd3fe208fcbbee09b4bef79442f5693071",
  //   StrategyManager: "0x8a440da566b74c811e6ad1df6d36f888db451a31",
  //   RewardManager: "0x0000000000000000000000000000000000000000",
  //   FarmingRange: "0x0000000000000000000000000000000000000000",
  //   Staking: "0x0000000000000000000000000000000000000000",
  //   PoolMath: "0x1c98f659c0f293cdf2d7bc98cac1f11ca4e8fb37",
  //   VirtualPool: "0x7c0ca0e6d4ad499706a7433fa4b69bc969294282",
  //   AthenaDataProvider: "0x6affa1c136dfaa81c980724130056fa8b7b7daf1",
  // },
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
