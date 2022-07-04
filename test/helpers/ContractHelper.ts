import { ethers } from "ethers";
import hre, { ethers as hre_ethers } from "hardhat";
import protocolPoolAbi from "../../artifacts/contracts/ProtocolPool.sol/ProtocolPool.json";

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const AAVE_REGISTRY = "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5";
const USDT_AAVE_ATOKEN = "0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811";
const ARBITRATOR_ADDRESS = "0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069";
const NULL_ADDRESS = "0x" + "0".repeat(40);

let ATHENA_CONTRACT: ethers.Contract;
let POSITIONS_MANAGER_CONTRACT: ethers.Contract;
let STAKED_ATENS_CONTRACT: ethers.Contract;
let FACTORY_PROTOCOL_CONTRACT: ethers.Contract;
let POLICY_MANAGER_CONTRACT: ethers.Contract;

async function deployAthenaContract(owner: ethers.Signer) {
  ATHENA_CONTRACT = await (await hre_ethers.getContractFactory("Athena"))
    .connect(owner)
    .deploy(USDT, ATEN_TOKEN, AAVE_REGISTRY);

  await ATHENA_CONTRACT.deployed();
  return ATHENA_CONTRACT;
}

function getAthenaContract() {
  return ATHENA_CONTRACT;
}

async function deployPositionManagerContract(owner: ethers.Signer) {
  POSITIONS_MANAGER_CONTRACT = await (
    await hre_ethers.getContractFactory("PositionsManager")
  )
    .connect(owner)
    .deploy(ATHENA_CONTRACT.address);

  await POSITIONS_MANAGER_CONTRACT.deployed();
  return POSITIONS_MANAGER_CONTRACT;
}

async function deployStakedAtenContract(owner: ethers.Signer) {
  STAKED_ATENS_CONTRACT = await (
    await hre_ethers.getContractFactory("StakedAten")
  )
    .connect(owner)
    .deploy(ATEN_TOKEN, ATHENA_CONTRACT.address);

  await STAKED_ATENS_CONTRACT.deployed();
  return STAKED_ATENS_CONTRACT;
}

async function deployProtocolFactoryContract(owner: ethers.Signer) {
  FACTORY_PROTOCOL_CONTRACT = await (
    await hre_ethers.getContractFactory("ProtocolFactory")
  )
    .connect(owner)
    .deploy(ATHENA_CONTRACT.address);

  await FACTORY_PROTOCOL_CONTRACT.deployed();
  return FACTORY_PROTOCOL_CONTRACT;
}

async function deployPolicyManagerContract(owner: ethers.Signer) {
  POLICY_MANAGER_CONTRACT = await (
    await hre_ethers.getContractFactory("PolicyManager")
  )
    .connect(owner)
    .deploy(ATHENA_CONTRACT.address);

  await POLICY_MANAGER_CONTRACT.deployed();
  return POLICY_MANAGER_CONTRACT;
}

async function initializeProtocol() {
  return await ATHENA_CONTRACT.initialize(
    POSITIONS_MANAGER_CONTRACT.address,
    STAKED_ATENS_CONTRACT.address,
    POLICY_MANAGER_CONTRACT.address,
    USDT_AAVE_ATOKEN,
    FACTORY_PROTOCOL_CONTRACT.address,
    ARBITRATOR_ADDRESS,
    NULL_ADDRESS
  );
}

async function deployAllContractsAndInitializeProtocol(owner: ethers.Signer) {
  await deployAthenaContract(owner);
  await deployPositionManagerContract(owner);
  await deployStakedAtenContract(owner);
  await deployProtocolFactoryContract(owner);
  await deployPolicyManagerContract(owner);
  await initializeProtocol();
}

async function addNewProtocolPool(protocolPoolName: string) {
  return await ATHENA_CONTRACT.addNewProtocol(
    protocolPoolName,
    0,
    30,
    WETH,
    []
  );
}

async function getProtocolPoolById(protocolPoolId: number) {
  return await ATHENA_CONTRACT.protocolsMapping(protocolPoolId);
}

async function getProtocolPoolContract(
  user: ethers.Signer,
  protocolId: number
) {
  const protocol = await ATHENA_CONTRACT.connect(user).protocolsMapping(
    protocolId
  );

  return new ethers.Contract(protocol.deployed, protocolPoolAbi.abi, user);
}

export default {
  deployAthenaContract,
  getAthenaContract,
  deployPositionManagerContract,
  deployStakedAtenContract,
  deployProtocolFactoryContract,
  deployPolicyManagerContract,
  initializeProtocol,
  deployAllContractsAndInitializeProtocol,
  addNewProtocolPool,
  getProtocolPoolById,
  getProtocolPoolContract,
};
