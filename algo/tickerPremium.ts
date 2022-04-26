import { expect } from "chai";

interface ITicker {
  time: number;
  emissionRate: number;
}

let tickers: ITicker[] = [];

// const uoptimal = 0.80;
// const slope1 = 0.001;
// const slope2 = 0.2;

const rate = 0.1 * 3.7;

const userG = {
  capital: 10000,
};
let guaranteePool = userG.capital;

let actualTicker = {
  premiumsLiquidity: 0,
  premiumEmission: 0,
  lastUpdate: 0,
};

//convert secondes to days
const secondsToDay = (seconds: number) => {
  return seconds / (60 * 60 * 24);
};
const duration = (premium: number, capital: number, rate: number) => {
  // 10000 * 0.03 = 300
  // 1000 = 10000 * 0.03 / (365) * X days
  return Math.ceil((premium * 365) / (capital * rate));
};
const updateTickers = (
  tickers: ITicker[],
  liquidity: number,
  premiumEmission: number,
  lastUpdate: number,
  date: number,
  newTickers?: ITicker[]
) => {
  let lastTicker = 0;
  const originalEmission = premiumEmission;
  let checked = false;
  if (lastUpdate < tickers[0]?.time && date < tickers[0]?.time) {
    // EXCEPT IF TICKER STOP IN BETWEEN
    liquidity += originalEmission * (date - lastUpdate);
  }
  const updateTickers = tickers.concat();

  if (newTickers) {
    updateTickers.push(...newTickers);
    updateTickers.sort((a, b) => (a.time >= b.time ? 1 : -1));
  }
  let element = tickers[0];
  let index = 0;
  while (element?.time <= date) {
    if (element?.time <= date) {
      //   if (lastUpdate < element.time && !checked) {
      //     checked = true;
      //     liquidity += originalEmission * (date - lastUpdate);
      //     lastUpdate = element.time;
      //   } else {
      liquidity +=
        lastUpdate === 0
          ? 0
          : premiumEmission *
            (element.time - (index > 0 ? tickers[index - 1].time : lastUpdate));
      premiumEmission += element.emissionRate;
      lastTicker = element.time;
      updateTickers.splice(0, 1);
      index++;
      element = tickers[index];
    }
  }

  if (lastTicker < date) {
    liquidity += premiumEmission * (date - lastTicker);
  }

  //   liquidity += premiumEmission * (date - (lastTicker || lastUpdate));

  return {
    updateTickers,
    liquidity,
    premiumEmission: premiumEmission,
    lastUpdate: date,
  };
};
const getRewards = (
  share: number,
  actualTicker: {
    premiumEmission: number;
    lastUpdate: number;
    premiumsLiquidity: number;
  },
  tickers: ITicker[],
  date: number
) => {
  console.log("Data ticker rewards before : ", actualTicker, tickers);
  const data = updateTickers(
    tickers,
    actualTicker.premiumsLiquidity,
    actualTicker.premiumEmission,
    actualTicker.lastUpdate,
    date
  );
  console.log("Data ticker rewards : ", data);

  // console.log("REWARDS ? ", actualTicker, tickers, date);

  return share * data.liquidity;
};
// We add a premium for first user
const usera = {
  premium: 100,
  insured: 10000,
};
const dateUserA = secondsToDay(0);
console.log("------ ADDING USER A ---------");
const emissionRateTmp =
  usera.premium / duration(usera.premium, usera.insured, rate);

const data = updateTickers(
  tickers,
  actualTicker.premiumsLiquidity,
  actualTicker.premiumEmission,
  actualTicker.lastUpdate,
  dateUserA,
  [
    { time: dateUserA, emissionRate: emissionRateTmp },
    {
      time: dateUserA + duration(usera.premium, usera.insured, rate),
      emissionRate: -emissionRateTmp,
    },
  ]
);
// WE SET DATA AS IT IS A WRITE ACTION
actualTicker.lastUpdate = data.lastUpdate;
tickers = data.updateTickers;
actualTicker.premiumsLiquidity = data.liquidity;
actualTicker.premiumEmission = data.premiumEmission;
console.log("Last update / actual ticker : ", actualTicker.lastUpdate);
console.log("Tickers init : ", tickers);
console.log("Liquidity init : ", actualTicker.premiumsLiquidity);
console.log("Emission init : ", actualTicker.premiumEmission);
// console.log("Duration S : ", duration(usera.premium, usera.insured, rate));
console.log("Duration D : ", duration(usera.premium, usera.insured, rate));

