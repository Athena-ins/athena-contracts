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
// Set at 25 ATEN = 1 USDT
const initialAtenOraclePrice = BigNumber.from(25).mul(
  BigNumber.from(10).pow(18)
);

async function main() {
  try {
    console.log(`\n== DEPLOY ON ${hre.network.name.toUpperCase()} ==\n`);

    if (
      hre.network.name === "goerli" &&
      (!process.env.TESTER_WALLET || process.env.TESTER_WALLET.length != 42)
    ) {
      throw Error("TESTER_WALLET not set");
    }

    const signers = await hre_ethers.getSigners();
    const deployer = signers[0];
    const user_1 = signers[1];

    deploymentAddress.deployer = await deployer.getAddress();
    deploymentAddress.user_1 = await user_1.getAddress();

    // =====> deploy ATEN token & deploy arbitrator
    // @dev for the moment do not redeploy ATEN token to reuse existing one
    if (hre.network.name === "hardhat") {
      console.log("==> ATEN TOKEN");
      await ProtocolHelper.deployAtenTokenContract(deployer);
    }
    console.log("==> ARBITRATOR");
    await ProtocolHelper.deployArbitratorContract(deployer);

    const ARBITRATOR_CONTRACT = ProtocolHelper.getArbitratorContract();
    deploymentAddress.ARBITRATOR = ARBITRATOR_CONTRACT.address;

    // =====> deploy athena contracts
    console.log("==> CORE");
    await ProtocolHelper.deployAthenaContract(
      deployer,
      deploymentAddress.USDT,
      deploymentAddress.aave_registry
    );

    console.log("==> POOL FACTORY");
    await ProtocolHelper.deployProtocolFactoryContract(deployer);
    console.log("==> PRICE ORACLE");
    await ProtocolHelper.deployPriceOracleV1Contract(
      deployer,
      initialAtenOraclePrice
    );
    console.log("==> VAULT");
    await ProtocolHelper.deployVaultAtenContract(deployer);

    console.log("==> MANAGER POSITIONS");
    await ProtocolHelper.deployPositionManagerContract(deployer);
    console.log("==> MANAGER COVERS");
    await ProtocolHelper.deployPolicyManagerContract(deployer);
    console.log("==> MANAGER CLAIMS");
    await ProtocolHelper.deployClaimManagerContract(
      deployer,
      deploymentAddress.ARBITRATOR
    );

    console.log("==> STAKING GP");
    await ProtocolHelper.deployStakedAtenContract(deployer);
    console.log("==> COVER REFUND");
    await ProtocolHelper.deployStakedAtensPolicyContract(deployer);

    console.log("==> INITIALIZE");
    await ProtocolHelper.initializeProtocol(deployer);

    // =====> set fee levels & reward levels
    console.log("==> FEE + REWARD + REFUND CONFIG");
    await ProtocolHelper.setFeeLevelsWithAten(deployer);
    await ProtocolHelper.setStakingRewardRates(deployer);
    await ProtocolHelper.setCoverRefundConfig(deployer);

    // =====> deploy pools
    console.log("==> ADD POOLS");
    await ProtocolHelper.addNewProtocolPool("FTX Reserve Insurance");
    await ProtocolHelper.addNewProtocolPool("Dog Theme Coin Rugpull");
    await ProtocolHelper.addNewProtocolPool("AAVE Lending Pool");
    await ProtocolHelper.addNewProtocolPool("Hotdog Swap Liquidity Pool");

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

    console.log("==> DEPLOYER APPROVE");
    // =====> approve tokens
    await USDT_CONTRACT.connect(deployer).approve(
      deploymentAddress.ATHENA,
      amountApprove
    );
    await ATEN_CONTRACT.connect(deployer).approve(
      deploymentAddress.ATHENA,
      amountApprove
    );

    // =====> transfer tokens
    if (hre.network.name === "goerli") {
      console.log("==> TRANSFERS");
      await ATEN_CONTRACT.connect(deployer).transfer(
        process.env.TESTER_WALLET as string,
        amountTransfers
      );
    }

    // =====> deposit ATEN in rewards vault
    console.log("==> DEPOSIT TO VAULT");
    await ProtocolHelper.depositRewardsToVault(deployer, amountTransfers);

    // =====> send ATEN to user

    console.log(
      "\n==> Contracts: ",
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
