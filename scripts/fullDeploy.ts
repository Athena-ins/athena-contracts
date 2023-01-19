import hre, { ethers as hre_ethers } from "hardhat";
import ProtocolHelper from "../test/helpers/ProtocolHelper";
import { deploymentAddress, contract } from "../test/helpers/TypedContracts";
//
import abiERC20 from "../abis/weth.json";

const { BigNumber } = hre_ethers;

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

    deploymentAddress.deployer = await deployer.getAddress();
    deploymentAddress.user_1 = await user_1.getAddress();

    // =====> deploy ATEN token & deploy arbitrator
    await ProtocolHelper.deployAtenTokenContract(deployer);
    await ProtocolHelper.deployArbitratorContract(deployer);

    const ARBITRATOR_CONTRACT = ProtocolHelper.getArbitratorContract();
    deploymentAddress.ARBITRATOR = ARBITRATOR_CONTRACT.address;

    console.log("== OK 1 ==");

    // =====> deploy athena contracts
    await ProtocolHelper.deployAthenaContract(
      deployer,
      deploymentAddress.USDT,
      deploymentAddress.aave_registry
    );
    await ProtocolHelper.deployPositionManagerContract(deployer);
    await ProtocolHelper.deployStakedAtenContract(deployer);
    await ProtocolHelper.deployPolicyManagerContract(deployer);
    await ProtocolHelper.deployProtocolFactoryContract(deployer);
    await ProtocolHelper.deployStakedAtensPolicyContract(deployer);
    await ProtocolHelper.deployVaultAtenContract(deployer);
    await ProtocolHelper.deployClaimManagerContract(
      deployer,
      deploymentAddress.ARBITRATOR
    );

    await ProtocolHelper.initializeProtocol(deployer);

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

    const USDT_CONTRACT = new hre_ethers.Contract(
      deploymentAddress.USDT,
      abiERC20
    );
    const ATEN_CONTRACT = ProtocolHelper.getAtenTokenContract();
    const ATHENA_CONTRACT = ProtocolHelper.getAthenaContract();
    const VAULT_CONTRACT = ProtocolHelper.getVaultAtenContract();

    deploymentAddress.ATHENA = ATHENA_CONTRACT.address;
    deploymentAddress.TOKEN_VAULT = VAULT_CONTRACT.address;

    // =====> approve tokens

    await USDT_CONTRACT.connect(deployer).approve(
      deploymentAddress.ATHENA,
      amountApprove
    );

    await ATEN_CONTRACT.connect(deployer).transfer(
      deploymentAddress.user_1,
      amountTransfers
    );

    console.log("== OK 4 ==");

    // =====> deposit ATEN in rewards vault

    await ProtocolHelper.depositRewardsToVault(deployer, amountTransfers);

    // =====> send ATEN to user

    console.log("====== OK ======");

    console.log(
      "CONTRACT: ",
      Object.entries(contract).reduce(
        (acc, [key, value]) =>
          (deploymentAddress as any)[key]
            ? { ...acc, [key]: value.address }
            : acc,
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
main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
