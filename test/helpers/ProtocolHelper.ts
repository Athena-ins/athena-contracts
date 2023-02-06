import { BigNumberish, BigNumber, ethers } from "ethers";
import { ethers as hre_ethers } from "hardhat";

import HardhatHelper from "./HardhatHelper";
import { contract } from "./TypedContracts";

import { abi as abiProtocolPool } from "../../artifacts/contracts/ProtocolPool.sol/ProtocolPool.json";
import { ProtocolPool as typeProtocolPool } from "../../typechain/ProtocolPool";

async function deployAtenTokenContract(owner: ethers.Signer) {
  contract.ATEN = await (await hre_ethers.getContractFactory("ATEN"))
    .connect(owner)
    .deploy();

  await contract.ATEN.deployed();
}

function getAtenTokenContract() {
  return contract.ATEN;
}

async function deployArbitratorContract(owner: ethers.Signer) {
  contract.ARBITRATOR = await (
    await hre_ethers.getContractFactory("CentralizedArbitrator")
  )
    .connect(owner)
    .deploy(ethers.utils.parseEther("0.01")); // Arbitration fee

  await contract.ARBITRATOR.deployed();
}

function getArbitratorContract() {
  return contract.ARBITRATOR;
}

async function deployAthenaContract(
  owner: ethers.Signer,
  usdt?: string,
  aave_registry?: string
) {
  const useAtenAddress = contract.ATEN?.address || HardhatHelper.ATEN;
  const useUsdtAddress = usdt || HardhatHelper.USDT;
  const useAaveRegistryAddress = aave_registry || HardhatHelper.AAVE_REGISTRY;

  contract.ATHENA = await (await hre_ethers.getContractFactory("Athena"))
    .connect(owner)
    .deploy(useUsdtAddress, useAtenAddress, useAaveRegistryAddress);

  await contract.ATHENA.deployed();
}

function getAthenaContract() {
  return contract.ATHENA;
}

async function deployPositionManagerContract(owner: ethers.Signer) {
  contract.POSITIONS_MANAGER = await (
    await hre_ethers.getContractFactory("PositionsManager")
  )
    .connect(owner)
    .deploy(contract.ATHENA.address);

  await contract.POSITIONS_MANAGER.deployed();
}

function getPositionManagerContract() {
  return contract.POSITIONS_MANAGER;
}

async function deployStakedAtenContract(owner: ethers.Signer) {
  const useAtenAddress = contract.ATEN?.address || HardhatHelper.ATEN;
  contract.STAKING_GP = await (
    await hre_ethers.getContractFactory("StakingGeneralPool")
  )
    .connect(owner)
    .deploy(
      useAtenAddress,
      contract.ATHENA.address,
      contract.POSITIONS_MANAGER.address
    );

  await contract.STAKING_GP.deployed();
}

function getStakedAtenContract() {
  return contract.STAKING_GP;
}

async function deployPolicyManagerContract(owner: ethers.Signer) {
  contract.POLICY_MANAGER = await (
    await hre_ethers.getContractFactory("PolicyManager")
  )
    .connect(owner)
    .deploy(contract.ATHENA.address);

  await contract.POLICY_MANAGER.deployed();
}

function getPolicyManagerContract() {
  return contract.POLICY_MANAGER;
}

async function deployProtocolFactoryContract(owner: ethers.Signer) {
  contract.FACTORY_PROTOCOL = await (
    await hre_ethers.getContractFactory("ProtocolFactory")
  )
    .connect(owner)
    .deploy(
      contract.ATHENA.address,
      contract.POLICY_MANAGER.address,
      14 * 24 * 60 * 60
    );

  await contract.FACTORY_PROTOCOL.deployed();
}

function getProtocolFactoryContract() {
  return contract.FACTORY_PROTOCOL;
}

async function deployClaimManagerContract(
  owner: ethers.Signer,
  arbitrator?: string
) {
  const useArbitratorAddress =
    arbitrator ||
    contract.ARBITRATOR?.address ||
    HardhatHelper.ARBITRATOR_ADDRESS;

  contract.CLAIM_MANAGER = await (
    await hre_ethers.getContractFactory("ClaimManager")
  )
    .connect(owner)
    .deploy(
      contract.ATHENA.address,
      contract.POLICY_MANAGER.address,
      useArbitratorAddress
    );

  await contract.CLAIM_MANAGER.deployed();
}

function getClaimManagerContract() {
  return contract.CLAIM_MANAGER;
}

async function deployPriceOracleV1Contract(
  owner: ethers.Signer,
  initialPrice?: BigNumberish
) {
  // Default price at 25 ATEN = 1 USDT
  const useInitialPrice =
    initialPrice || BigNumber.from(25).mul(BigNumber.from(10).pow(18));

  contract.PRICE_ORACLE_V1 = await (
    await hre_ethers.getContractFactory("PriceOracleV1")
  )
    .connect(owner)
    .deploy(useInitialPrice);

  await contract.PRICE_ORACLE_V1.deployed();
}

function getPriceOracleV1Contract() {
  return contract.PRICE_ORACLE_V1;
}

