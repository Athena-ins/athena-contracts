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

type ContractsDataState = {
  poolData: PoolInfoObject[];
  tokenData: PositionInfoObject | CoverInfoObject | ClaimInfoObject;
  timestamp: number;
};

export async function getContractsData(
  testEnv: TestEnv,
  poolIds: BigNumberish[],
  tokenId: BigNumberish,
  tokenType: "claim",
): Promise<
  ContractsDataState & {
    tokenData: ClaimInfoObject;
  }
>;

export async function getContractsData(
  testEnv: TestEnv,
  poolIds: BigNumberish[],
  tokenId: BigNumberish,
  tokenType: "position",
): Promise<
  ContractsDataState & {
    tokenData: PositionInfoObject;
  }
>;

export async function getContractsData(
  testEnv: TestEnv,
  poolIds: BigNumberish[],
  tokenId: BigNumberish,
  tokenType: "cover",
): Promise<
  ContractsDataState & {
    tokenData: CoverInfoObject;
  }
>;

export async function getContractsData(
  testEnv: TestEnv,
  poolIds: BigNumberish[],
  tokenId: BigNumberish,
  tokenType: "cover" | "position" | "claim",
): Promise<ContractsDataState> {
  const { LiquidityManager, ClaimManager } = testEnv.contracts;

  const poolData = await Promise.all(
    poolIds.map((poolId) =>
      LiquidityManager.poolInfo(poolId).then((data) => poolInfoFormat(data)),
    ),
  );

  let tokenDataPromise: Promise<
    PositionInfoObject | CoverInfoObject | ClaimInfoObject
  >;
  if (tokenType === "cover") {
    tokenDataPromise = LiquidityManager.coverInfo(tokenId).then((data) =>
      coverInfoFormat(data),
    );
  } else if (tokenType === "position") {
    tokenDataPromise = LiquidityManager.positionInfo(tokenId).then((data) =>
      positionInfoFormat(data),
    );
  } else {
    tokenDataPromise = ClaimManager.claimInfo(tokenId).then((data) =>
      claimInfoFormat(data),
    );
  }

  const [tokenData, timestamp] = await Promise.all([
    tokenDataPromise,
    getCurrentTime(),
  ]);

  return {
    poolData,
    tokenData,
    timestamp,
  };
}
