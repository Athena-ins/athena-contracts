import hre from "hardhat";
import { ethers } from "hardhat";

const addressHardhat = {
  USDT: "0x65E2fe35C30eC218b46266F89847c63c2eDa7Dc7",
  ATEN: "0xb927A2185C1cE07f235F336Bf6bd3190C2Edc8F8",
  ATHENA: "0x6a12fe9a151Ec80Ccbee3c368f4Ae03A9c0B4f71",
  TOKEN_VAULT: "0x3BAAA3Ff32b55EE1e41833FAcF0cb29023f37018",
  STAKING_GP: "0x907D90B32B5bdd84cC0aE6b0431167AD5b565D80",
  STAKING_POLICY: "0x2fC7213A30e3Ec1d0100c731C03651B914D7d88d",
  POSITIONS_MANAGER: "0xAB56FA5D4Aa0D47f23B9b1a7bEAa60dFd6883cC9",
  POLICY_MANAGER: "0xD854eBae523aAdCeDb6b49D24cA40037b06A7EDa",
  CLAIM_MANAGER: "0x3a6EDEE021927218CcD904595247A341596cA41B",
  ARBITRATOR: "0x45CaEE014eE6684Bb05e1f09ebe5e55D98aa35c6",
  FACTORY_PROTOCOL: "0x7E91125309BE380038F8969D0DEE99C2914AFc24",
  PRICE_ORACLE_V1: "0xe6D86620EccB362d4E0a069aFc0f50D9700FF20C",
};

const addressGoerli = {
  USDT: "0x65E2fe35C30eC218b46266F89847c63c2eDa7Dc7",
  ATEN: "0x45CaEE014eE6684Bb05e1f09ebe5e55D98aa35c6",
  ATHENA: "0x77D746b295588CfdcDB442B17D7f85D10B398Bca",
  TOKEN_VAULT: "0x9297800105437F62BaC7A97fC285Ef3DC91Af54F",
  STAKING_GP: "0x3f5ed23A9Dd5De3f7d1100D68aA3951F8b67Fe23",
  STAKING_POLICY: "0x81E62B8265b2330D9a4caECbd595AA7014b52aaB",
  POSITIONS_MANAGER: "0x71CcDF4844B3aCf1eEb886E98188141028925898",
  POLICY_MANAGER: "0x31d0Dd820c05614b782eC4a598B65Ae06f989718",
  CLAIM_MANAGER: "0xF669b60715f455ddc05a60Ed674E2ff27e365040",
  ARBITRATOR: "0xaFF7c85D96C94034f4623a520cc27145fF878AD5",
  FACTORY_PROTOCOL: "0x7Cd1Ab95044468738E58aD9CA8147724470Fb165",
  PRICE_ORACLE_V1: "0x6Ce9DC3c4c5CCbf1002A5D0395149cEb0231F950",
};

