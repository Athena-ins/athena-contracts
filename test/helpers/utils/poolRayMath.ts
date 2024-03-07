import { BigNumber, BigNumberish, utils } from "ethers";

const { parseUnits } = utils;

const RAY = BigNumber.from(10).pow(27); //27 decimal
const halfRAY = RAY.div(2);

const YEAR = BigNumber.from(365 * 86400);
const MAX_SECONDS_PER_TICK = BigNumber.from(86400);
const FEE_BASE = RAY;
const PERCENTAGE_BASE = BigNumber.from(100);
const FULL_CAPACITY = PERCENTAGE_BASE.mul(RAY);
const MAX_UINT256 = BigNumber.from(2).pow(256).sub(1);

export const constants = {
  RAY,
  halfRAY,
  YEAR,
  MAX_SECONDS_PER_TICK,
  FEE_BASE,
  PERCENTAGE_BASE,
  FULL_CAPACITY,
  MAX_UINT256,
};

type Formula = {
  uOptimal: BigNumber;
  r0: BigNumber;
  rSlope1: BigNumber;
  rSlope2: BigNumber;
};

type PoolData = {
  slot0: {
    coveredCapital: BigNumber;
    secondsPerTick: number;
  };
  totalLiquidity: BigNumber;
  formula: Formula;
};

export function toRay(amount: BigNumberish, decimals = 0) {
  // @dev ex: 10_000 = 100% = 4 decimals
  const base = 27 - decimals;
  return parseUnits(amount.toString(), base);
}

export class RayInt {
  value: string;

  constructor(value: RayInt | BigNumberish, scaleToRay = false, decimals = 0) {
    this.value = this._toBn(value).toString();
    if (scaleToRay) this.value = toRay(this.value, decimals).toString();

    Object.freeze(this);
  }

  private _value() {
    return BigNumber.from(this.value);
  }

  private _toBn(value: RayInt | BigNumberish) {
    if (
      value instanceof RayInt ||
      (typeof value === "object" && "value" in value)
    ) {
      return (value as RayInt).toBigNumber();
    } else {
      return BigNumber.from(value);
    }
  }

  private _isRayInt(value: any): boolean {
    return true;
  }

  static from(value: RayInt | BigNumberish, scaleToRay = false) {
    return new RayInt(value, scaleToRay);
  }

  static isRayInt(value: any): value is RayInt {
    return !!(value && value._isRayInt && value._isRayInt());
  }

  toBigNumber() {
    return this._value();
  }

  toString() {
    return this._value().toString();
  }

  toNumber() {
    return this._value().toNumber();
  }

  rayMul(b: RayInt | BigNumberish) {
    const rayValue = RayInt.from(this._value());
    return rayValue.mul(this._toBn(b)).add(halfRAY).div(RAY);
  }

  rayDiv(b: RayInt | BigNumberish) {
    const rayValue = RayInt.from(this._value());
    const numerator = rayValue.mul(RAY).add(this._toBn(b).div(2));
    return numerator.div(this._toBn(b));
  }

  div(b: RayInt | BigNumberish) {
    return RayInt.from(this._value().div(this._toBn(b)));
  }
  mul(b: RayInt | BigNumberish) {
    return RayInt.from(this._value().mul(this._toBn(b)));
  }
  add(b: RayInt | BigNumberish) {
    return RayInt.from(this._value().add(this._toBn(b)));
  }
  sub(b: RayInt | BigNumberish) {
    return RayInt.from(this._value().sub(this._toBn(b)));
  }