const dateTest = dateUserA + 1;
console.log("\n days later : " + dateTest + "\n");
console.log("LIQUIDITY : ", getRewards(1, actualTicker, tickers, dateTest));

/**
 * ADD USER B
 */
console.log("------ ADDING USER B ---------");

const userb = {
  premium: 50,
  insured: 1000,
};

const tickerb1 = dateUserA + 2;
const tickerb2 = tickerb1 + duration(userb.premium, userb.insured, rate);
const emissionRateTmp2 =
  userb.premium / duration(userb.premium, userb.insured, rate);

// REDUCE TICKER IF EXISTING TICKER TIME

const data2 = updateTickers(
  tickers,
  actualTicker.premiumsLiquidity,
  actualTicker.premiumEmission,
  actualTicker.lastUpdate,
  tickerb1,
  [
    { time: tickerb1, emissionRate: emissionRateTmp2 },
    { time: tickerb2, emissionRate: -emissionRateTmp2 },
  ]
);
// WE SET DATA AS IT IS A WRITE ACTION
actualTicker.lastUpdate = data2.lastUpdate;
actualTicker.lastUpdate = tickerb1;
tickers = data2.updateTickers;
actualTicker.premiumsLiquidity = data2.liquidity;
actualTicker.premiumEmission = data2.premiumEmission;

console.log("\nLiquidity now " + tickerb1 + " : ", data2.liquidity);
console.log("Actual ticker now " + tickerb1 + " : ", actualTicker);
console.log("Tickers now " + tickerb1 + " : ", tickers);
console.log("Time remaining until next ticker ", tickers[0]?.time - tickerb1);
console.log("\n--------- 5 DAYS LATER -------");
const dateTest2 = dateUserA + 5;
console.log("\n days later : " + dateTest2 + "\n");
console.log("LIQUIDITY : ", getRewards(1, actualTicker, tickers, dateTest2));

console.log("\n--------- 20 DAYS LATER -------");
const dateTest20 = dateUserA + 20;
console.log("\n days later : " + dateTest20 + "\n");
console.log("LIQUIDITY : ", getRewards(1, actualTicker, tickers, dateTest20));
//PUT RATE IN TICKER !
console.log("\n--------- LATER ON = CLAIM -------");

const dateClaim = dateUserA + 20;

const rewards = getRewards(
  1,
  {
    premiumEmission: actualTicker.premiumEmission,
    premiumsLiquidity: actualTicker.premiumsLiquidity,
    lastUpdate: actualTicker.lastUpdate,
  },
  tickers,
  dateClaim
);
console.log("Rewards now : ", rewards);

const dataClaim = updateTickers(
  tickers,
  actualTicker.premiumsLiquidity,
  actualTicker.premiumEmission,
  actualTicker.lastUpdate,
  dateClaim
);
actualTicker.premiumEmission = dataClaim.premiumEmission;
// WE SET LIQUIDITY TO 0 AS ALREADY CLAIMED
actualTicker.premiumsLiquidity = 0;
tickers = dataClaim.updateTickers;
actualTicker.lastUpdate = dataClaim.lastUpdate;

console.log("\nLiquidity now " + dateClaim + " : " + dataClaim.liquidity);
console.log("Emission now " + dateClaim + " : " + actualTicker.premiumEmission);
console.log("Tickers now " + dateClaim + " : ", tickers);
console.log("Time remaining until next ticker ", tickers[0]?.time - dateClaim);

// expect(rewards).to.be.greaterThanOrEqual(100);
// expect(rewards).to.be.lessThanOrEqual(300);
console.log("\n-------- LAST TICKER DATE ---------");
const lastDate = tickers[tickers.length - 1]?.time;
console.log("Last date : ", lastDate);
console.log("Last data before : ", actualTicker);
const lastRewards = getRewards(
  1,
  {
    premiumEmission: actualTicker.premiumEmission,
    premiumsLiquidity: actualTicker.premiumsLiquidity,
    lastUpdate: actualTicker.lastUpdate,
  },
  tickers,
  lastDate
);
console.log("Last rewards : ", lastRewards, lastRewards + rewards);
// const lastData = updateTickers(
//   tickers,
//   actualTicker.premiumsLiquidity,
//   actualTicker.premiumEmission,
//   actualTicker.lastUpdate,
//   lastDate
// );
// console.log("Last data : ", lastData);
