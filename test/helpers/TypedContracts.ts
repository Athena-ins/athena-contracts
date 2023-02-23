import hre from "hardhat";
import { ethers } from "hardhat";

// typechain
import {
  USDT__factory,
  ATEN__factory,
  Athena__factory,
  TokenVault__factory,
  StakingGeneralPool__factory,
  StakingPolicy__factory,
  PositionsManager__factory,
  PolicyManager__factory,
  ClaimManager__factory,
  Arbitrator__factory,
  ProtocolFactory__factory,
  PriceOracleV1__factory,
  //
  USDT,
  ATEN,
  Athena,
  TokenVault,
  StakingGeneralPool,
  StakingPolicy,
  PositionsManager,
  PolicyManager,
  ClaimManager,
  Arbitrator,
  ProtocolFactory,
  PriceOracleV1,
} from "../../typechain/";

import latestAddressHardhat from "../registries/deploys-hardhat.json";
import latestAddressGoerli from "../registries/deploys-goerli.json";

// Defaults to Goerli addresses
const chooseAddressSet = () => {
  console.log("\nNETWORK =", hre.network.name.toUpperCase());
  if (hre.network.name === "hardhat") {
    return latestAddressHardhat;
  }
  return latestAddressGoerli;
};

// Uses the latest deployment addresses on Goerli
export const deploymentAddress = {
  deployer: "0x745A6BE3C44883979FC43e1Df2F7e83eE7b9f73A",
  user_1: "0xB15DdF55984b39005C64Bc2Cdbc1b38A7bD848E9",
  //
  aave_registry: "0x5E52dEc931FFb32f609681B8438A51c675cc232d",
  aave_lending_pool: "0x4bd5643ac6f66a5237e18bfa7d47cf22f1c9f210",
  //
  ...chooseAddressSet(),
};

export const contract = {
  USDT: new ethers.Contract(deploymentAddress.USDT, USDT__factory.abi) as USDT,
  ATEN: new ethers.Contract(deploymentAddress.ATEN, ATEN__factory.abi) as ATEN,
  ATHENA: new ethers.Contract(
    deploymentAddress.ATHENA,
    Athena__factory.abi
  ) as Athena,
  TOKEN_VAULT: new ethers.Contract(
    deploymentAddress.TOKEN_VAULT,
    TokenVault__factory.abi
  ) as TokenVault,
  STAKING_GP: new ethers.Contract(
    deploymentAddress.STAKING_GP,
    StakingGeneralPool__factory.abi
  ) as StakingGeneralPool,
  STAKING_POLICY: new ethers.Contract(
    deploymentAddress.STAKING_POLICY,
    StakingPolicy__factory.abi
  ) as StakingPolicy,
  POSITIONS_MANAGER: new ethers.Contract(
    deploymentAddress.POSITIONS_MANAGER,
    PositionsManager__factory.abi
  ) as PositionsManager,
  POLICY_MANAGER: new ethers.Contract(
    deploymentAddress.POLICY_MANAGER,
    PolicyManager__factory.abi
  ) as PolicyManager,
  CLAIM_MANAGER: new ethers.Contract(
    deploymentAddress.CLAIM_MANAGER,
    ClaimManager__factory.abi
  ) as ClaimManager,
  ARBITRATOR: new ethers.Contract(
    deploymentAddress.ARBITRATOR,
    Arbitrator__factory.abi
  ) as Arbitrator,
  FACTORY_PROTOCOL: new ethers.Contract(
    deploymentAddress.FACTORY_PROTOCOL,
    ProtocolFactory__factory.abi
  ) as ProtocolFactory,
  PRICE_ORACLE_V1: new ethers.Contract(
    deploymentAddress.PRICE_ORACLE_V1,
    PriceOracleV1__factory.abi
  ) as PriceOracleV1,
};