  eq(b: RayInt | BigNumberish) {
    return this._value().eq(this._toBn(b));
  }
  lt(b: RayInt | BigNumberish) {
    return this._value().lt(this._toBn(b));
  }
  lte(b: RayInt | BigNumberish) {
    return this._value().lte(this._toBn(b));
  }
  gt(b: RayInt | BigNumberish) {
    return this._value().gt(this._toBn(b));
  }
  gte(b: RayInt | BigNumberish) {
    return this._value().gte(this._toBn(b));
  }
}

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
export function getPremiumRate(
  poolData: PoolData,
  utilizationRate_: RayInt | BigNumberish,
): BigNumber {
  const utilizationRate = RayInt.from(utilizationRate_);

  const formula = {
    uOptimal: RayInt.from(poolData.formula.uOptimal),
    r0: RayInt.from(poolData.formula.r0),
    rSlope1: RayInt.from(poolData.formula.rSlope1),
    rSlope2: RayInt.from(poolData.formula.rSlope2),
  };

  if (utilizationRate.lt(formula.uOptimal)) {
    // Return base rate + proportional slope 1 rate
    return formula.r0
      .add(formula.rSlope1.rayMul(utilizationRate.rayDiv(formula.uOptimal)))
      .toBigNumber();
  } else if (utilizationRate.lt(FULL_CAPACITY)) {
    // Return base rate + slope 1 rate + proportional slope 2 rate
    return formula.r0
      .add(formula.rSlope1)
      .add(
        formula.rSlope2.rayMul(
          utilizationRate
            .sub(formula.uOptimal)
            .rayDiv(FULL_CAPACITY.sub(formula.uOptimal.toBigNumber())),
        ),
      )
      .toBigNumber();
  } else {
    // Return base rate + slope 1 rate + slope 2 rate
    /**
     * @dev Premium rate is capped because in case of overusage the
     * liquidity providers are exposed to the same risk as 100% usage but
     * cover buyers are not fully covered.
     * This means cover buyers only pay for the effective cover they have.
     */
    return formula.r0.add(formula.rSlope1).add(formula.rSlope2).toBigNumber();
  }
}

/**
 * @notice Computes the liquidity index for a given period
 * @param utilizationRate_ The utilization rate
 * @param premiumRate_ The premium rate
 * @param timeSeconds_ The time in seconds
 * @return The liquidity index to add for the given time
 */
export function computeLiquidityIndex(
  utilizationRate_: RayInt | BigNumberish,
  premiumRate_: RayInt | BigNumberish,
  timeSeconds_: RayInt | BigNumberish,
): BigNumber {
  const utilizationRate = RayInt.from(utilizationRate_);
  const premiumRate = RayInt.from(premiumRate_);
  const timeSeconds = RayInt.from(timeSeconds_);

  return utilizationRate
    .rayMul(premiumRate)
    .rayMul(timeSeconds)
    .rayDiv(YEAR)
    .toBigNumber();
}

export function computeTimeFromLiquidityIndex(
  utilizationRate_: RayInt | BigNumberish,
  premiumRate_: RayInt | BigNumberish,
  liquidityIndex_: RayInt | BigNumberish,
): number {
  const liquidityIndex = RayInt.from(liquidityIndex_);
  const utilizationRate = RayInt.from(utilizationRate_);
  const premiumRate = RayInt.from(premiumRate_);

  return liquidityIndex
    .rayMul(YEAR)
    .rayDiv(utilizationRate.rayMul(premiumRate))
    .toNumber();
}

/**
 * @notice Computes the premiums or interests earned by a liquidity position
 * @param userCapital_ The amount of liquidity in the position
 * @param liquidityIndex_ The end liquidity index
 * @param beginLiquidityIndex_ The start liquidity index
 */
export function getCoverRewards(
  userCapital_: RayInt | BigNumberish,
  startLiquidityIndex_: RayInt | BigNumberish,
  endLiquidityIndex_: RayInt | BigNumberish,
): BigNumber {
  const userCapital = RayInt.from(userCapital_);
  const startLiquidityIndex = RayInt.from(startLiquidityIndex_);
  const endLiquidityIndex = RayInt.from(endLiquidityIndex_);

  return userCapital
    .rayMul(endLiquidityIndex)
    .sub(userCapital.rayMul(startLiquidityIndex))
    .div(10_000)
    .toBigNumber();
}