async function deployStakedAtensPolicyContract(owner: ethers.Signer) {
  const useAtenAddress = contract.ATEN?.address || HardhatHelper.ATEN;
  contract.STAKING_POLICY = await (
    await hre_ethers.getContractFactory("StakingPolicy")
  )
    .connect(owner)
    .deploy(
      contract.ATHENA.address, // address core_
      useAtenAddress, // address atenToken_
      contract.PRICE_ORACLE_V1.address, // address priceOracle_
      contract.TOKEN_VAULT.address, // address atensVault_
      contract.POLICY_MANAGER.address // address coverManager_
    );

  await contract.STAKING_POLICY.deployed();
}

function getStakedAtensPolicyContract() {
  return contract.STAKING_POLICY;
}

async function deployVaultAtenContract(owner: ethers.Signer) {
  const useAtenAddress = contract.ATEN?.address || HardhatHelper.ATEN;
  contract.TOKEN_VAULT = await (
    await hre_ethers.getContractFactory("TokenVault")
  )
    .connect(owner)
    .deploy(useAtenAddress, contract.ATHENA.address);
  await contract.TOKEN_VAULT.deployed();
}

function getVaultAtenContract() {
  return contract.TOKEN_VAULT;
}

async function initializeProtocol(owner: ethers.Signer) {
  return await contract.ATHENA.connect(owner).initialize(
    contract.POSITIONS_MANAGER.address,
    contract.POLICY_MANAGER.address,
    contract.CLAIM_MANAGER.address,
    contract.STAKING_GP.address,
    contract.STAKING_POLICY.address,
    contract.FACTORY_PROTOCOL.address,
    contract.TOKEN_VAULT.address,
    contract.PRICE_ORACLE_V1.address
  );
}

async function setFeeLevelsWithAten(owner: ethers.Signer) {
  return await contract.ATHENA.connect(owner).setFeeLevelsWithAten([
    { atenAmount: 0, feeRate: 250 },
    { atenAmount: 1_000, feeRate: 200 },
    { atenAmount: 100_000, feeRate: 150 },
    { atenAmount: 1_000_000, feeRate: 50 },
  ]);
}

async function setStakingRewardRates(owner: ethers.Signer) {
  return await contract.ATHENA.connect(owner).setStakingRewardRates([
    { amountSupplied: 0, aprStaking: 1_000 },
    { amountSupplied: 10_000, aprStaking: 1_200 },
    { amountSupplied: 100_000, aprStaking: 1_600 },
    { amountSupplied: 1_000_000, aprStaking: 2_000 },
  ]);
}

async function setCoverRefundConfig(
  owner: ethers.Signer,
  options?: {
    shortCoverDuration?: number;
    refundRate?: number;
    basePenaltyRate?: number;
    durationPenaltyRate?: number;
  }
) {
  const config = {
    shortCoverDuration: 180 * 24 * 60 * 60,
    refundRate: 10_000, // 10_000 = 100%
    basePenaltyRate: 1_000, // 10_000 = 100%
    durationPenaltyRate: 3_500, // 10_000 = 100%
    ...options,
  };

  try {
    await (
      await contract.STAKING_POLICY.connect(owner).setShortCoverDuration(
        config.shortCoverDuration
      )
    ).wait();

    await (
      await contract.STAKING_POLICY.connect(owner).setRefundAndPenaltyRate(
        config.refundRate,
        config.basePenaltyRate,
        config.durationPenaltyRate
      )
    ).wait();
  } catch (err: any) {
    throw Error(err);
  }
}

async function depositRewardsToVault(
  owner: ethers.Signer,
  amountToTransfer: BigNumberish
) {
  await contract.ATEN.connect(owner).approve(
    contract.TOKEN_VAULT.address,
    BigNumber.from(amountToTransfer).mul(2)
  );

  await contract.TOKEN_VAULT.connect(owner).depositCoverRefundRewards(
    amountToTransfer
  );

  await contract.TOKEN_VAULT.connect(owner).depositStakingRewards(
    amountToTransfer
  );
}

async function deployAllContractsAndInitializeProtocol(owner: ethers.Signer) {
  await deployAtenTokenContract(owner);
  await deployArbitratorContract(owner);

  await deployAthenaContract(owner);
  await deployPositionManagerContract(owner);
  await deployStakedAtenContract(owner);
  await deployPolicyManagerContract(owner);
  await deployProtocolFactoryContract(owner);
  await deployClaimManagerContract(owner);
  await deployVaultAtenContract(owner);
  await deployPriceOracleV1Contract(owner);
  await deployStakedAtensPolicyContract(owner);

  await initializeProtocol(owner);

  await setFeeLevelsWithAten(owner);
  await setStakingRewardRates(owner);

  const rewardsAmount = ethers.utils.parseEther("20000000"); // 20M ATEN
  await depositRewardsToVault(owner, rewardsAmount);
}

async function addNewProtocolPool(protocolPoolName: string) {
  return await contract.ATHENA.addNewProtocol(
    protocolPoolName,
    30,
    [],
    "bafybeiafebm3zdtzmn5mcquacgd47enhsjnebvegnzfunbbbbbbbbbbbbb"
  );
}

