import { BigNumber, BigNumberish } from "ethers";

type JsRay = BigNumber & {
  rayMul: (b: BigNumberish) => JsRay;
  rayDiv: (b: BigNumberish) => JsRay;
  r_div: (b: BigNumberish) => JsRay;
  r_mul: (b: BigNumberish) => JsRay;
  r_add: (b: BigNumberish) => JsRay;
  r_sub: (b: BigNumberish) => JsRay;
};

function Ray(value: BigNumberish, isRay = true): JsRay {
  const rayMethods = {
    rayMul: function (b: BigNumberish) {
      return Ray(BigNumber.from(this).mul(b).add(halfRAY).div(RAY));
    },
    rayDiv: function (b: BigNumberish) {
      return Ray(
        BigNumber.from(this).mul(RAY).add(BigNumber.from(b).div(2)).div(b),
      );
    },
    r_div: function (b: BigNumberish) {
      return Ray(BigNumber.from(this).div(b));
    },
    r_mul: function (b: BigNumberish) {
      return Ray(BigNumber.from(this).mul(b));
    },
    r_add: function (b: BigNumberish) {
      return Ray(BigNumber.from(this).add(b));
    },
    r_sub: function (b: BigNumberish) {
      return Ray(BigNumber.from(this).sub(b));
    },
  };

  const rayObject = Object.create(BigNumber.prototype, rayMethods);

  const toRay = (value: BigNumberish) => BigNumber.from(value).mul(RAY);

  return rayObject.from(isRay ? BigNumber.from(value) : toRay(value));
}

const RAY = BigNumber.from(10).pow(27); //27 decimal
const halfRAY = RAY.div(2);

const YEAR = Ray(BigNumber.from(365 * 86400));
const MAX_SECONDS_PER_TICK = Ray(BigNumber.from(86400));
const FEE_BASE = Ray(RAY);
const PERCENTAGE_BASE = Ray(BigNumber.from(100));
const FULL_CAPACITY = Ray(PERCENTAGE_BASE.mul(RAY));

type Formula = {
  uOptimal: BigNumber;
  r0: BigNumber;
  rSlope1: BigNumber;
  rSlope2: BigNumber;
};

type PoolData = {
  slot0: {
    coveredCapital: BigNumber;
    secondsPerTick: BigNumber;
  };
  totalLiquidity: BigNumber;
  f: Formula;
};

/**
 * @notice Computes the premium rate of a cover,
 * the premium rate is the APR cost for a cover  ,
 * these are paid by cover buyer on their cover amount.
 *
 * @param self The pool
 * @param utilizationRate_ The utilization rate of the pool
 *
 * @return The premium rate of the cover expressed in rays
 *
 * @dev Not pure since reads self but pure for all practical purposes
 */
function getPremiumRate(
  poolData: PoolData,
  utilizationRate_: BigNumber,
): BigNumber {
  const formula = {
    uOptimal: Ray(poolData.f.uOptimal),
    r0: Ray(poolData.f.r0),
    rSlope1: Ray(poolData.f.rSlope1),
    rSlope2: Ray(poolData.f.rSlope2),
  };
  const utilizationRate = Ray(utilizationRate_);

  if (utilizationRate.lt(formula.uOptimal)) {
    // Return base rate + proportional slope 1 rate
    return formula.r0.r_add(
      formula.rSlope1.rayMul(utilizationRate.rayDiv(formula.uOptimal)),
    );
  } else if (utilizationRate.lt(FULL_CAPACITY)) {
    // Return base rate + slope 1 rate + proportional slope 2 rate
    return formula.r0
      .r_add(formula.rSlope1)
      .add(
        formula.rSlope2.rayMul(
          utilizationRate
            .r_sub(formula.uOptimal)
            .rayDiv(FULL_CAPACITY.r_sub(formula.uOptimal)),
        ),
      );
  } else {
    // Return base rate + slope 1 rate + slope 2 rate
    /**
     * @dev Premium rate is capped because in case of overusage the
     * liquidity providers are exposed to the same risk as 100% usage but
     * cover buyers are not fully covered.
     * This means cover buyers only pay for the effective cover they have.
     */
    return formula.r0.r_add(formula.rSlope1).r_add(formula.rSlope2);
  }
}

/**
 * @notice Computes the liquidity index for a given period
 * @param utilizationRate_ The utilization rate
 * @param premiumRate_ The premium rate
 * @param timeSeconds_ The time in seconds
 * @return The liquidity index to add for the given time
 */
function computeLiquidityIndex(
  utilizationRate_: BigNumber,
  premiumRate_: BigNumber,
  timeSeconds_: BigNumber,
): BigNumber {
  const utilizationRate = Ray(utilizationRate_);
  const premiumRate = Ray(premiumRate_);
  const timeSeconds = Ray(timeSeconds_);

  return utilizationRate.rayMul(premiumRate).rayMul(timeSeconds).rayDiv(YEAR);
}

/**
 * @notice Computes the premiums or interests earned by a liquidity position
 * @param userCapital_ The amount of liquidity in the position
 * @param liquidityIndex_ The end liquidity index
 * @param beginLiquidityIndex_ The start liquidity index
 */
