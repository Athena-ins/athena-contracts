import { ethers as hre_ethers } from "hardhat";
import ProtocolHelper from "../test/helpers/ProtocolHelper";
//
import abiERC20 from "../abis/weth.json";

const { BigNumber } = hre_ethers;

// For Goerli
const ADDRESS = {
  deployer: "0x745A6BE3C44883979FC43e1Df2F7e83eE7b9f73A",
  user_1: "0xB15DdF55984b39005C64Bc2Cdbc1b38A7bD848E9",
  //
  usdt_aave: "0x65E2fe35C30eC218b46266F89847c63c2eDa7Dc7",
  aave_registry: "0x5E52dEc931FFb32f609681B8438A51c675cc232d",
  //
  aten: "0xc5f57304d4f59e680AaE013e83d4fBd48dE35A8C",
  arbitrator: "0x05B7D4b7Dc8aE618d83D3f7BF49eb9a716a86bd2",
  athena: "0xA9826c750d531eE1274B783258f9781459e36Af4",
  position_manager: "0x4af126738240ebc01dc571e6a8af2c265abb2617",
  staking_gp: "0x0f5d6f41548584b95c5f26887982b206c02d3f28",
  policy_manager: "0xc89254dcf3b532ede6a7d2af0a9d674a33a3c20d",
  protocol_factory: "0xe9c38ede505d553707b6127ff09d41274277c028",
  staking_policy: "0xf4ac4e74b436ca576df1eac5151e98c2ce26646e",
  vault: "0x10c931f84a74bc01b9e57c02a74633530fe8944f",
  claim_manager: "0xe8cfd5f190987b73499aca2e0bf1ba8ba88df1cf",
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
    ADDRESS.arbitrator = ARBITRATOR_CONTRACT.address;

    // =====> deploy athena contracts
    await ProtocolHelper.deployAthenaContract(
      deployer,
      ADDRESS.usdt_aave,
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
      ADDRESS.arbitrator
    );

    await ProtocolHelper.initializeProtocol();

    // =====> set fee levels & reward levels
    await ProtocolHelper.setFeeLevelsWithAten(deployer);
    await ProtocolHelper.setStakingRewardRates(deployer);

    // =====> deploy pools
    await ProtocolHelper.addNewProtocolPool("FTX Reserve Insurance");
    await ProtocolHelper.addNewProtocolPool("Dog Theme Coin Rugpull");
    await ProtocolHelper.addNewProtocolPool("AAVE Lending Pool");
    await ProtocolHelper.addNewProtocolPool("Hotdog Swap Liquidity Pool");

    // =====> Make contract interfaces

    const USDT_CONTRACT = new hre_ethers.Contract(ADDRESS.usdt_aave, abiERC20);
    const ATEN_CONTRACT = ProtocolHelper.getAtenTokenContract();
    const ATHENA_CONTRACT = ProtocolHelper.getAthenaContract();
    const VAULT_CONTRACT = ProtocolHelper.getVaultAtenContract();

    ADDRESS.athena = ATHENA_CONTRACT.address;
    ADDRESS.vault = VAULT_CONTRACT.address;

    // =====> approve tokens

    await USDT_CONTRACT.connect(deployer).approve(
      ADDRESS.athena,
      amountApprove
    );
    await ATEN_CONTRACT.connect(deployer).approve(
      ADDRESS.athena,
      amountApprove
    );
    await ATEN_CONTRACT.connect(deployer).approve(ADDRESS.vault, amountApprove);

    // =====> deposit ATEN in rewards vault & send ATEN to user

    await ATHENA_CONTRACT.connect(deployer).depositRewardForPolicyStaking(
      amountTransfers
    );

    await ATEN_CONTRACT.connect(deployer).transfer(
      ADDRESS.vault,
      amountTransfers
    );
    await ATEN_CONTRACT.connect(deployer).transfer(
      ADDRESS.user_1,
      amountTransfers
    );

    console.log("== OK ==");
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
