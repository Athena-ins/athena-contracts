import { expect } from "chai";

interface ITicker {
  time: number;
  emissionRate: number;
}

let tickers: ITicker[] = [];

// const uoptimal = 0.80;
// const slope1 = 0.001;
// const slope2 = 0.2;

const rate = 0.03;

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
  date: number
) => {
  const updateTickers = tickers.concat();
  let lastTicker = 0;
  for (let index = 0; index < tickers.length; index++) {
    const element = tickers[index];
    if (element.time <= date) {
      liquidity +=
        lastUpdate === 0
          ? 0
          : premiumEmission *
            (element.time - (index > 0 ? tickers[index - 1].time : lastUpdate));
      premiumEmission += element.emissionRate;
      lastTicker = element.time;
      updateTickers.splice(0, 1);
      continue;
    }
    break;
  }
  liquidity += premiumEmission * (date - (lastTicker || lastUpdate));

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
  const data = updateTickers(
    tickers,
    actualTicker.premiumsLiquidity,
    0,
    actualTicker.lastUpdate,
    date
  );
  console.log("Data ticker rewards : ", data);

  // console.log("REWARDS ? ", actualTicker, tickers, date);

  return share * data.liquidity;
};
// We add a premium for first user
const usera = {
  premium: 300,
  insured: 10000,
};
const dateUserA = secondsToDay(0);

const emissionRateTmp =
  usera.premium / duration(usera.premium, usera.insured, rate);
tickers.push(
  ...[
    { time: dateUserA, emissionRate: emissionRateTmp },
    {
      time: dateUserA + duration(usera.premium, usera.insured, rate),
      emissionRate: -emissionRateTmp,
    },
  ]
);

const data = updateTickers(
  tickers,
  actualTicker.premiumsLiquidity,
  actualTicker.premiumEmission,
  actualTicker.lastUpdate,
  dateUserA
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
console.log("Duration Test : ", duration(300, usera.insured, rate) / 365 === 1);

const dateTest = dateUserA + 10;
console.log("\n 10 days later : " + dateTest + "\n");
console.log("LIQUIDITY : ", getRewards(1, actualTicker, tickers, dateTest));
console.log("Liquidity actual : ", actualTicker.premiumsLiquidity);

console.log("Tickers + 10 ", tickers);

const userb = {
  premium: 100,
  insured: 3000,
};

const tickerb1 = dateUserA + 50;
const tickerb2 = tickerb1 + duration(userb.premium, userb.insured, rate);
const emissionRateTmp2 =
  userb.premium / duration(userb.premium, userb.insured, rate);
tickers.push(
  { time: tickerb1, emissionRate: emissionRateTmp2 },
  { time: tickerb2, emissionRate: -emissionRateTmp2 }
);
// REDUCE TICKER IF EXISTING TICKER TIME
tickers.sort((a, b) => (a.time >= b.time ? 1 : -1));

const data2 = updateTickers(
  tickers,
  actualTicker.premiumsLiquidity,
  actualTicker.premiumEmission,
  actualTicker.lastUpdate,
  tickerb1
);
// WE SET DATA AS IT IS A WRITE ACTION
actualTicker.lastUpdate = data2.lastUpdate;
actualTicker.lastUpdate = tickerb1;
tickers = data2.updateTickers;
actualTicker.premiumsLiquidity = data2.liquidity;
actualTicker.premiumEmission = data2.premiumEmission;
console.log("\nLiquidity now " + tickerb1 + " : " + data2.liquidity);
console.log("Actual ticker now " + tickerb1 + " : ", actualTicker);
console.log("Tickers now " + tickerb1 + " : ", tickers);
console.log("Time remaining until next ticker ", tickers[0].time - tickerb1);

//PUT RATE IN TICKER !
console.log("\nLATER ON -------");
const dateClaim = tickerb1 + 200;

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
console.log("Time remaining until next ticker ", tickers[0].time - dateClaim);
const rewards = getRewards(
  1,
  {
    premiumEmission: actualTicker.premiumEmission,
    premiumsLiquidity: dataClaim.liquidity,
    lastUpdate: actualTicker.lastUpdate,
  },
  tickers,
  dateClaim
);
console.log("Rewards now : ", rewards);

expect(rewards).to.be.greaterThan(100);
expect(rewards).to.be.lessThanOrEqual(300);

const lastDate = tickers[tickers.length - 1].time;
console.log("\n\n Last date : ", lastDate);
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
