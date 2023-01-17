import hre, { ethers as hre_ethers } from "hardhat";
import ProtocolHelper, { CONTRACT } from "../test/helpers/ProtocolHelper";
//
import abiERC20 from "../abis/weth.json";

const { BigNumber } = hre_ethers;

// For Goerli
const ADDRESS = {
  deployer: "0x745A6BE3C44883979FC43e1Df2F7e83eE7b9f73A",
  user_1: "0xB15DdF55984b39005C64Bc2Cdbc1b38A7bD848E9",
  //
  USDT: "0x65E2fe35C30eC218b46266F89847c63c2eDa7Dc7",
  aave_registry: "0x5E52dEc931FFb32f609681B8438A51c675cc232d",
  //
  ATEN: "0x1C53B48fd2F92AD86602Aa8CD08CD3317D2FE737",
  ARBITRATOR: "0x77AB8C2174A770BdbFF9a4eda19C8c4D609A8eA4",
  ATHENA: "0xd840eadf266502f05B4AC3E30dc1ce7bf293EEc2",
  POSITIONS_MANAGER: "0x9C66B49072dC17DCBC3ffb4D37DAC6D6Ab3599B5",
  STAKING_GP: "0x2effe96eBB8EBab29434ffC570a2D8066E2E1A76",
  POLICY_MANAGER: "0x643891502CE10646Cc2f0d39662c0FCF16C17832",
  FACTORY_PROTOCOL: "0x5d2C1c0Bcb821dfF5790c46259058DbBf654678F",
  STAKING_POLICY: "0xc53c128C92A5E99f51BEb0C07896b6c71B6AcCe8",
  TOKEN_VAULT: "0x6e6c10503302F75C8B267886dE2a93d721e627e3",
  CLAIM_MANAGER: "0x32F073C3F5b52c326e6fE930e07D0e3388965924",
};

const amountApprove = BigNumber.from(2).pow(256).sub(1);
const amountTransfers = BigNumber.from(20_000_000).mul(
  BigNumber.from(10).pow(18)
);

async function main() {
  try {
    console.log("== STARTING ==");
    const signers = await hre_ethers.getSigners();
    const deployer = signers[0];
    const user_1 = signers[1];

    ADDRESS.deployer = await deployer.getAddress();
    ADDRESS.user_1 = await user_1.getAddress();

    // =====> deploy ATEN token & deploy arbitrator
    await ProtocolHelper.deployAtenTokenContract(deployer);
    await ProtocolHelper.deployArbitratorContract(deployer);

    const ARBITRATOR_CONTRACT = ProtocolHelper.getArbitratorContract();
    ADDRESS.ARBITRATOR = ARBITRATOR_CONTRACT.address;

    console.log("== OK 1 ==");

    // =====> deploy athena contracts
    await ProtocolHelper.deployAthenaContract(
      deployer,
      ADDRESS.USDT,
      ADDRESS.aave_registry
    );
    await ProtocolHelper.deployPositionManagerContract(deployer);
    await ProtocolHelper.deployStakedAtenContract(deployer);
    await ProtocolHelper.deployPolicyManagerContract(deployer);
    await ProtocolHelper.deployProtocolFactoryContract(deployer);
    await ProtocolHelper.deployStakedAtensPolicyContract(deployer);
    await ProtocolHelper.deployVaultAtenContract(deployer);
    await ProtocolHelper.deployClaimManagerContract(
      deployer,
      ADDRESS.ARBITRATOR
    );

    await ProtocolHelper.initializeProtocol();

    console.log("== OK 2 ==");

    // =====> set fee levels & reward levels
    await ProtocolHelper.setFeeLevelsWithAten(deployer);
    await ProtocolHelper.setStakingRewardRates(deployer);

    // =====> deploy pools
    await ProtocolHelper.addNewProtocolPool("FTX Reserve Insurance");
    await ProtocolHelper.addNewProtocolPool("Dog Theme Coin Rugpull");
    await ProtocolHelper.addNewProtocolPool("AAVE Lending Pool");
    await ProtocolHelper.addNewProtocolPool("Hotdog Swap Liquidity Pool");

    console.log("== OK 3 ==");

    // =====> Make contract interfaces

    const USDT_CONTRACT = new hre_ethers.Contract(ADDRESS.USDT, abiERC20);
    const ATEN_CONTRACT = ProtocolHelper.getAtenTokenContract();
    const ATHENA_CONTRACT = ProtocolHelper.getAthenaContract();
    const VAULT_CONTRACT = ProtocolHelper.getVaultAtenContract();

    ADDRESS.ATHENA = ATHENA_CONTRACT.address;
    ADDRESS.TOKEN_VAULT = VAULT_CONTRACT.address;

    // =====> approve tokens

    await USDT_CONTRACT.connect(deployer).approve(
      ADDRESS.ATHENA,
      amountApprove
    );

    await ATEN_CONTRACT.connect(deployer).transfer(
      ADDRESS.user_1,
      amountTransfers
    );

    console.log("== OK 4 ==");

    // =====> deposit ATEN in rewards vault

    await ProtocolHelper.depositRewardsToVault(deployer, amountTransfers);

    // =====> send ATEN to user

    console.log("====== OK ======");

    console.log(
      "CONTRACT: ",
      Object.entries(CONTRACT).reduce(
        (acc, [key, value]) => ({ ...acc, [key]: value.address }),
        {}
      )
    );
  } catch (err: any) {
    console.log("!!! ERROR !!!");
    console.log(err);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