// Defaults to Goerli addresses
const chooseAddressSet = () => {
  console.log("\nNETWORK =", hre.network.name.toUpperCase());
  if (hre.network.name === "hardhat") {
    return addressHardhat;
  }
  return addressGoerli;
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

// ABIs
import { abi as abiUSDT } from "../../artifacts/contracts/erc20/USDT.sol/USDT.json";
import { abi as abiATEN } from "../../artifacts/contracts/erc20/ATEN.sol/ATEN.json";
import { abi as abiAthena } from "../../artifacts/contracts/Athena.sol/Athena.json";
import { abi as abiTokenVault } from "../../artifacts/contracts/TokenVault.sol/TokenVault.json";
import { abi as abiStakingGeneralPool } from "../../artifacts/contracts/StakingGeneralPool.sol/StakingGeneralPool.json";
import { abi as abiStakingPolicy } from "../../artifacts/contracts/StakingPolicy.sol/StakingPolicy.json";
import { abi as abiPositionsManager } from "../../artifacts/contracts/PositionsManager.sol/PositionsManager.json";
import { abi as abiPolicyManager } from "../../artifacts/contracts/PolicyManager.sol/PolicyManager.json";
import { abi as abiClaimManager } from "../../artifacts/contracts/ClaimManager.sol/ClaimManager.json";
import { abi as abiArbitrator } from "../../artifacts/contracts/kleros/Arbitrator.sol/Arbitrator.json";
import { abi as abiProtocolFactory } from "../../artifacts/contracts/ProtocolFactory.sol/ProtocolFactory.json";
import { abi as abiPriceOracleV1 } from "../../artifacts/contracts/PriceOracleV1.sol/PriceOracleV1.json";

// typechain
import type { USDT as typeUSDT } from "../../typechain/USDT";
import type { ATEN as typeATEN } from "../../typechain/ATEN";
import type { Athena as typeAthena } from "../../typechain/Athena";
import type { TokenVault as typeTokenVault } from "../../typechain/TokenVault";
import type { StakingGeneralPool as typeStakingGeneralPool } from "../../typechain/StakingGeneralPool";
import type { StakingPolicy as typeStakingPolicy } from "../../typechain/StakingPolicy";
import type { PositionsManager as typePositionsManager } from "../../typechain/PositionsManager";
import type { PolicyManager as typePolicyManager } from "../../typechain/PolicyManager";
import type { ClaimManager as typeClaimManager } from "../../typechain/ClaimManager";
import type { Arbitrator as typeArbitrator } from "../../typechain/Arbitrator";
import type { ProtocolFactory as typeProtocolFactory } from "../../typechain/ProtocolFactory";
import type { PriceOracleV1 as typePriceOracleV1 } from "../../typechain/PriceOracleV1";

export const contract = {
  USDT: new ethers.Contract(deploymentAddress.USDT, abiUSDT) as typeUSDT,
  ATEN: new ethers.Contract(deploymentAddress.ATEN, abiATEN) as typeATEN,
  ATHENA: new ethers.Contract(
    deploymentAddress.ATHENA,
    abiAthena
  ) as typeAthena,
  TOKEN_VAULT: new ethers.Contract(
    deploymentAddress.TOKEN_VAULT,
    abiTokenVault
  ) as typeTokenVault,
  STAKING_GP: new ethers.Contract(
    deploymentAddress.STAKING_GP,
    abiStakingGeneralPool
  ) as typeStakingGeneralPool,
  STAKING_POLICY: new ethers.Contract(
    deploymentAddress.STAKING_POLICY,
    abiStakingPolicy
  ) as typeStakingPolicy,
  POSITIONS_MANAGER: new ethers.Contract(
    deploymentAddress.POSITIONS_MANAGER,
    abiPositionsManager
  ) as typePositionsManager,
  POLICY_MANAGER: new ethers.Contract(
    deploymentAddress.POLICY_MANAGER,
    abiPolicyManager
  ) as typePolicyManager,
  CLAIM_MANAGER: new ethers.Contract(
    deploymentAddress.CLAIM_MANAGER,
    abiClaimManager
  ) as typeClaimManager,
  ARBITRATOR: new ethers.Contract(
    deploymentAddress.ARBITRATOR,
    abiArbitrator
  ) as typeArbitrator,
  FACTORY_PROTOCOL: new ethers.Contract(
    deploymentAddress.FACTORY_PROTOCOL,
    abiProtocolFactory
  ) as typeProtocolFactory,
  PRICE_ORACLE_V1: new ethers.Contract(
    deploymentAddress.PRICE_ORACLE_V1,
    abiPriceOracleV1
  ) as typePriceOracleV1,
};

export type {
  abiUSDT,
  abiATEN,
  abiAthena,
  abiTokenVault,
  abiStakingGeneralPool,
  abiStakingPolicy,
  abiPositionsManager,
  abiPolicyManager,
  abiClaimManager,
  abiArbitrator,
  abiProtocolFactory,
  abiPriceOracleV1,
  typeUSDT,
  typeATEN,
  typeAthena,
  typeTokenVault,
  typeStakingGeneralPool,
  typeStakingPolicy,
  typePositionsManager,
  typePolicyManager,
  typeClaimManager,
  typeArbitrator,
  typeProtocolFactory,
  typePriceOracleV1,
};
