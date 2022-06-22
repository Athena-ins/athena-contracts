import { BigNumber, BigNumberish } from "ethers";

const bn = (n: BigNumberish) => BigNumber.from(n);

const RAY = bn(10).pow(27);
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

type Slot0 = {
  tick: BigNumber;
  premiumRate: BigNumber;
  emissionRate: BigNumber;
  hoursPerTick: BigNumber;
  totalInsuredCapital: BigNumber;
  availableCapital: BigNumber;
  lastUpdateTimestamp: BigNumber;
};

type Formula = {
  uOptimal: BigNumber;
  r0: BigNumber;
  rSlope1: BigNumber;
  rSlope2: BigNumber;
};

let timeStamp: BigNumber = bn(1646220000);

const slot0: Slot0 = {
  tick: bn(0),
  premiumRate: ray(1),
  emissionRate: ray(0),
  hoursPerTick: ray(24),
  totalInsuredCapital: ray(0),
  availableCapital: ray(0),
  lastUpdateTimestamp: bn(0),
};

function getSlot0Info() {
  const info = {
    tick: slot0.tick.toString(),
    premiumRate: slot0.premiumRate.toString(),
    emissionRate: slot0.emissionRate.toString(),
    hoursPerTick: slot0.hoursPerTick.toString(),
    totalInsuredCapital: slot0.totalInsuredCapital.toString(),
    availableCapital: slot0.availableCapital.toString(),
    lastUpdateTimestamp: slot0.lastUpdateTimestamp.toString(),
  };

  return info;
}

const f: Formula = {
  uOptimal: ray(75),
  r0: ray(1),
  rSlope1: ray(5),
  rSlope2: ray(11).div(10),
};

function getUtilisationRate(
  _isAdded: boolean,
  _insuredCapital: BigNumberish,
  _totalInsuredCapital: BigNumberish,
  _availableCapital: BigNumberish
) {
  if (_availableCapital == 0) {
    return ray(0);
  }
  return _isAdded
    ? rayDiv(
        bn(_totalInsuredCapital).add(_insuredCapital).mul(100),
        _availableCapital
      )
    : rayDiv(
        bn(_totalInsuredCapital).sub(_insuredCapital).mul(100),
        _availableCapital
      );
}

function getPremiumRate(_utilisationRate: BigNumber) {
  if (_utilisationRate.lt(f.uOptimal)) {
    return f.r0.add(rayMul(f.rSlope1, rayDiv(_utilisationRate, f.uOptimal)));
  }
}

function getEmissionRate(
  _oldEmissionRate: BigNumberish,
  _oldPremiumRate: BigNumberish,
  _newPremiumRate: BigNumberish
) {
  return rayDiv(rayMul(_oldEmissionRate, _newPremiumRate), _oldPremiumRate);
}

function getDurationHourUnit(
  _premium: BigNumberish,
  _insuredCapital: BigNumberish,
  _premiumRate: BigNumberish
) {
  //876000000000000000000000000000000 = 24 * 100 * 365 * RayMath.RAY
  return rayDiv(
    rayDiv(
      rayMul(_premium, "876000000000000000000000000000000"),
      _insuredCapital
    ),
    _premiumRate
  );
}

function getHoursPerTick(
  _oldHourPerTick: BigNumberish,
  _oldPremiumRate: BigNumberish,
  _newPremiumRate: BigNumberish
) {
  return rayDiv(rayMul(_oldHourPerTick, _oldPremiumRate), _newPremiumRate);
}

/****after 5 days, LP1 deposit****/
timeStamp = timeStamp.add(5 * 24 * 60 * 60);
slot0.availableCapital = slot0.availableCapital.add(ray("400000"));
slot0.lastUpdateTimestamp = timeStamp;
console.log("after 5 days, LP1 deposit:\n", getSlot0Info(), "\n");

/****after 10 days, LP2 deposit****/
timeStamp = timeStamp.add(10 * 24 * 60 * 60);
slot0.availableCapital = slot0.availableCapital.add(ray("330000"));
slot0.lastUpdateTimestamp = timeStamp;
console.log("after 10 days, LP2 deposit:\n", getSlot0Info(), "\n");

/****after 20 days, PT1 buyPolicy****/
const insuredCapital1 = ray(109500);
const premium1 = ray(2190);

const newPremiumRate1 = getPremiumRate(
  getUtilisationRate(
    true,
    insuredCapital1,
    slot0.totalInsuredCapital,
    slot0.availableCapital
  )
);

const newHoursPerTick1 = getHoursPerTick(
  slot0.hoursPerTick,
  slot0.premiumRate,
  newPremiumRate1!
);

const newEmissionRate1 = getEmissionRate(
  slot0.emissionRate,
  slot0.premiumRate,
  newPremiumRate1!
);

const durationHourUnit1 = getDurationHourUnit(
  premium1,
  insuredCapital1,
  newPremiumRate1!
);

const addingEmissionRate1 = rayDiv(
  rayMul(premium1, "24000000000000000000000000000"),
  durationHourUnit1
);

timeStamp = timeStamp.add(20 * 24 * 60 * 60);

slot0.premiumRate = newPremiumRate1!;
slot0.emissionRate = newEmissionRate1.add(addingEmissionRate1);
slot0.hoursPerTick = newHoursPerTick1;
slot0.totalInsuredCapital = slot0.totalInsuredCapital.add(insuredCapital1);
slot0.availableCapital = slot0.availableCapital.add(0);
slot0.lastUpdateTimestamp = timeStamp;

console.log("after 20 days, PT1 buyPolicy:\n", getSlot0Info(), "\n");

/****after 10 days****/
//availableCapital grown
timeStamp = timeStamp.add(10 * 24 * 60 * 60);
slot0.availableCapital = slot0.availableCapital.add(ray(6 * 10));
slot0.lastUpdateTimestamp = timeStamp;
console.log("after 10 days, availableCapital grown:\n", getSlot0Info(), "\n");

//PT2 buyPolicy
const insuredCapital2 = ray(219000);
const premium2 = ray(8760);
const newPremiumRate2 = getPremiumRate(
  getUtilisationRate(
    true,
    insuredCapital2,
    slot0.totalInsuredCapital,
    slot0.availableCapital
  )
);

const newHoursPerTick2 = getHoursPerTick(
  slot0.hoursPerTick,
  slot0.premiumRate,
  newPremiumRate2!
);

const newEmissionRate2 = getEmissionRate(
  slot0.emissionRate,
  slot0.premiumRate,
  newPremiumRate2!
);

const durationHourUnit2 = getDurationHourUnit(
  premium2,
  insuredCapital2,
  newPremiumRate2!
);

const addingEmissionRate2 = rayDiv(
  rayMul(premium2, "24000000000000000000000000000"),
  durationHourUnit2
);

slot0.premiumRate = newPremiumRate2!;
slot0.emissionRate = newEmissionRate2.add(addingEmissionRate2);
slot0.hoursPerTick = newHoursPerTick2;
slot0.totalInsuredCapital = slot0.totalInsuredCapital.add(insuredCapital2);
slot0.availableCapital = slot0.availableCapital.add(0);
slot0.lastUpdateTimestamp = timeStamp;

console.log("at the same time, PT2 buyPolicy:\n", getSlot0Info(), "\n");
