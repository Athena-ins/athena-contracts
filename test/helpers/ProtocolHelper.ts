import { ethers } from "ethers";
import { ethers as hre_ethers } from "hardhat";
import HardhatHelper from "./HardhatHelper";
import protocolPoolAbi from "../../artifacts/contracts/ProtocolPool.sol/ProtocolPool.json";

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
    .deploy(HardhatHelper.USDT, HardhatHelper.ATEN, AAVE_REGISTRY);

  await ATHENA_CONTRACT.deployed();
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
}

function getPositionManagerContract() {
  return POSITIONS_MANAGER_CONTRACT;
}

async function deployStakedAtenContract(owner: ethers.Signer) {
  STAKED_ATENS_CONTRACT = await (
    await hre_ethers.getContractFactory("StakedAten")
  )
    .connect(owner)
    .deploy(HardhatHelper.ATEN, ATHENA_CONTRACT.address);

  await STAKED_ATENS_CONTRACT.deployed();
}

function getStakedAtenContract() {
  return STAKED_ATENS_CONTRACT;
}

async function deployProtocolFactoryContract(owner: ethers.Signer) {
  FACTORY_PROTOCOL_CONTRACT = await (
    await hre_ethers.getContractFactory("ProtocolFactory")
  )
    .connect(owner)
    .deploy(ATHENA_CONTRACT.address);

  await FACTORY_PROTOCOL_CONTRACT.deployed();
}

function getProtocolFactoryContract() {
  return FACTORY_PROTOCOL_CONTRACT;
}

async function deployPolicyManagerContract(owner: ethers.Signer) {
  POLICY_MANAGER_CONTRACT = await (
    await hre_ethers.getContractFactory("PolicyManager")
  )
    .connect(owner)
    .deploy(ATHENA_CONTRACT.address);

  await POLICY_MANAGER_CONTRACT.deployed();
}

function getPolicyManagerContract() {
  return POLICY_MANAGER_CONTRACT;
}

async function initializeProtocol() {
  return await ATHENA_CONTRACT.initialize(
    POSITIONS_MANAGER_CONTRACT.address,
    STAKED_ATENS_CONTRACT.address,
    NULL_ADDRESS,
    NULL_ADDRESS,
    POLICY_MANAGER_CONTRACT.address,
    USDT_AAVE_ATOKEN,
    FACTORY_PROTOCOL_CONTRACT.address,
    ARBITRATOR_ADDRESS,
    NULL_ADDRESS
  );
}

async function setDiscountWithAten(owner: ethers.Signer) {
  return await ATHENA_CONTRACT.connect(owner).setDiscountWithAten([
    [1000, 200],
    [100000, 150],
    [1000000, 50],
  ]);
}

async function setStakeRewards(owner: ethers.Signer) {
  return await STAKED_ATENS_CONTRACT.connect(owner).setStakeRewards([
    ["1", "1000"],
    ["10000", "1200"],
    ["100000", "1600"],
    ["1000000", "2000"],
  ]);
}

async function deployAllContractsAndInitializeProtocol(owner: ethers.Signer) {
  await deployAthenaContract(owner);
  await deployPositionManagerContract(owner);
  await deployStakedAtenContract(owner);
  await deployProtocolFactoryContract(owner);
  await deployPolicyManagerContract(owner);
  await initializeProtocol();
  await setDiscountWithAten(owner);
  await setStakeRewards(owner);
}

async function addNewProtocolPool(protocolPoolName: string) {
  return await ATHENA_CONTRACT.addNewProtocol(
    protocolPoolName,
    0,
    30,
    HardhatHelper.WETH,
    []
  );
}

async function getProtocolPoolDataById(protocolPoolId: number) {
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

async function deposit(
  user: ethers.Signer,
  USDT_amount: string,
  ATEN_amount: string,
  protocols: number[]
) {
  await HardhatHelper.USDT_transfer(
    await user.getAddress(),
    hre_ethers.utils.parseUnits(USDT_amount, 6)
  );

  await HardhatHelper.USDT_approve(
    user,
    ATHENA_CONTRACT.address,
    hre_ethers.utils.parseUnits(USDT_amount, 6)
  );

  await HardhatHelper.ATEN_transfer(
    await user.getAddress(),
    hre_ethers.utils.parseEther(ATEN_amount)
  );

  await HardhatHelper.ATEN_approve(
    user,
    STAKED_ATENS_CONTRACT.address,
    hre_ethers.utils.parseUnits(ATEN_amount, 18)
  );

  //Thao@TODO: timelapse here ?
  await ATHENA_CONTRACT.connect(user).deposit(
    USDT_amount,
    ATEN_amount,
    protocols
  );
}

async function buyPolicy(
  user: ethers.Signer,
  capital: string,
  premium: string,
  atensLocked: string,
  protocolId: number,
  timeLapse: number
) {
  await HardhatHelper.USDT_transfer(
    await user.getAddress(),
    hre_ethers.utils.parseUnits(premium, 6)
  );

  await HardhatHelper.USDT_approve(
    user,
    ATHENA_CONTRACT.address,
    hre_ethers.utils.parseUnits(premium, 6)
  );

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await ATHENA_CONTRACT.connect(user).buyPolicy(
    capital,
    premium,
    atensLocked,
    protocolId
  );
}

export default {
  deployAthenaContract,
  getAthenaContract,
  deployPositionManagerContract,
  getPositionManagerContract,
  deployStakedAtenContract,
  getStakedAtenContract,
  deployProtocolFactoryContract,
  getProtocolFactoryContract,
  deployPolicyManagerContract,
  getPolicyManagerContract,
  initializeProtocol,
  setDiscountWithAten,
  setStakeRewards,
  deployAllContractsAndInitializeProtocol,
  addNewProtocolPool,
  getProtocolPoolDataById,
  getProtocolPoolContract,
  deposit,
  buyPolicy,
};
