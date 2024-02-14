// example of type of functions expected:
// calcExpectedReserveDataAfterBorrow,
// calcExpectedReserveDataAfterDeposit,
// calcExpectedReserveDataAfterRepay,
// calcExpectedReserveDataAfterStableRateRebalance,
// calcExpectedReserveDataAfterSwapRateMode,
// calcExpectedReserveDataAfterWithdraw,
// calcExpectedUserDataAfterBorrow,
// calcExpectedUserDataAfterDeposit,
// calcExpectedUserDataAfterRepay,
// calcExpectedUserDataAfterSetUseAsCollateral,
// calcExpectedUserDataAfterStableRateRebalance,
// calcExpectedUserDataAfterSwapRateMode,
// calcExpectedUserDataAfterWithdraw,

// export const calcExpectedUserDataAfterDeposit = (
//   amountDeposited: string,
//   reserveDataBeforeAction: ReserveData,
//   reserveDataAfterAction: ReserveData,
//   userDataBeforeAction: UserReserveData,
//   txTimestamp: BigNumber,
//   currentTimestamp: BigNumber,
//   txCost: BigNumber
// ): UserReserveData => {
//   const expectedUserData = <UserReserveData>{};

//   expectedUserData.currentStableDebt = calcExpectedStableDebtTokenBalance(
//     userDataBeforeAction.principalStableDebt,
//     userDataBeforeAction.stableBorrowRate,
//     userDataBeforeAction.stableRateLastUpdated,
//     txTimestamp
//   );

//   expectedUserData.currentVariableDebt = calcExpectedVariableDebtTokenBalance(
//     reserveDataBeforeAction,
//     userDataBeforeAction,
//     txTimestamp
//   );

//   expectedUserData.principalStableDebt = userDataBeforeAction.principalStableDebt;
//   expectedUserData.scaledVariableDebt = userDataBeforeAction.scaledVariableDebt;
//   expectedUserData.variableBorrowIndex = userDataBeforeAction.variableBorrowIndex;
//   expectedUserData.stableBorrowRate = userDataBeforeAction.stableBorrowRate;
//   expectedUserData.stableRateLastUpdated = userDataBeforeAction.stableRateLastUpdated;

//   expectedUserData.liquidityRate = reserveDataAfterAction.liquidityRate;

//   expectedUserData.scaledATokenBalance = calcExpectedScaledATokenBalance(
//     userDataBeforeAction,
//     reserveDataAfterAction.liquidityIndex,
//     new BigNumber(amountDeposited),
//     new BigNumber(0)
//   );
//   expectedUserData.currentATokenBalance = calcExpectedATokenBalance(
//     reserveDataBeforeAction,
//     userDataBeforeAction,
//     txTimestamp
//   ).plus(amountDeposited);

//   if (userDataBeforeAction.currentATokenBalance.eq(0)) {
//     expectedUserData.usageAsCollateralEnabled = true;
//   } else {
//     expectedUserData.usageAsCollateralEnabled = userDataBeforeAction.usageAsCollateralEnabled;
//   }

//   expectedUserData.variableBorrowIndex = userDataBeforeAction.variableBorrowIndex;
//   expectedUserData.walletBalance = userDataBeforeAction.walletBalance.minus(amountDeposited);

//   expectedUserData.currentStableDebt = expectedUserData.principalStableDebt = calcExpectedStableDebtTokenBalance(
//     userDataBeforeAction.principalStableDebt,
//     userDataBeforeAction.stableBorrowRate,
//     userDataBeforeAction.stableRateLastUpdated,
//     txTimestamp
//   );

//   expectedUserData.currentVariableDebt = expectedUserData.principalStableDebt = calcExpectedVariableDebtTokenBalance(
//     reserveDataBeforeAction,
//     userDataBeforeAction,
//     txTimestamp
//   );

//   return expectedUserData;
// };
