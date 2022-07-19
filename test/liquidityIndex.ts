const T_YEAR = 31536000;
function delta_t_year(delta_t: number) {
  return delta_t / T_YEAR;
}

function utilisationRate(
  totalInsuredLiquidity: number,
  totalAvailableLiquidity: number
) {
  return totalAvailableLiquidity === 0
    ? 0
    : totalInsuredLiquidity / totalAvailableLiquidity;
}

function premiumRate(utilisationRate: number) {
  return 0.01 + (5 * utilisationRate) / 75;
}

function currentLiquidityRate(
  currentPremiumRate: number,
  currentUtilisationRate: number
) {
  return currentPremiumRate * currentUtilisationRate;
}

function currentLiquidityIndex(
  currentLiquidityRate: number,
  delta_t: number,
  previosLiquidityIndex: number
) {
  return (
    (currentLiquidityRate * delta_t_year(delta_t) + 1) * previosLiquidityIndex
  );
}

function testLI() {
  let availableCapital: number = 0;
  let totalInsuredCapital: number = 0;
  let premiumSpent: number = 0;

  //Deposit1
  const dAmount1 = (730000 * 3) / 4;
  const scBal1 = dAmount1;
  availableCapital += dAmount1;

  console.log("dAmount1:", dAmount1);
  console.log("scBal1:", scBal1);
  console.log("availableCapital:", availableCapital);
  console.log("-----------------------------");

  //Policy1
  const amount1 = 109500;
  totalInsuredCapital += amount1;

  const _utilisationRate1 = utilisationRate(
    totalInsuredCapital,
    availableCapital + premiumSpent
  );

  const _premiumRate1 = premiumRate(_utilisationRate1);

  const _liquidityRate1 = currentLiquidityRate(
    _premiumRate1,
    _utilisationRate1
  );

  const _liquidityIndex1 = currentLiquidityIndex(
    _liquidityRate1,
    10 * 24 * 60 * 60,
    1
  );

  console.log("_utilisationRate1:", _utilisationRate1);
  console.log("_premiumRate1:", _premiumRate1);
  console.log("_liquidityRate1:", _liquidityRate1);
  console.log("_liquidityIndex1:", _liquidityIndex1);
  console.log("_currentBalance1:", scBal1 * _liquidityIndex1);
  console.log("income1:", scBal1 * _liquidityIndex1 - scBal1);
  console.log("-----------------------------");

  //Deposit2
  const dAmount2 = 730000 / 4;
  const scBal2 = dAmount2 / _liquidityIndex1;
  availableCapital += dAmount2;

  console.log("dAmount2:", dAmount2);
  console.log("scBal2:", scBal2);
  console.log("availableCapital:", availableCapital);
  console.log("-----------------------------");

  //Policy2
  const amount2 = 219000;
  totalInsuredCapital += amount2;
  // premiumSpent += _currentBalance1 - 730000;

  const _utilisationRate2 = utilisationRate(
    totalInsuredCapital,
    availableCapital + premiumSpent
  );

  const _premiumRate2 = premiumRate(_utilisationRate2);
  const _liquidityRate2 = currentLiquidityRate(
    _premiumRate2,
    _utilisationRate2
  );

  const _liquidityIndex2 = currentLiquidityIndex(
    _liquidityRate2,
    10 * 24 * 60 * 60,
    _liquidityIndex1
  );

  console.log("_utilisationRate2:", _utilisationRate2);
  console.log("_premiumRate2:", _premiumRate2);
  console.log("_liquidityRate2:", _liquidityRate2);
  console.log("_liquidityIndex2:", _liquidityIndex2);
  console.log("_currentBalance2:", scBal1 * _liquidityIndex2);
  console.log("income2:", scBal1 * _liquidityIndex2 - scBal1);
  console.log("current balance deposit2", scBal2 * _liquidityIndex2);
  console.log("-----------------------------");

  //Deposit2 out
  availableCapital -= dAmount2;

  const _utilisationRate3 = utilisationRate(
    totalInsuredCapital,
    availableCapital + premiumSpent
  );

  const _premiumRate3 = premiumRate(_utilisationRate3);
  const _liquidityRate3 = currentLiquidityRate(
    _premiumRate3,
    _utilisationRate3
  );

  const _liquidityIndex3 = currentLiquidityIndex(
    _liquidityRate3,
    10 * 24 * 60 * 60,
    _liquidityIndex2
  );

  console.log("_utilisationRate3:", _utilisationRate3);
  console.log("_premiumRate3:", _premiumRate3);
  console.log("_liquidityRate3:", _liquidityRate3);
  console.log("_liquidityIndex3:", _liquidityIndex3);
  console.log("_currentBalance3:", scBal1 * _liquidityIndex3);
  console.log("-----------------------------");
}

testLI();
