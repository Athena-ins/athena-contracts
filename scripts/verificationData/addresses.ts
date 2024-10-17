import hre from "hardhat";
import { fromFork } from "../../test/helpers/hardhat";
// Types
import { ProtocolContracts } from "../../test/helpers/deployers";
import { NetworkName, NetworksOrFork } from "../../hardhat.config";

export type NetworkAddressDirectory = {
  [K in keyof ProtocolContracts]: string;
};

const networkAddresses: {
  [key in NetworkName]?: NetworkAddressDirectory;
} = {
  // === Production addresses === //
  mainnet: {
    TetherToken: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    CircleToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    WethToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    AthenaCoverToken: "0x69a3d9c2a61157d5796cc83bc8e09b99afa42453",
    AthenaPositionToken: "0x0f91759a2a56c50ef45a9ebb6b022f28f1cb4e5a",
    AthenaToken: "0x0000000000000000000000000000000000000000",
    EcclesiaDao: "0x0000000000000000000000000000000000000000",
    AthenaArbitrator: "0xf519b11948ffec6c2a2b7a38bc9ff4bd6533bf24",
    ClaimManager: "0x8a440da566b74c811e6ad1df6d36f888db451a31",
    LiquidityManager: "0xbc69d8d072fa7f7b2d6a3773f915e497917a22d9",
    StrategyManager: "0xdfd097cd3fe208fcbbee09b4bef79442f5693071",
    RewardManager: "0x0000000000000000000000000000000000000000",
    FarmingRange: "0x0000000000000000000000000000000000000000",
    Staking: "0x0000000000000000000000000000000000000000",
    PoolMath: "0x1c98f659c0f293cdf2d7bc98cac1f11ca4e8fb37",
    VirtualPool: "0x7c0ca0e6d4ad499706a7433fa4b69bc969294282",
    AthenaDataProvider: "0x6affa1c136dfaa81c980724130056fa8b7b7daf1",
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
  // === Dev addresses === //
  lisk_sepolia: {
    TetherToken: "0x2d7382d9d020532a937bd2231376bbcd99168393", // USDT
    CircleToken: "0x7ea5687DDA47947468Ced48503626a05E42FFee4", // LSK
    WethToken: "0x4200000000000000000000000000000000000000",
    AthenaCoverToken: "0xbb00f924e1bf263c343cbd32d0213a93b0c8a2ee",
    AthenaPositionToken: "0xfb1e29d1e8e39c26819b85489690b610c0f05973",
    EcclesiaDao: "0x0000000000000000000000000000000000000000",
    AthenaToken: "0x0000000000000000000000000000000000000000",
    AthenaArbitrator: "0xf344092de15f8ffd12159d3751fc12a5556bf8c0",
    ClaimManager: "0x315508d3c4cb36702677636efda79fe38dafb6d5",
    LiquidityManager: "0x4e12835c7b0d4edc4dc0b07ce8212f5e1f3c01e8",
    StrategyManager: "0x5d8aec03bd9b714b3c919b8577a96a6c832efc3d",
    RewardManager: "0x0000000000000000000000000000000000000000",
    FarmingRange: "0x0000000000000000000000000000000000000000",
    Staking: "0x0000000000000000000000000000000000000000",
    PoolMath: "0x4114a3e9359e20c7f3761e267b4f51e87c3b4682",
    VirtualPool: "0x9d162e2dd7fc8f5008cc268d44701d7880c423b4",
    AthenaDataProvider: "0x87d786c5ed25c58b6401f42593dee8da1f234585",
  },
  // === Dev addresses === //
  core_dao: {
    TetherToken: "0x0000000000000000000000000000000000000000", // USDT
    CircleToken: "0x0000000000000000000000000000000000000000", // LSK
    WethToken: "0x0000000000000000000000000000000000000000",
    AthenaCoverToken: "0x0000000000000000000000000000000000000000",
    AthenaPositionToken: "0x0000000000000000000000000000000000000000",
    EcclesiaDao: "0x0000000000000000000000000000000000000000",
    AthenaToken: "0x0000000000000000000000000000000000000000",
    AthenaArbitrator: "0x0000000000000000000000000000000000000000",
    ClaimManager: "0x0000000000000000000000000000000000000000",
    LiquidityManager: "0x0000000000000000000000000000000000000000",
    StrategyManager: "0x0000000000000000000000000000000000000000",
    RewardManager: "0x0000000000000000000000000000000000000000",
    FarmingRange: "0x0000000000000000000000000000000000000000",
    Staking: "0x0000000000000000000000000000000000000000",
    PoolMath: "0x0000000000000000000000000000000000000000",
    VirtualPool: "0x0000000000000000000000000000000000000000",
    AthenaDataProvider: "0x0000000000000000000000000000000000000000",
  },
  core_dao_testnet: {
    TetherToken: "0x0000000000000000000000000000000000000000", // USDT
    CircleToken: "0x0000000000000000000000000000000000000000", // LSK
    WethToken: "0x0000000000000000000000000000000000000000",
    AthenaCoverToken: "0x0000000000000000000000000000000000000000",
    AthenaPositionToken: "0x0000000000000000000000000000000000000000",
    EcclesiaDao: "0x0000000000000000000000000000000000000000",
    AthenaToken: "0x0000000000000000000000000000000000000000",
    AthenaArbitrator: "0x0000000000000000000000000000000000000000",
    ClaimManager: "0x0000000000000000000000000000000000000000",
    LiquidityManager: "0x0000000000000000000000000000000000000000",
    StrategyManager: "0x0000000000000000000000000000000000000000",
    RewardManager: "0x0000000000000000000000000000000000000000",
    FarmingRange: "0x0000000000000000000000000000000000000000",
    Staking: "0x0000000000000000000000000000000000000000",
    PoolMath: "0x0000000000000000000000000000000000000000",
    VirtualPool: "0x0000000000000000000000000000000000000000",
    AthenaDataProvider: "0x0000000000000000000000000000000000000000",
  },
};

export function getNetworkAddresses() {
  const networkName = hre.network.name as NetworksOrFork;
  const forkedNetworkName = networkName === "hardhat" ? fromFork() : "";
  const addresses =
    networkName === "hardhat"
      ? networkAddresses[forkedNetworkName as NetworkName]
      : networkAddresses[networkName];

  if (!addresses) throw Error(`Missing addresses for network ${networkName}`);

  return addresses;
}
