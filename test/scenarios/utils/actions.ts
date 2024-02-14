import BigNumber from "bignumber.js";

import {
  calcExpectedReserveDataAfterBorrow,
  calcExpectedReserveDataAfterDeposit,
  calcExpectedReserveDataAfterRepay,
  calcExpectedReserveDataAfterStableRateRebalance,
  calcExpectedReserveDataAfterSwapRateMode,
  calcExpectedReserveDataAfterWithdraw,
  calcExpectedUserDataAfterBorrow,
  calcExpectedUserDataAfterDeposit,
  calcExpectedUserDataAfterRepay,
  calcExpectedUserDataAfterSetUseAsCollateral,
  calcExpectedUserDataAfterStableRateRebalance,
  calcExpectedUserDataAfterSwapRateMode,
  calcExpectedUserDataAfterWithdraw,
} from "../../helpers/utils/calculations";
import {
  getReserveAddressFromSymbol,
  getReserveData,
  getUserData,
} from "./utils/helpers";

import { convertToCurrencyDecimals } from "../../../helpers/contracts-helpers";
import {
  getAToken,
  getMintableERC20,
  getStableDebtToken,
  getVariableDebtToken,
} from "../../../helpers/contracts-getters";
import { MAX_UINT_AMOUNT, ONE_YEAR } from "../../../helpers/constants";
import { SignerWithAddress, TestEnv } from "./make-suite";
import {
  advanceTimeAndBlock,
  DRE,
  timeLatest,
  waitForTx,
} from "../../../helpers/misc-utils";

import { ReserveData, UserReserveData } from "./utils/interfaces";
import { ContractReceipt } from "ethers";
import { AToken } from "../../../types/AToken";
import { RateMode, tEthereumAddress } from "../../../helpers/types";

interface ActionsConfig {
  skipIntegrityCheck: boolean;
}

export const configuration: ActionsConfig = <ActionsConfig>{};

interface ActionData {
  reserve: string;
  reserveData: ReserveData;
  userData: UserReserveData;
  aTokenInstance: AToken;
}

const getDataBeforeAction = async (
  reserveSymbol: string,
  user: tEthereumAddress,
  testEnv: TestEnv,
): Promise<ActionData> => {
  const reserve = await getReserveAddressFromSymbol(reserveSymbol);

  const { reserveData, userData } = await getContractsData(
    reserve,
    user,
    testEnv,
  );
  const aTokenInstance = await getAToken(reserveData.aTokenAddress);
  return {
    reserve,
    reserveData,
    userData,
    aTokenInstance,
  };
};

export const getTxCostAndTimestamp = async (tx: ContractReceipt) => {
  if (!tx.blockNumber || !tx.transactionHash || !tx.cumulativeGasUsed) {
    throw new Error("No tx blocknumber");
  }
  const txTimestamp = new BigNumber(
    (await DRE.ethers.provider.getBlock(tx.blockNumber)).timestamp,
  );

  const txInfo = await DRE.ethers.provider.getTransaction(tx.transactionHash);
  const txCost = new BigNumber(tx.cumulativeGasUsed.toString()).multipliedBy(
    txInfo.gasPrice.toString(),
  );

  return { txCost, txTimestamp };
};

export const getContractsData = async (
  reserve: string,
  user: string,
  testEnv: TestEnv,
  sender?: string,
) => {
  const { pool, helpersContract } = testEnv;

  const [userData, reserveData, timestamp] = await Promise.all([
    getUserData(pool, helpersContract, reserve, user, sender || user),
    getReserveData(helpersContract, reserve),
    timeLatest(),
  ]);

  return {
    reserveData,
    userData,
    timestamp: new BigNumber(timestamp),
  };
};

export async function openCover() {}
export async function updateCover() {}
export async function openPosition() {}
export async function addLiquidity() {}
export async function commitRemoveLiquidity() {}
export async function uncommitRemoveLiquidity() {}
export async function removeLiquidity() {}
export async function takeInterests() {}
export async function initiateClaim() {}
export async function disputeClaim() {}
export async function rule() {}
export async function overrule() {}
export async function withdrawCompensation() {}

// export const borrow = async (
//   reserveSymbol: string,
//   amount: string,
//   interestRateMode: string,
//   user: SignerWithAddress,
//   sendValue: string,
//   timeTravel: string,
//   expectedResult: string,
//   testEnv: TestEnv,
//   revertMessage?: string,
// ) => {
//   const { pool } = testEnv;

//   const reserve = await getReserveAddressFromSymbol(reserveSymbol);

//   const { reserveData: reserveDataBefore, userData: userDataBefore } =
//     await getContractsData(reserve, onBehalfOf, testEnv, user.address);

//   const amountToBorrow = await convertToCurrencyDecimals(reserve, amount);

//   if (expectedResult === "success") {
//     const txResult = await waitForTx(
//       await pool
//         .connect(user.signer)
//         .borrow(reserve, amountToBorrow, interestRateMode, "0", onBehalfOf),
//     );

//     const { txCost, txTimestamp } = await getTxCostAndTimestamp(txResult);

//     if (timeTravel) {
//       const secondsToTravel = new BigNumber(timeTravel)
//         .multipliedBy(ONE_YEAR)
//         .div(365)
//         .toNumber();

//       await advanceTimeAndBlock(secondsToTravel);
//     }

//     const {
//       reserveData: reserveDataAfter,
//       userData: userDataAfter,
//       timestamp,
//     } = await getContractsData(reserve, onBehalfOf, testEnv, user.address);

//     const expectedReserveData = calcExpectedReserveDataAfterBorrow(
//       amountToBorrow.toString(),
//       interestRateMode,
//       reserveDataBefore,
//       userDataBefore,
//       txTimestamp,
//       timestamp,
//     );

//     const expectedUserData = calcExpectedUserDataAfterBorrow(
//       amountToBorrow.toString(),
//       interestRateMode,
//       reserveDataBefore,
//       expectedReserveData,
//       userDataBefore,
//       txTimestamp,
//       timestamp,
//     );

//     expectEqual(reserveDataAfter, expectedReserveData);
//     expectEqual(userDataAfter, expectedUserData);

//     // truffleAssert.eventEmitted(txResult, "Borrow", (ev: any) => {
//     //   const {
//     //     _reserve,
//     //     _user,
//     //     _amount,
//     //     _borrowRateMode,
//     //     _borrowRate,
//     //     _originationFee,
//     //   } = ev;
//     //   return (
//     //     _reserve.toLowerCase() === reserve.toLowerCase() &&
//     //     _user.toLowerCase() === user.toLowerCase() &&
//     //     new BigNumber(_amount).eq(amountToBorrow) &&
//     //     new BigNumber(_borrowRateMode).eq(expectedUserData.borrowRateMode) &&
//     //     new BigNumber(_borrowRate).eq(expectedUserData.borrowRate) &&
//     //     new BigNumber(_originationFee).eq(
//     //       expectedUserData.originationFee.minus(userDataBefore.originationFee)
//     //     )
//     //   );
//     // });
//   } else if (expectedResult === "revert") {
//     await expect(
//       pool
//         .connect(user.signer)
//         .borrow(reserve, amountToBorrow, interestRateMode, "0", onBehalfOf),
//       revertMessage,
//     ).to.be.reverted;
//   }
// };
