import { ethers } from "ethers";
import { ethers as hre_ethers } from "hardhat";
import HardhatHelper from "./HardhatHelper";
import protocolPoolAbi from "../../artifacts/contracts/ProtocolPool.sol/ProtocolPool.json";

export const CONTRACT: { [key: string]: ethers.Contract } = {};

async function deployAtenTokenContract(owner: ethers.Signer) {
  CONTRACT.ATEN = await (await hre_ethers.getContractFactory("ATEN"))
    .connect(owner)
    .deploy();

  await CONTRACT.ATEN.deployed();
}

function getAtenTokenContract() {
  return CONTRACT.ATEN;
}

async function deployArbitratorContract(owner: ethers.Signer) {
  CONTRACT.ARBITRATOR = await (
    await hre_ethers.getContractFactory("CentralizedArbitrator")
  )
    .connect(owner)
    .deploy(ethers.utils.parseEther("0.01")); // Arbitration fee

  await CONTRACT.ARBITRATOR.deployed();
}

function getArbitratorContract() {
  return CONTRACT.ARBITRATOR;
}

async function deployAthenaContract(
  owner: ethers.Signer,
  usdt?: string,
  aave_registry?: string
) {
  const useAtenAddress = CONTRACT.ATEN?.address || HardhatHelper.ATEN;
  const useUsdtAddress = usdt || HardhatHelper.USDT;
  const useAaveRegistryAddress = aave_registry || HardhatHelper.AAVE_REGISTRY;

  CONTRACT.ATHENA = await (await hre_ethers.getContractFactory("Athena"))
    .connect(owner)
    .deploy(useUsdtAddress, useAtenAddress, useAaveRegistryAddress);

  await CONTRACT.ATHENA.deployed();
}

function getAthenaContract() {
  return CONTRACT.ATHENA;
}

async function deployPositionManagerContract(owner: ethers.Signer) {
  CONTRACT.POSITIONS_MANAGER = await (
    await hre_ethers.getContractFactory("PositionsManager")
  )
    .connect(owner)
    .deploy(CONTRACT.ATHENA.address);

  await CONTRACT.POSITIONS_MANAGER.deployed();
}

function getPositionManagerContract() {
  return CONTRACT.POSITIONS_MANAGER;
}

async function deployStakedAtenContract(owner: ethers.Signer) {
  const useAtenAddress = CONTRACT.ATEN?.address || HardhatHelper.ATEN;
  CONTRACT.STAKING_GP = await (
    await hre_ethers.getContractFactory("StakingGeneralPool")
  )
    .connect(owner)
    .deploy(
      useAtenAddress,
      CONTRACT.ATHENA.address,
      CONTRACT.POSITIONS_MANAGER.address
    );

  await CONTRACT.STAKING_GP.deployed();
}

function getStakedAtenContract() {
  return CONTRACT.STAKING_GP;
}

async function deployPolicyManagerContract(owner: ethers.Signer) {
  CONTRACT.POLICY_MANAGER = await (
    await hre_ethers.getContractFactory("PolicyManager")
  )
    .connect(owner)
    .deploy(CONTRACT.ATHENA.address);

  await CONTRACT.POLICY_MANAGER.deployed();
}

function getPolicyManagerContract() {
  return CONTRACT.POLICY_MANAGER;
}

async function deployProtocolFactoryContract(owner: ethers.Signer) {
  CONTRACT.FACTORY_PROTOCOL = await (
    await hre_ethers.getContractFactory("ProtocolFactory")
  )
    .connect(owner)
    .deploy(
      CONTRACT.ATHENA.address,
      CONTRACT.POLICY_MANAGER.address,
      14 * 24 * 60 * 60
    );

  await CONTRACT.FACTORY_PROTOCOL.deployed();
}

function getProtocolFactoryContract() {
  return CONTRACT.FACTORY_PROTOCOL;
}

async function deployClaimManagerContract(
  owner: ethers.Signer,
  arbitrator?: string
) {
  const useArbitratorAddress = arbitrator || HardhatHelper.ARBITRATOR_ADDRESS;
  CONTRACT.CLAIM_MANAGER = await (
    await hre_ethers.getContractFactory("ClaimManager")
  )
    .connect(owner)
    .deploy(
      CONTRACT.ATHENA.address,
      CONTRACT.POLICY_MANAGER.address,
      useArbitratorAddress
    );

  await CONTRACT.CLAIM_MANAGER.deployed();
}

function getClaimManagerContract() {
  return CONTRACT.CLAIM_MANAGER;
}

async function deployStakedAtensPolicyContract(owner: ethers.Signer) {
  const useAtenAddress = CONTRACT.ATEN?.address || HardhatHelper.ATEN;
  CONTRACT.STAKING_POLICY = await (
    await hre_ethers.getContractFactory("StakingPolicy")
  )
    .connect(owner)
    .deploy(useAtenAddress, CONTRACT.ATHENA.address);

  await CONTRACT.STAKING_POLICY.deployed();
}

function getStakedAtensPolicyContract() {
  return CONTRACT.STAKING_POLICY;
}

async function deployVaultAtenContract(owner: ethers.Signer) {
  const useAtenAddress = CONTRACT.ATEN?.address || HardhatHelper.ATEN;
  CONTRACT.TOKEN_VAULT = await (
    await hre_ethers.getContractFactory("TokenVault")
  )
    .connect(owner)
    .deploy(useAtenAddress, CONTRACT.ATHENA.address);
  await CONTRACT.TOKEN_VAULT.deployed();
}

