import { BigNumber, BigNumberish } from "ethers";

const bn = (n: BigNumberish) => BigNumber.from(n);

const RAY = bn(10).pow(27); //27 decimal
const halfRAY = RAY.div(2);

function ray(n: BigNumberish) {
  return RAY.mul(n);
}

function rayMul(a: BigNumberish, b: BigNumberish) {
  return bn(a).mul(b).add(halfRAY).div(RAY);
}

function rayDiv(a: BigNumberish, b: BigNumberish) {
  return bn(a).mul(RAY).add(bn(b).div(2)).div(b);
}

const T_YEAR = 31536000;

function utilisationRate(
  totalInsuredLiquidity: number,
  totalAvailableLiquidity: number
) {
  return totalAvailableLiquidity === 0
    ? bn(0)
    : rayDiv(ray(totalInsuredLiquidity), ray(totalAvailableLiquidity));
}

const f = {
  r0: RAY,
  rSlope1: ray(5),
  uOptimal: ray(75).div(100), // 75% = 0.75
};

function premiumRate(utilisationRate: BigNumber) {
  return f.r0
    .add(rayMul(f.rSlope1, rayDiv(utilisationRate, f.uOptimal)))
    .div(100);
}

function liquidityRate(
  currentPremiumRate: BigNumber,
  currentUtilisationRate: BigNumber
) {
  return rayMul(currentPremiumRate, currentUtilisationRate);
}

function liquidityIndex(
  currentLiquidityRate: BigNumber,
  delta_t: number,
  previosLiquidityIndex: BigNumber
) {
  return rayMul(
    currentLiquidityRate.mul(delta_t).div(T_YEAR),
    previosLiquidityIndex
  ).add(previosLiquidityIndex);
}

const reserve = {
  availableCapital: 0,
  totalInsuredCapital: 0,
  utilisationRate: bn(0),
  premiumRate: bn(0),
  liquidityRate: bn(0),
  liquidityIndex: ray(1),
};

function updateReserve(delta_t: number) {
  reserve.utilisationRate = utilisationRate(
    reserve.totalInsuredCapital,
    reserve.availableCapital
  );
  console.log("reserve.utilisationRate:", reserve.utilisationRate.toString());

  reserve.premiumRate = premiumRate(reserve.utilisationRate);
  console.log("reserve.premiumRate:", reserve.premiumRate.toString());

  reserve.liquidityRate = liquidityRate(
    reserve.premiumRate,
    reserve.utilisationRate
  );
  console.log("reserve.liquidityRate:", reserve.liquidityRate.toString());

  reserve.liquidityIndex = liquidityIndex(
    reserve.liquidityRate,
    delta_t,
    reserve.liquidityIndex
  );
  console.log("reserve.liquidityIndex:", reserve.liquidityIndex.toString());
}

function testLI() {
  //Depositor1
  const depositor1 = {
    depositedAmount: 100000,
    scaledBalance: bn(0),
    currentBalance: bn(0),
    income: bn(0),
  };

  console.log("depositor1.depositedAmount:", depositor1.depositedAmount);

  depositor1.scaledBalance = rayDiv(
    depositor1.depositedAmount,
    reserve.liquidityIndex
  );
  console.log("depositor1.scaledBalance:", depositor1.scaledBalance.toString());

  reserve.availableCapital += depositor1.depositedAmount;
  console.log("reserve.availableCapital:", reserve.availableCapital);

  console.log("-----------------------------");

  //Policy1
  const policyAmount1 = 30000;
  reserve.totalInsuredCapital += policyAmount1;

  updateReserve(10 * 24 * 60 * 60);
  //après 10 jours, delta_premiumSpent = 25

  depositor1.currentBalance = rayMul(
    depositor1.scaledBalance,
    reserve.liquidityIndex
  );
  console.log(
    "depositor1.currentBalance:",
    depositor1.currentBalance.toString()
  );

  depositor1.income = depositor1.currentBalance.sub(depositor1.depositedAmount);
  console.log("depositor1.income:", depositor1.income.toString());

  console.log("-----------------------------");

  //Depositor2
  const depositor2 = {
    depositedAmount: 100000,
    scaledBalance: bn(0),
    currentBalance: bn(0),
    income: bn(0),
  };

  console.log("depositor2.depositedAmount:", depositor2.depositedAmount);

  depositor2.scaledBalance = rayDiv(
    depositor2.depositedAmount,
    reserve.liquidityIndex
  );
  console.log("depositor2.scaledBalance:", depositor2.scaledBalance.toString());

  reserve.availableCapital += depositor2.depositedAmount;
  console.log("reserve.availableCapital:", reserve.availableCapital);

  updateReserve(10 * 24 * 60 * 60);
  //après 10 jours, delta_premiumSpent = 16

  depositor1.currentBalance = rayMul(
    depositor1.scaledBalance,
    reserve.liquidityIndex
  );
  console.log(
    "depositor1.currentBalance:",
    depositor1.currentBalance.toString()
  );

  //income = currentBalance - depositedAmount
  //or
  //income = currentBalance - scaledBalance
  //???
  depositor1.income = depositor1.currentBalance.sub(depositor1.depositedAmount);
  console.log(
    "depositor1.income:",
    " ".repeat(7),
    depositor1.income.toString()
  );

  depositor2.currentBalance = rayMul(
    depositor2.scaledBalance,
    reserve.liquidityIndex
  );
  console.log(
    "depositor2.currentBalance:",
    depositor2.currentBalance.toString()
  );

  depositor2.income = depositor2.currentBalance.sub(depositor2.depositedAmount);
  console.log("depositor2.income:", depositor2.income.toString());

  console.log("-----------------------------");

  //Policy2
  const amount2 = 30000;
  reserve.totalInsuredCapital += amount2;

  updateReserve(10 * 24 * 60 * 60);
  //après 10 jours, delta_premiumSpent = 50

  depositor1.currentBalance = rayMul(
    depositor1.scaledBalance,
    reserve.liquidityIndex
  );
  console.log(
    "depositor1.currentBalance:",
    depositor1.currentBalance.toString()
  );

  depositor1.income = depositor1.currentBalance.sub(depositor1.depositedAmount);
  console.log("depositor1.income:", depositor1.income.toString());

  depositor2.currentBalance = rayMul(
    depositor2.scaledBalance,
    reserve.liquidityIndex
  );
  console.log(
    "depositor2.currentBalance:",
    depositor2.currentBalance.toString()
  );

  depositor2.income = depositor2.currentBalance.sub(depositor2.depositedAmount);
  console.log("depositor2.income:", depositor2.income.toString());

  console.log("-----------------------------");

  //Depositor2 out
  reserve.availableCapital -= depositor2.depositedAmount;
  console.log("reserve.availableCapital:", reserve.availableCapital);

  updateReserve(10 * 24 * 60 * 60);
  //après 10 jours, delta_premiumSpent = 82

  depositor1.currentBalance = rayMul(
    depositor1.scaledBalance,
    reserve.liquidityIndex
  );
  console.log(
    "depositor1.currentBalance:",
    depositor1.currentBalance.toString()
  );

  depositor1.income = depositor1.currentBalance.sub(depositor1.depositedAmount);
  console.log("depositor1.income:", depositor1.income.toString());
}

testLI();