function getCoverRewards(
  userCapital_: BigNumber,
  liquidityIndex_: BigNumber,
  beginLiquidityIndex_: BigNumber,
): BigNumber {
  const userCapital = Ray(userCapital_);
  const liquidityIndex = Ray(liquidityIndex_);
  const beginLiquidityIndex = Ray(beginLiquidityIndex_);

  return userCapital
    .rayMul(liquidityIndex)
    .r_sub(userCapital.rayMul(beginLiquidityIndex))
    .r_div(10_000);
}

/**
 * @notice Computes the new daily cost of a cover,
 * the emmission rate is the daily cost of a cover  .
 *
 * @param oldDailyCost_ The daily cost of the cover before the change
 * @param oldPremiumRate_ The premium rate of the cover before the change
 * @param newPremiumRate_ The premium rate of the cover after the change
 *
 * @return The new daily cost of the cover expressed in tokens/day
 */
function getDailyCost(
  oldDailyCost_: BigNumber,
  oldPremiumRate_: BigNumber,
  newPremiumRate_: BigNumber,
): BigNumber {
  return oldDailyCost_.mul(newPremiumRate_).div(oldPremiumRate_);
}

/**
 * @notice Computes the new seconds per tick of a pool,
 * the seconds per tick is the time between two ticks  .
 *
 * @param oldSecondsPerTick_ The seconds per tick before the change
 * @param oldPremiumRate_ The premium rate before the change
 * @param newPremiumRate_ The premium rate after the change
 *
 * @return The new seconds per tick of the pool
 */
function secondsPerTick(
  oldSecondsPerTick_: BigNumber,
  oldPremiumRate_: BigNumber,
  newPremiumRate_: BigNumber,
): BigNumber {
  const oldSecondsPerTick = Ray(oldSecondsPerTick_);
  const oldPremiumRate = Ray(oldPremiumRate_);
  const newPremiumRate = Ray(newPremiumRate_);

  return oldSecondsPerTick.rayMul(oldPremiumRate).rayDiv(newPremiumRate);
}

/**
 * @notice Computes the current premium rate of the pool based on utilization.
 * @param self The pool
 *
 * @return The current premium rate of the pool
 *
 * @dev Not pure since reads self but pure for all practical purposes
 */
function currentPremiumRate(poolData: PoolData): BigNumber {
  const coveredCapital = poolData.slot0.coveredCapital;
  return getPremiumRate(
    poolData,
    utilization(coveredCapital, poolData.totalLiquidity),
  );
}

/**
 * @notice Computes the updated premium rate of the pool based on utilization.
 * @param self The pool
 * @param coveredCapitalToAdd_ The amount of covered capital to add
 * @param coveredCapitalToRemove_ The amount of covered capital to remove
 *
 * @return The updated premium rate of the pool
 */
function updatedPremiumRate(
  poolData: PoolData,
  coveredCapitalToAdd_: BigNumber,
  coveredCapitalToRemove_: BigNumber,
): [BigNumber, BigNumber] {
  const previousPremiumRate = currentPremiumRate(poolData);

  const newPremiumRate = getPremiumRate(
    poolData,
    utilization(
      Ray(poolData.slot0.coveredCapital)
        .r_add(coveredCapitalToAdd_)
        .r_sub(coveredCapitalToRemove_),
      poolData.totalLiquidity,
    ),
  );

  const newSecondsPerTick = secondsPerTick(
    poolData.slot0.secondsPerTick,
    previousPremiumRate,
    newPremiumRate,
  );

  return [newPremiumRate, newSecondsPerTick];
}

/**
 * @notice Computes the percentage of the pool's liquidity used for covers.
 * @param coveredCapital_ The amount of covered capital
 * @param liquidity_ The total amount liquidity
 *
 * @return rate The utilization rate of the pool
 *
 * @dev The utilization rate is capped at 100%.
 */
function utilization(
  coveredCapital_: BigNumber,
  liquidity_: BigNumber,
): BigNumber {
  const coveredCapital = Ray(coveredCapital_);
  const liquidity = Ray(liquidity_);

  // If the pool has no liquidity then the utilization rate is 0
  if (liquidity_.eq(0)) return BigNumber.from(0);

  /**
   * @dev Utilization rate is capped at 100% because in case of overusage the
   * liquidity providers are exposed to the same risk as 100% usage but
   * cover buyers are not fully covered.
   * This means cover buyers only pay for the effective cover they have.
   */
  if (liquidity < coveredCapital) return FULL_CAPACITY;

  // Get a base PERCENTAGE_BASE percentage
  return coveredCapital.r_mul(PERCENTAGE_BASE).rayDiv(liquidity);
}

export const rayMath = {
  constants: {
    RAY,
    halfRAY,
    YEAR,
    MAX_SECONDS_PER_TICK,
    FEE_BASE,
    PERCENTAGE_BASE,
    FULL_CAPACITY,
  },
  Ray,
  getPremiumRate,
  computeLiquidityIndex,
  getCoverRewards,
  getDailyCost,
  secondsPerTick,
  currentPremiumRate,
  updatedPremiumRate,
  utilization,
};