function getVaultAtenContract() {
  return CONTRACT.TOKEN_VAULT;
}

async function initializeProtocol() {
  return await CONTRACT.ATHENA.initialize(
    CONTRACT.POSITIONS_MANAGER.address,
    CONTRACT.POLICY_MANAGER.address,
    CONTRACT.CLAIM_MANAGER.address,
    CONTRACT.STAKING_GP.address,
    CONTRACT.STAKING_POLICY.address,
    CONTRACT.FACTORY_PROTOCOL.address,
    CONTRACT.TOKEN_VAULT.address
  );
}

async function setFeeLevelsWithAten(owner: ethers.Signer) {
  return await CONTRACT.ATHENA.connect(owner).setFeeLevelsWithAten([
    [0, 250],
    [1_000, 200],
    [100_000, 150],
    [1_000_000, 50],
  ]);
}

async function setStakingRewardRates(owner: ethers.Signer) {
  return await CONTRACT.ATHENA.connect(owner).setStakingRewardRates([
    [0, 1_000],
    [10_000, 1_200],
    [100_000, 1_600],
    [1_000_000, 2_000],
  ]);
}

async function depositRewardsToVault(
  owner: ethers.Signer,
  amountToTransfer: BigNumberish
) {
  await CONTRACT.ATEN.connect(owner).approve(
    CONTRACT.ATHENA.address,
    amountToTransfer
  );

  await CONTRACT.ATHENA.connect(owner).depositRewardForPolicyStaking(
    amountToTransfer
  );

  await CONTRACT.ATEN.connect(owner).transfer(
    CONTRACT.TOKEN_VAULT.address,
    amountToTransfer
  );
}

async function deployAllContractsAndInitializeProtocol(owner: ethers.Signer) {
  await deployAthenaContract(owner);
  await deployPositionManagerContract(owner);
  await deployStakedAtenContract(owner);
  await deployPolicyManagerContract(owner);
  await deployProtocolFactoryContract(owner);
  await deployClaimManagerContract(owner);
  await deployStakedAtensPolicyContract(owner);
  await deployVaultAtenContract(owner);
  await initializeProtocol();
  await setFeeLevelsWithAten(owner);
  await setStakingRewardRates(owner);
}

async function addNewProtocolPool(protocolPoolName: string) {
  return await CONTRACT.ATHENA.addNewProtocol(
    protocolPoolName,
    30,
    [],
    "bafybeiafebm3zdtzmn5mcquacgd47enhsjnebvegnzfunbbbbbbbbbbbbb"
  );
}

async function getProtocolPoolDataById(protocolPoolId: number) {
  return await CONTRACT.ATHENA.protocolsMapping(protocolPoolId);
}

async function getProtocolPoolContract(user: ethers.Signer, poolId: number) {
  const protocol = await CONTRACT.ATHENA.connect(user).protocolsMapping(poolId);

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
    CONTRACT.ATHENA.address,
    hre_ethers.utils.parseUnits(USDT_amount, 6)
  );

  await HardhatHelper.ATEN_transfer(
    await user.getAddress(),
    hre_ethers.utils.parseEther(ATEN_amount)
  );

  await HardhatHelper.ATEN_approve(
    user,
    CONTRACT.ATHENA.address,
    hre_ethers.utils.parseUnits(ATEN_amount, 18)
  );

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await (await CONTRACT.ATHENA.connect(user).stakeAtens(ATEN_amount)).wait();

  await CONTRACT.ATHENA.connect(user).deposit(USDT_amount, protocols);
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

  await CONTRACT.ATHENA.connect(user).buyPolicies(
    [capital],
    [premium],
    [atensLocked],
    [poolId]
  );
}

async function buyPolicies(
  user: ethers.Signer,
  capital: string[],
  premium: string[],
  atensLocked: string[],
  poolId: number[],
  timeLapse: number
) {
  const premiumTotal = premium
    .map((el) => parseFloat(el))
    .reduce((acc, el) => acc + el, 0)
    .toString();

  await HardhatHelper.USDT_transfer(
    await user.getAddress(),
    hre_ethers.utils.parseUnits(premiumTotal, 6)
  );

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await CONTRACT.ATHENA.connect(user).buyPolicies(
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
    CONTRACT.CLAIM_MANAGER.connect(policyHolder).arbitrationCost(),
    CONTRACT.CLAIM_MANAGER.connect(policyHolder).collateralAmount(),
  ]);

  const valueForTx = valueOverride || arbitrationCost.add(collateralAmount);

  // Create the claim
  await CONTRACT.CLAIM_MANAGER.connect(policyHolder).inititateClaim(
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
  const claimId = await CONTRACT.CLAIM_MANAGER.connect(
    policyHolder
  ).policyIdToLatestClaimId(policyId);

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await CONTRACT.CLAIM_MANAGER.connect(
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

  const tx = await CONTRACT.ATHENA.connect(user).takeInterest(tokenId, poolId);
  const events = (await tx.wait()).events;
  const event = events[eventIndex];

  return (await getProtocolPoolContract(user, 0)).interface.decodeEventLog(
    event.topics[0],
    event.data
  );
}

export default {
  deployAtenTokenContract,
  getAtenTokenContract,
  deployArbitratorContract,
  getArbitratorContract,
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
  buyPolicies,
  createClaim,
  resolveClaimWithoutDispute,
  depositRewardsToVault,
  takeInterest,
};
