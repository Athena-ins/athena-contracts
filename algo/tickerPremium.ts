interface ITicker {
  time: number;
  liquidity: number;
}

let tickers: ITicker[] = [];

// const uoptimal = 0.80;
// const slope1 = 0.001;
// const slope2 = 0.2;

const rate = 0.03;

const userG = {
  capital: 10000,
};
let guaranteePool = 10000;

let premiumsLiquidity = 0;

let actualTicker = 0;

// We add a premium for first user
const usera = {
  premium: 200,
  insured: 10000,
};
//convert secondes to days
const secondsToDay = (seconds: number) => {
  return Math.ceil(seconds / (60 * 60 * 24));
};
const duration = (premium: number, capital: number, rate: number) => {
  // 10000 * 0.03 = 300
  // 1000 = 10000 * 0.03 / (365) * X days
  return Math.ceil((premium * 365) / (capital * rate));
};
const updateTickers = (tickers: ITicker[], liquidity: number, date: number) => {
  const originalTickers = tickers.concat();
  for (let index = 0; index < originalTickers.length; index++) {
    const element = originalTickers[index];
    if (element.time <= date) {
      liquidity += element.liquidity;
      tickers.splice(0, 1);
      continue;
    }
    break;
  }
  return { tickers, liquidity };
};
const availablePremiums = () => {
  return premiumsLiquidity;
};
const dateNow = secondsToDay(parseInt((Date.now() / 1000).toString()));
actualTicker = dateNow;
tickers.push(
  ...[
    { time: dateNow, liquidity: usera.premium },
    {
      time: dateNow + duration(usera.premium, usera.insured, rate),
      liquidity: -usera.premium,
    },
  ]
);

const data = updateTickers(tickers, premiumsLiquidity, dateNow);
tickers = data.tickers;
premiumsLiquidity = data.liquidity;
console.log("Tickers init : ", tickers);
console.log("Liquidity init : ", premiumsLiquidity);
// console.log("Duration S : ", duration(usera.premium, usera.insured, rate));
console.log("Duration D : ", duration(usera.premium, usera.insured, rate));

console.log("Duration Test : ", duration(300, usera.insured, rate) / 365 === 1);

console.log("Last update / actual ticker : ", actualTicker);

const userb = {
  premium: 100,
  capital: 1000,
};

const tickerb1 = dateNow + 10;
const tickerb2 = tickerb1 + duration(userb.premium, userb.capital, rate);
tickers.push(
  { time: tickerb1, liquidity: userb.premium },
  { time: tickerb2, liquidity: -userb.premium }
);
// REDUCE TICKER IF EXISTING TICKER TIME
tickers.sort((a, b) => (a.time >= b.time ? 1 : -1));
actualTicker = tickerb1;
console.log("Tickers : ", tickers);
console.log("liquidity : ", premiumsLiquidity);
console.log("Last update : ", actualTicker);

const date = dateNow + 400;
actualTicker = date;

const data2 = updateTickers(tickers, premiumsLiquidity, date);

tickers = data2.tickers;
premiumsLiquidity = data2.liquidity;

const getRewards = (
  share: number,
  currentLiquidity: number,
  tickers: ITicker[],
  date: number
) => {
  return Math.floor(
    (share * currentLiquidity * (actualTicker - (tickers[0].time - date))) / 365
  );
};
//PUT RATE IN TICKER !
console.log("\nLiquidity now " + date + " : " + premiumsLiquidity);
console.log("Tickers now " + date + " : ", tickers);
console.log(
  "Time remaining until next ticker ",
  secondsToDay(tickers[0].time - date)
);
console.log("Rewards now : ", getRewards(1, premiumsLiquidity, tickers, date));