export function currentDailyCost(
  coverSize: RayInt | BigNumberish,
  beginPremiumRate: RayInt | BigNumberish,
  currentPremiumRate: RayInt | BigNumberish,
) {
  const beginDailyCost = RayInt.from(coverSize)
    .rayMul(beginPremiumRate)
    .rayDiv(365);

  return getDailyCost(beginDailyCost, beginPremiumRate, currentPremiumRate);
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
export function getDailyCost(
  oldDailyCost_: RayInt | BigNumberish,
  oldPremiumRate_: RayInt | BigNumberish,
  newPremiumRate_: RayInt | BigNumberish,
): BigNumber {
  return RayInt.from(oldDailyCost_)
    .mul(newPremiumRate_)
    .div(oldPremiumRate_)
    .toBigNumber();
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
export function secondsPerTick(
  oldSecondsPerTick_: RayInt | BigNumberish,
  oldPremiumRate_: RayInt | BigNumberish,
  newPremiumRate_: RayInt | BigNumberish,
): BigNumber {
  const oldSecondsPerTick = RayInt.from(oldSecondsPerTick_);
  const oldPremiumRate = RayInt.from(oldPremiumRate_);
  const newPremiumRate = RayInt.from(newPremiumRate_);

  return oldSecondsPerTick
    .rayMul(oldPremiumRate)
    .rayDiv(newPremiumRate)
    .toBigNumber();
}

/**
 * @notice Computes the current premium rate of the pool based on utilization.
 * @param self The pool
 *
 * @return The current premium rate of the pool
 *
 * @dev Not pure since reads self but pure for all practical purposes
 */
export function currentPremiumRate(poolData: PoolData): BigNumber {
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
export function updatedPremiumRate(
  poolData: PoolData,
  coveredCapitalToAdd_: RayInt | BigNumberish,
  coveredCapitalToRemove_: RayInt | BigNumberish,
): { newPremiumRate: BigNumber; newSecondsPerTick: BigNumber } {
  const previousPremiumRate = currentPremiumRate(poolData);

  const newPremiumRate = getPremiumRate(
    poolData,
    utilization(
      RayInt.from(poolData.slot0.coveredCapital)
        .add(coveredCapitalToAdd_)
        .sub(coveredCapitalToRemove_),
      poolData.totalLiquidity,
    ),
  );

  const newSecondsPerTick = secondsPerTick(
    poolData.slot0.secondsPerTick,
    previousPremiumRate,
    newPremiumRate,
  );

  return { newPremiumRate, newSecondsPerTick };
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
export function utilization(
  coveredCapital_: RayInt | BigNumberish,
  liquidity_: RayInt | BigNumberish,
): BigNumber {
  const coveredCapital = RayInt.from(coveredCapital_);
  const liquidity = RayInt.from(liquidity_);

  // If the pool has no liquidity then the utilization rate is 0
  if (liquidity.eq(0)) return BigNumber.from(0);

  /**
   * @dev Utilization rate is capped at 100% because in case of overusage the
   * liquidity providers are exposed to the same risk as 100% usage but
   * cover buyers are not fully covered.
   * This means cover buyers only pay for the effective cover they have.
   */
  if (liquidity.lt(coveredCapital)) return FULL_CAPACITY;

  // Get a base PERCENTAGE_BASE percentage
  return coveredCapital.mul(PERCENTAGE_BASE).rayDiv(liquidity).toBigNumber();
}

/**
 * @notice Computes rewards given their amount of underlying & start and end reward indexes
 * @param strategyId_ The ID of the strategy
 * @param amount_ The amount of underlying tokens
 * @param startRewardIndex_ The reward index at the time of deposit
 * @param endRewardIndex_ The reward index at the time of withdrawal
 * @return uint256 The amount of rewards in underlying tokens
 */
export function computeReward(
  amount: BigNumber,
  startRewardIndex: BigNumber,
  endRewardIndex: BigNumber,
) {
  return RayInt.from(amount)
    .rayMul(endRewardIndex)
    .rayDiv(startRewardIndex)
    .sub(amount)
    .toBigNumber();
}
