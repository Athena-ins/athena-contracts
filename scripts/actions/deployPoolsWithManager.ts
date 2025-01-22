import hre, { ethers } from "hardhat";
import { constants, BigNumberish } from "ethers";
import { postTxHandler, fromFork } from "../../test/helpers/hardhat";
import { getNetworkAddresses } from "../verificationData/addresses";
import { getDeployConfig } from "../verificationData/deployParams";
import { getDeployPoolConfig } from "../verificationData/deployPoolParams";
import { getPoolManager } from "../../test/helpers/contracts-getters";
//
import { LiquidityManager, LiquidityManager__factory } from "../../typechain";

const { formatEther } = ethers.utils;

type PoolCreationParams = {
  paymentAsset: string;
  strategyId: BigNumberish;
  feeRate: BigNumberish;
  uOptimal: BigNumberish;
  r0: BigNumberish;
  rSlope1: BigNumberish;
  rSlope2: BigNumberish;
  compatiblePools: number[];
};

const UPDATE_COMPATIBILITY = true;

const addresses = getNetworkAddresses();
const poolParams = getDeployPoolConfig();

// npx hardhat run scripts/actions/deployPoolsWithManager.ts --network hardhat

async function main() {
  try {
    const networkName = hre.network.name.toUpperCase();
    const forkTarget = networkName === "HARDHAT" ? ` (${fromFork()})` : "";
    console.log(
      `\n== CREATE POOL W/ MANAGER ON ${networkName}${forkTarget} ==\n`,
    );

    const deployer = (await ethers.getSigners())[0];
    console.log("deployer: ", deployer.address);

    const balance = await deployer.getBalance();
    console.log("balance: ", `${formatEther(balance)} ETH`);

    const LiquidityManager = LiquidityManager__factory.connect(
      addresses.LiquidityManager,
      deployer,
    );
    const nextPoolId = await LiquidityManager.nextPoolId();
    console.log("Next Pool Id: ", nextPoolId.toNumber(), "\n");

    //================//
    //== OPEN POOLS ==//
    //================//

    // ============ MANAGER PRE ============ //
    if (
      !addresses.PoolManager ||
      addresses.PoolManager === constants.AddressZero
    )
      throw Error("PoolManager address is missing");

    const PoolManager = (await getPoolManager(addresses.PoolManager)).connect(
      deployer,
    );

    await postTxHandler(
      LiquidityManager.transferOwnership(addresses.PoolManager),
    );

    // ================ CREATE ============== //

    const poolTransactionParams: PoolCreationParams[] = [];

    for (const [i, params] of poolParams.entries()) {
      // Skip already deployed pools
      if (i < nextPoolId.toNumber()) {
        console.log(
          `==> ⏭️  Skiped ${i}/${poolParams.length - 1}\n${params.name}`,
        );
        continue;
      }

      poolTransactionParams.push({
        paymentAsset: params.paymentAsset,
        strategyId: params.strategyId,
        feeRate: params.feeRate,
        uOptimal: params.uOptimal,
        r0: params.r0,
        rSlope1: params.rSlope1,
        rSlope2: params.rSlope2,
        compatiblePools: params.compatiblePools,
      });

      console.log(
        `==> ✅ Deploy ${i}/${poolParams.length - 1}\n${params.name}`,
      );
    }

    await postTxHandler(PoolManager.batchCreatePool(poolTransactionParams));

    // =========== UPDATE COMPATIBILITY =========== //

    if (UPDATE_COMPATIBILITY) {
      console.log("\n==> Checking pool compatibilities");
      const updates = await checkPoolCompatibility(LiquidityManager);

      if (updates.poolIds.length === 0) {
        console.log("==> ⏭️  All pool compatibilities are up to date");
      } else {
        console.log("==> Updates required for pools:", updates.poolIds);

        await postTxHandler(
          PoolManager.batchUpdatePoolCompatibility(
            updates.poolIds,
            updates.poolIdCompatible,
            updates.poolIdCompatibleStatus,
          ),
        );

        console.log("==> ✅ Pool compatibilities updated successfully");
      }
    }

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

async function checkPoolCompatibility(liquidityManager: LiquidityManager) {
  const pools = getDeployPoolConfig();

  const updates: {
    poolIds: number[];
    poolIdCompatible: number[][];
    poolIdCompatibleStatus: boolean[][];
  } = {
    poolIds: [],
    poolIdCompatible: [],
    poolIdCompatibleStatus: [],
  };

  const compatibilityChecks = [];
  for (let i = 0; i < pools.length; i++) {
    const checksForPoolI = [];
    for (let j = i + 1; j < pools.length; j++) {
      checksForPoolI.push({
        poolId: i,
        otherPoolId: j,
        shouldBeCompatible: !pools[i].incompatiblePools.includes(pools[j].name),
        compatibilityCheck: liquidityManager.arePoolCompatible(i, j), // Already using smallest ID first
      });
    }
    if (checksForPoolI.length > 0) {
      compatibilityChecks.push(
        Promise.all(
          checksForPoolI.map(async (check) => ({
            ...check,
            isCompatibleOnChain: await check.compatibilityCheck,
          })),
        ),
      );
    }
  }

  const results = await Promise.all(compatibilityChecks);

  results.forEach((poolChecks) => {
    const updatesForPool = poolChecks.filter(
      (check) => check.shouldBeCompatible !== check.isCompatibleOnChain,
    );

    if (updatesForPool.length > 0) {
      updates.poolIds.push(updatesForPool[0].poolId);
      updates.poolIdCompatible.push(updatesForPool.map((u) => u.otherPoolId));
      updates.poolIdCompatibleStatus.push(
        updatesForPool.map((u) => u.shouldBeCompatible),
      );
    }
  });

  return updates;
}
