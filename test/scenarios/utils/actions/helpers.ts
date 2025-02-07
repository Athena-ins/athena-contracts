import hre from "hardhat";
import {
  claimInfoFormat,
  coverInfoFormat,
  poolInfoFormat,
  positionInfoFormat,
} from "../../../helpers/dataFormat";
import { getCurrentTime } from "../../../helpers/hardhat";
import {
  ClaimInfoObject,
  CoverInfoObject,
  PoolInfoObject,
  PositionInfoObject,
} from "../../../helpers/types";
// Types
import { BigNumber, BigNumberish, ContractReceipt } from "ethers";
import { TestEnv } from "../../../context";

export const getTxCostAndTimestamp = async (tx: ContractReceipt) => {
  if (!tx.blockNumber || !tx.transactionHash || !tx.cumulativeGasUsed) {
    throw new Error("No tx blocknumber");
  }
  const txTimestamp = (await hre.ethers.provider.getBlock(tx.blockNumber))
    .timestamp;

  const txInfo = await hre.ethers.provider.getTransaction(tx.transactionHash);
  if (!txInfo?.gasPrice) throw new Error("No tx info");
  const txCost = BigNumber.from(tx.cumulativeGasUsed.toString()).mul(
    txInfo.gasPrice.toString(),
  );

  return { txCost, txTimestamp };
};

type EntityInfo = {
  id: BigNumberish;
  type: "cover" | "position" | "claim";
};

type EntityDataMap = {
  cover: CoverInfoObject;
  position: PositionInfoObject;
  claim: ClaimInfoObject;
};

type ContractsDataStateMulti<T extends EntityInfo[]> = {
  poolData: PoolInfoObject[];
  entityDatas: { [K in keyof T]: EntityDataMap[T[K]["type"]] };
  timestamp: number;
};

export async function getEntityData<T extends EntityInfo[]>(
  testEnv: TestEnv,
  poolIds: BigNumberish[],
  entities: [...T],
): Promise<ContractsDataStateMulti<T>> {
  const { LiquidityManager, ClaimManager } = testEnv.contracts;

  const poolData = await Promise.all(
    poolIds.map((poolId) =>
      LiquidityManager.poolInfo(poolId).then((data) => poolInfoFormat(data)),
    ),
  );

  const entityDataPromises = entities.map(async ({ id, type }) => {
    if (type === "cover") {
      return LiquidityManager.coverInfo(id).then((data) =>
        coverInfoFormat(data),
      );
    } else if (type === "position") {
      return LiquidityManager.positionInfo(id).then((data) =>
        positionInfoFormat(data),
      );
    } else {
      return ClaimManager.claimInfo(id).then((data) => claimInfoFormat(data));
    }
  });

  const [entityDatas, timestamp] = await Promise.all([
    Promise.all(entityDataPromises),
    getCurrentTime(),
  ]);

  return {
    poolData,
    entityDatas: entityDatas as { [K in keyof T]: EntityDataMap[T[K]["type"]] },
    timestamp,
  };
}
