import { BigNumber, ethers } from "ethers";
import hre from "hardhat";
import lendingPoolAbi from "../abis/lendingPool.json";
import weth_abi from "../abis/weth.json";

// MAINNET ADDRESSES
export const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283",
  ATEN_OWNER_ADDRESS = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C",
  USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7", //USD
  USDT_AAVE_ATOKEN = "0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811",
  USDT_Wrong = "0xdac17f958d2ee523a2206206994597c13d831ec8", //USD
  WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  AAVE_LENDING_POOL = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9",
  AAVE_REGISTRY = "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5",
  NULL_ADDRESS = "0x" + "0".repeat(40),
  ARBITRATOR_ADDRESS = "0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069";

export const increaseTimeAndMine = async (secondsToIncrease: number) => {
  await hre.ethers.provider.send("evm_increaseTime", [secondsToIncrease]);
  await hre.ethers.provider.send("evm_mine", []);
};

export const getATokenBalance: (
  AAVE_LENDING_POOL: string,
  ATHENA_CONTRACT: ethers.Contract,
  stablecoin: string,
  user: ethers.Signer
) => Promise<BigNumber> = async (
  AAVE_LENDING_POOL,
  ATHENA_CONTRACT,
  stablecoin,
  user
) => {
  const AAVE_LENDING_POOL_CONTRACT = new ethers.Contract(
    AAVE_LENDING_POOL,
    lendingPoolAbi,
    user
  );
  // we fetch lending pool data for USDT to get aToken address
  const data = await AAVE_LENDING_POOL_CONTRACT.getReserveData(stablecoin);
  // and now check our aToken balance in contract
  const aTokenContract = new ethers.Contract(
    data.aTokenAddress,
    weth_abi,
    user
  );
  const bal = await aTokenContract.balanceOf(ATHENA_CONTRACT.address);
  return bal;
};

export const deployAndInitProtocol = async (
  allSigners: ethers.Signer[],
  opts?: {
    ATEN?: string;
    USDT?: string;
    USDT_AAVE_TOKEN?: string;
    AAVE_REGISTRY?: string;
    ARBITRATOR_ADDRESS?: string;
    confirmations?: number;
    commitDelayForWithdraw?: number;
  }
) => {
  const factory = await hre.ethers.getContractFactory("Athena");
  const ATHENA_CONTRACT = await factory
    .connect(allSigners[0])
    .deploy(
      opts?.USDT || USDT,
      opts?.ATEN || ATEN_TOKEN,
      opts?.AAVE_REGISTRY || AAVE_REGISTRY
    );

  // hre.ethers.getContractAt(
  //   "Athena",
  //   "0x1a0636fEa7b40Bae8C93226cE87786CC497460bb",
  //   allSigners[0]
  // );
  await ATHENA_CONTRACT.deployed();

  console.log("Contract ATHENA OK.");

  /** Positions Manager */
  const factoryPos = await hre.ethers.getContractFactory("PositionsManager");
  const POS_CONTRACT = await factoryPos
    .connect(allSigners[0])
    .deploy(ATHENA_CONTRACT.address);
  await POS_CONTRACT.deployed();
  console.log("Deployed PositionsManager");

  const factoryStakedAtens = await hre.ethers.getContractFactory(
    "StakingGeneralPool"
  );
  const STAKED_ATENS_CONTRACT = await factoryStakedAtens
    .connect(allSigners[0])
    .deploy(
      opts?.ATEN || ATEN_TOKEN,
      ATHENA_CONTRACT.address,
      POS_CONTRACT.address
    );
  await STAKED_ATENS_CONTRACT.deployed();
  console.log("Deployed Staked Atens");

  const factoryStakedAtensPolicy = await hre.ethers.getContractFactory(
    "StakingPolicy"
  );
  const STAKED_ATENS_CONTRACT_POLICY = await factoryStakedAtensPolicy
    .connect(allSigners[0])
    .deploy(opts?.ATEN || ATEN_TOKEN, ATHENA_CONTRACT.address);
  await STAKED_ATENS_CONTRACT_POLICY.deployed();
  console.log("Deployed Staked Atens Policy");

  /** Policy Manager */
  const factoryPolicy = await hre.ethers.getContractFactory("PolicyManager");
  const POLICY_CONTRACT = await factoryPolicy
    .connect(allSigners[0])
    .deploy(ATHENA_CONTRACT.address);
  await POLICY_CONTRACT.deployed();
  console.log("Deployed Policy Manager");

  const factoryProtocol = await hre.ethers.getContractFactory(
    "ProtocolFactory"
  );
  const FACTORY_PROTOCOL_CONTRACT = await factoryProtocol
    .connect(allSigners[0])
    .deploy(
      ATHENA_CONTRACT.address,
      POLICY_CONTRACT.address,
      opts?.commitDelayForWithdraw || 14 * 24 * 60 * 60
    );
  await FACTORY_PROTOCOL_CONTRACT.deployed();
  console.log("Deployed Factory Protocol");

  const vaultFactory = await hre.ethers.getContractFactory("TokenVault");
  const VAULT_ATENS_CONTRACT = await vaultFactory
    .connect(allSigners[0])
    .deploy(opts?.ATEN || ATEN_TOKEN, ATHENA_CONTRACT.address);
  await VAULT_ATENS_CONTRACT.deployed();
  console.log("Deployed Vault Atens");

  /**
   * Initialize protocol with required values
   */
  const init = await ATHENA_CONTRACT.initialize(
    POS_CONTRACT.address, // _positionsAddress
    STAKED_ATENS_CONTRACT.address, // _stakedAtensGP
    STAKED_ATENS_CONTRACT_POLICY.address, // _stakedAtensPo
    VAULT_ATENS_CONTRACT.address, // _atensVault
    POLICY_CONTRACT.address, // _policyManagerAddress
    // opts?.USDT_AAVE_TOKEN || USDT_AAVE_ATOKEN,
    FACTORY_PROTOCOL_CONTRACT.address, // _protocolFactory
    opts?.ARBITRATOR_ADDRESS || ARBITRATOR_ADDRESS // _claimManager
  );
  await init.wait(opts?.confirmations);
  return [
    ATHENA_CONTRACT,
    POS_CONTRACT,
    STAKED_ATENS_CONTRACT,
    STAKED_ATENS_CONTRACT_POLICY,
    VAULT_ATENS_CONTRACT,
    POLICY_CONTRACT,
    FACTORY_PROTOCOL_CONTRACT,
  ];
};
