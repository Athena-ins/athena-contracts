import hre, { ethers } from "hardhat";
import { constants } from "ethers";
import { postTxHandler, fromFork } from "../../test/helpers/hardhat";
import { getNetworkAddresses } from "../verificationData/addresses";
import {
  getDeployPoolConfig,
  ProtocolName,
} from "../verificationData/deployPoolParams";
import { getPoolManager } from "../../test/helpers/contracts-getters";
import { toRay } from "../../test/helpers/utils/poolRayMath";
//
import { LiquidityManager__factory, PoolManager } from "../../typechain";

type PoolUpdateParams = Parameters<
  PoolManager["batchUpdatePoolConfig"]
>[0][number];

const { formatEther } = ethers.utils;

const addresses = getNetworkAddresses();
const poolParams = getDeployPoolConfig();

// npx hardhat run scripts/actions/batchUpdatePoolConfig.ts --network hardhat

const POOLS_TO_UPDATE: ProtocolName[] = [
  "4 - Stake DAO USDT/crvUSD",
  "4 - Stake DAO crvUSD/tBTC/wstETH",
  "4 - Stake DAO crvUSD Leverage (WETH collat)",
  "4 - Stake DAO crvUSD Leverage (wstETH collat)",
  "4 - Stake DAO crvUSD Leverage (WBTC collat)",
  "4 - Stake DAO crvUSD/WETH/CRV",
  "4 - Stake DAO FRAX/crvUSD",
  "4 - Stake DAO ETH/ETHx",
  "4 - Stake DAO USDC/crvUSD",
  "4 - Inception Symbiotic Restaked wstETH",
  "4 - Stake DAO eUSD/USDC",
];
const POOL_CONFIG: Partial<Omit<PoolUpdateParams, "poolId">> = {
  feeRate: toRay(1),
};

async function main() {
  try {
    const networkName = hre.network.name.toUpperCase();
    const forkTarget = networkName === "HARDHAT" ? ` (${fromFork()})` : "";
    console.log(`\n== UPDATE POOLS ON ${networkName}${forkTarget} ==\n`);

    const deployer = (await ethers.getSigners())[0];
    console.log("deployer: ", deployer.address);

    const balance = await deployer.getBalance();
    console.log("balance: ", `${formatEther(balance)} ETH`);

    //================//
    //== OPEN POOLS ==//
    //================//

    // ============ MANAGER PRE ============ //
    const LiquidityManager = LiquidityManager__factory.connect(
      addresses.LiquidityManager,
      deployer,
    );
    const nextPoolId = await LiquidityManager.nextPoolId();
    console.log("Next Pool Id: ", nextPoolId.toNumber());

    if (
      !addresses.PoolManager ||
      addresses.PoolManager === constants.AddressZero
    )
      throw Error("PoolManager address is missing");

    await postTxHandler(
      LiquidityManager.transferOwnership(addresses.PoolManager),
    );

    // ===================================== //

    const poolIds = POOLS_TO_UPDATE.map((poolName) => {
      const index = poolParams.findIndex((pool) => pool.name === poolName);
      if (index === -1) throw Error(`Pool ${poolName} not found`);
      return index;
    });
    const currentParams = await LiquidityManager.poolInfos(poolIds);

    const updatedParams: PoolUpdateParams[] = currentParams.map((params) => {
      const previous = {
        feeRate: params.feeRate,
        uOptimal: params.formula.uOptimal,
        r0: params.formula.r0,
        rSlope1: params.formula.rSlope1,
        rSlope2: params.formula.rSlope2,
      };

      return {
        poolId: params.poolId,
        ...previous,
        ...POOL_CONFIG,
      };
    });

    console.log("=> UPDATED_CONFIGS: ", updatedParams);

    const PoolManager = await getPoolManager(addresses.PoolManager);

    await postTxHandler(PoolManager.batchUpdatePoolConfig(updatedParams));

    // ============ MANAGER POST ============ //

    await postTxHandler(
      PoolManager.transferLiquidityManagerOwnership(deployer.address),
    );

    const liquidityManagerOwner = await LiquidityManager.owner();
    if (
      liquidityManagerOwner.toLowerCase() !== deployer.address.toLowerCase()
    ) {
      throw Error("LiquidityManager ownership transfer failed");
    }

    // ===================================== //

    const [balanceAfter, gasPrice] = await Promise.all([
      deployer.getBalance(),
      hre.ethers.provider.getGasPrice(),
    ]);

    console.log(
      "\ncost: ",
      `${formatEther(balance.sub(balanceAfter))} ETH / ${ethers.utils.formatUnits(
        gasPrice,
        9,
      )} GWEI`,
    );
  } catch (err: any) {
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
