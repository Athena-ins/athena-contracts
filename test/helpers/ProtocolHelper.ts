import { ethers } from "ethers";
import { ethers as hre_ethers } from "hardhat";
import HardhatHelper from "./HardhatHelper";
import protocolPoolAbi from "../../artifacts/contracts/ProtocolPool.sol/ProtocolPool.json";

let ATHENA_CONTRACT: ethers.Contract;
let POSITIONS_MANAGER_CONTRACT: ethers.Contract;
let STAKED_ATENS_CONTRACT: ethers.Contract;
let FACTORY_PROTOCOL_CONTRACT: ethers.Contract;
let POLICY_MANAGER_CONTRACT: ethers.Contract;
let CLAIM_MANAGER_CONTRACT: ethers.Contract;
let STAKED_ATENS_POLICY_CONTRACT: ethers.Contract;
let VAULT_ATENS_CONTRACT: ethers.Contract;

async function deployAthenaContract(owner: ethers.Signer) {
  ATHENA_CONTRACT = await (await hre_ethers.getContractFactory("Athena"))
    .connect(owner)
    .deploy(
      HardhatHelper.USDT,
      HardhatHelper.ATEN,
      HardhatHelper.AAVE_REGISTRY
    );

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
    await hre_ethers.getContractFactory("StakingGeneralPool")
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
    .deploy(ATHENA_CONTRACT.address, 14 * 24 * 60 * 60);

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

async function deployClaimManagerContract(owner: ethers.Signer) {
  CLAIM_MANAGER_CONTRACT = await (
    await hre_ethers.getContractFactory("ClaimManager")
  )
    .connect(owner)
    .deploy(
      ATHENA_CONTRACT.address,
      POLICY_MANAGER_CONTRACT.address,
      HardhatHelper.ARBITRATOR_ADDRESS
    );

  await CLAIM_MANAGER_CONTRACT.deployed();
}

function getClaimManagerContract() {
  return CLAIM_MANAGER_CONTRACT;
}

async function deployStakedAtensPolicyContract(owner: ethers.Signer) {
  STAKED_ATENS_POLICY_CONTRACT = await (
    await hre_ethers.getContractFactory("StakingPolicy")
  )
    .connect(owner)
    .deploy(HardhatHelper.ATEN, ATHENA_CONTRACT.address);

  await STAKED_ATENS_POLICY_CONTRACT.deployed();
}

function getStakedAtensPolicyContract() {
  return STAKED_ATENS_POLICY_CONTRACT;
}

async function deployVaultAtenContract(owner: ethers.Signer) {
  VAULT_ATENS_CONTRACT = await (
    await hre_ethers.getContractFactory("TokenVault")
  )
    .connect(owner)
    .deploy(HardhatHelper.ATEN, ATHENA_CONTRACT.address);
  await VAULT_ATENS_CONTRACT.deployed();
}

function getVaultAtenContract() {
  return VAULT_ATENS_CONTRACT;
}

async function initializeProtocol() {
  return await ATHENA_CONTRACT.initialize(
    POSITIONS_MANAGER_CONTRACT.address,
    STAKED_ATENS_CONTRACT.address,
    STAKED_ATENS_POLICY_CONTRACT.address,
    VAULT_ATENS_CONTRACT.address,
    POLICY_MANAGER_CONTRACT.address,
    FACTORY_PROTOCOL_CONTRACT.address,
    CLAIM_MANAGER_CONTRACT.address
  );
}

async function setFeeLevelsWithAten(owner: ethers.Signer) {
  return await ATHENA_CONTRACT.connect(owner).setFeeLevelsWithAten([
    [0, 250],
    [1_000, 200],
    [100_000, 150],
    [1_000_000, 50],
  ]);
}

async function setStakingRewardRates(owner: ethers.Signer) {
  return await ATHENA_CONTRACT.connect(owner).setStakingRewardRates([
    [0, 1_000],
    [10_000, 1_200],
    [100_000, 1_600],
    [1_000_000, 2_000],
  ]);
}

async function deployAllContractsAndInitializeProtocol(owner: ethers.Signer) {
  await deployAthenaContract(owner);
  await deployPositionManagerContract(owner);
  await deployStakedAtenContract(owner);
  await deployProtocolFactoryContract(owner);
  await deployPolicyManagerContract(owner);
  await deployClaimManagerContract(owner);
  await deployStakedAtensPolicyContract(owner);
  await deployVaultAtenContract(owner);
  await initializeProtocol();
  await setFeeLevelsWithAten(owner);
  await setStakingRewardRates(owner);
}

async function addNewProtocolPool(protocolPoolName: string) {
  return await ATHENA_CONTRACT.addNewProtocol(
    protocolPoolName,
    0,
    30,
    HardhatHelper.WETH,
    [],
    "bafybeiafebm3zdtzmn5mcquacgd47enhsjnebvegnzfunbbbbbbbbbbbbb"
  );
}

async function getProtocolPoolDataById(protocolPoolId: number) {
  return await ATHENA_CONTRACT.protocolsMapping(protocolPoolId);
}

async function getProtocolPoolContract(user: ethers.Signer, poolId: number) {
  const protocol = await ATHENA_CONTRACT.connect(user).protocolsMapping(poolId);

  return new ethers.Contract(protocol.deployed, protocolPoolAbi.abi, user);
}

async function deposit(
  user: ethers.Signer,
  USDT_amount: string,
  ATEN_amount: string,
  protocols: number[],
  timeLapse: number
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

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await (await ATHENA_CONTRACT.connect(user).stakeAtens(ATEN_amount)).wait();

  await ATHENA_CONTRACT.connect(user).deposit(USDT_amount, protocols);
}

async function buyPolicy(
  user: ethers.Signer,
  capital: string,
  premium: string,
  atensLocked: string,
  poolId: number,
  timeLapse: number
) {
  await HardhatHelper.USDT_transfer(
    await user.getAddress(),
    hre_ethers.utils.parseUnits(premium, 6)
  );

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await ATHENA_CONTRACT.connect(user).buyPolicies(
    [capital],
    [premium],
    [atensLocked],
    [poolId]
  );
}

async function createClaim(
  policyHolder: ethers.Signer,
  policyId: number,
  amountClaimed: string | number,
  valueOverride?: ethers.BigNumberish
) {
  // Get the cost of arbitration + challenge collateral
  const [arbitrationCost, collateralAmount] = await Promise.all([
    CLAIM_MANAGER_CONTRACT.connect(policyHolder).arbitrationCost(),
    CLAIM_MANAGER_CONTRACT.connect(policyHolder).collateralAmount(),
  ]);

  const valueForTx = valueOverride || arbitrationCost.add(collateralAmount);

  // Create the claim
  await CLAIM_MANAGER_CONTRACT.connect(policyHolder).inititateClaim(
    policyId,
    amountClaimed,
    "bafybeiafebm3zdtzmn5mcquacgd47enhsjnebvegnzfunaaaaaaaaaaaaa",
    { value: valueForTx }
  );
}

async function resolveClaimWithoutDispute(
  policyHolder: ethers.Signer,
  policyId: number,
  timeLapse: number
) {
  const claimId = await CLAIM_MANAGER_CONTRACT.connect(
    policyHolder
  ).policyIdToLatestClaimId(policyId);

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await CLAIM_MANAGER_CONTRACT.connect(
    policyHolder
  ).withdrawCompensationWithoutDispute(claimId);
}

async function takeInterest(
  user: ethers.Signer,
  tokenId: ethers.BigNumberish,
  poolId: number,
  timeLapse: number,
  eventIndex: number = 0
) {
  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  const tx = await ATHENA_CONTRACT.connect(user).takeInterest(tokenId, poolId);
  const events = (await tx.wait()).events;
  const event = events[eventIndex];

  return (await getProtocolPoolContract(user, 0)).interface.decodeEventLog(
    event.topics[0],
    event.data
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
  deployStakedAtensPolicyContract,
  getStakedAtensPolicyContract,
  deployVaultAtenContract,
  getVaultAtenContract,
  deployClaimManagerContract,
  getClaimManagerContract,
  initializeProtocol,
  setFeeLevelsWithAten,
  setStakingRewardRates,
  deployAllContractsAndInitializeProtocol,
  addNewProtocolPool,
  getProtocolPoolDataById,
  getProtocolPoolContract,
  deposit,
  buyPolicy,
  createClaim,
  resolveClaimWithoutDispute,
  takeInterest,
};