async function getProtocolPoolDataById(protocolPoolId: number) {
  return await contract.ATHENA.protocolsMapping(protocolPoolId);
}

async function getProtocolPoolContract(user: ethers.Signer, poolId: number) {
  const protocol = await contract.ATHENA.connect(user).protocolsMapping(poolId);

  return new ethers.Contract(
    protocol.deployed,
    abiProtocolPool,
    user
  ) as typeProtocolPool;
}

async function deposit(
  user: ethers.Signer,
  USDT_amount: string,
  ATEN_amount: string,
  protocols: number[],
  timeLapse: number
) {
  const userAddress = await user.getAddress();

  await HardhatHelper.USDT_transfer(userAddress, USDT_amount);
  await HardhatHelper.USDT_approve(user, contract.ATHENA.address, USDT_amount);

  if (BigNumber.from(ATEN_amount).gt(0)) {
    await HardhatHelper.ATEN_transfer(userAddress, ATEN_amount);
    await HardhatHelper.ATEN_approve(
      user,
      contract.ATHENA.address,
      ATEN_amount
    );

    await (await contract.ATHENA.connect(user).stakeAtens(ATEN_amount)).wait();
  }

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await contract.ATHENA.connect(user).deposit(USDT_amount, protocols);
}

async function buyPolicy(
  user: ethers.Signer,
  capital: string,
  premium: string,
  atensLocked: string,
  poolId: number,
  timeLapse: number
) {
  const userAddress = await user.getAddress();

  await HardhatHelper.USDT_transfer(userAddress, premium);
  await HardhatHelper.USDT_approve(user, contract.ATHENA.address, premium);

  if (BigNumber.from(atensLocked).gt(0)) {
    await HardhatHelper.ATEN_transfer(userAddress, atensLocked);
    await HardhatHelper.ATEN_approve(
      user,
      contract.ATHENA.address,
      atensLocked
    );
  }

  if (timeLapse) {
    await HardhatHelper.setNextBlockTimestamp(timeLapse);
  }

  return await contract.ATHENA.connect(user).buyPolicies(
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
  const userAddress = await user.getAddress();

  const premiumTotal = premium.reduce(
    (acc, el) => acc.add(BigNumber.from(el)),
    BigNumber.from(0)
  );

  const atensLockedTotal = atensLocked.reduce(
    (acc, el) => acc.add(BigNumber.from(el)),
    BigNumber.from(0)
  );

  await HardhatHelper.USDT_transfer(userAddress, premiumTotal);
  await HardhatHelper.USDT_approve(user, contract.ATHENA.address, premiumTotal);

  if (atensLockedTotal.gt(0)) {
    await HardhatHelper.ATEN_transfer(userAddress, atensLockedTotal);
    await HardhatHelper.ATEN_approve(
      user,
      contract.ATHENA.address,
      atensLockedTotal
    );
  }

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await contract.ATHENA.connect(user).buyPolicies(
    capital,
    premium,
    atensLocked,
    poolId
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
    contract.CLAIM_MANAGER.connect(policyHolder).arbitrationCost(),
    contract.CLAIM_MANAGER.connect(policyHolder).collateralAmount(),
  ]);

  const valueForTx = valueOverride || arbitrationCost.add(collateralAmount);

  // Create the claim
  await contract.CLAIM_MANAGER.connect(policyHolder).initiateClaim(
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
  const claimId = await contract.CLAIM_MANAGER.connect(
    policyHolder
  ).policyIdToLatestClaimId(policyId);

  await HardhatHelper.setNextBlockTimestamp(timeLapse);

  await contract.CLAIM_MANAGER.connect(
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

  const tx = await contract.ATHENA.connect(user).takeInterest(tokenId, poolId);
  const events = (await tx.wait()).events;
  const event = events?.[eventIndex];

  if (!event) throw new Error("Event not found");
  return (await getProtocolPoolContract(user, 0)).interface.decodeEventLog(
    event.topics[0],
    event.data
  );
}

const atenAmountPostHelperTransfer = (amount: BigNumberish) => {
  if (BigNumber.from(amount).eq(0)) return BigNumber.from(0);
  return BigNumber.from(amount)
    .mul(120)
    .mul(99975)
    .div(100 * 100000);
};

const stakingGeneralPoolDeposit = async (
  user: ethers.Signer,
  amount: BigNumberish
) => {
  const userAddress = await user.getAddress();

  await HardhatHelper.ATEN_transfer(userAddress, amount);
  await HardhatHelper.ATEN_approve(user, contract.ATHENA.address, amount);

  await contract.ATHENA.connect(user).stakeAtens(amount);
};

const getExpiredCovers = async (user: ethers.Signer) => {
  const allCovers = await contract.POLICY_MANAGER.connect(
    user
  ).fullCoverDataByAccount(await user.getAddress());

  return allCovers.filter((cover) => !cover.endTimestamp.eq(0));
};

export default {
  atenAmountPostHelperTransfer,
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
  stakingGeneralPoolDeposit,
  deployPriceOracleV1Contract,
  getPriceOracleV1Contract,
  setCoverRefundConfig,
  getExpiredCovers,
};
