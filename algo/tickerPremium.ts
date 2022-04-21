const tickers: { time: number; liquidity: number }[] = [];

// const uoptimal = 0.80;
// const slope1 = 0.001;
// const slope2 = 0.2;

const rate = 0.03;

const userG = {
  capital: 10000,
};
let guaranteePool = 10000;

let premiumsLiquidity = 0;

let lastUpdate = 0;

// We add a premium for first user
const usera = {
  premium: 200,
  insured: 10000,
};

//init tickers

const duration = (premium: number, capital: number, rate: number) => {
  // 10000 * 0.03 = 300
  // 1000 = 10000 * 0.03 / (365 * 24 * 60 * 60) * X seconds
  return Math.ceil((premium * (365 * 24 * 60 * 60)) / (capital * rate));
};
const dateNow = parseInt((Date.now() / 1000).toString());
lastUpdate = dateNow;
premiumsLiquidity += usera.premium;
tickers.push(
  ...[
    { time: dateNow, liquidity: usera.premium },
    {
      time: dateNow + duration(usera.premium, usera.insured, rate),
      liquidity: -usera.premium,
    },
  ]
);
console.log("Tickers init : ", tickers);
console.log("Duration S : ", duration(usera.premium, usera.insured, rate));
console.log(
  "Duration D : ",
  duration(usera.premium, usera.insured, rate) / 60 / 60 / 24
);

console.log(
  "Duration Test : ",
  duration(300, usera.insured, rate) / 60 / 60 / 24 / 365
);

console.log("Last update : ", lastUpdate);

const userb = {
  premium: 100,
  capital: 1000,
};

const tickerb1 = dateNow + 1000;
lastUpdate = tickerb1;
const tickerb2 = tickerb1 + duration(userb.premium, userb.capital, rate);
premiumsLiquidity += userb.premium;
tickers.push(
  { time: tickerb1, liquidity: userb.premium },
  { time: tickerb2, liquidity: -userb.premium }
);
// REDUCE TICKER IF EXISTING TICKER TIME
tickers.sort((a, b) => (a.time >= b.time ? 1 : -1));
console.log("Tickers : ", tickers);
console.log("liquidity : ", premiumsLiquidity);
console.log("Last update : ", lastUpdate);

const date = dateNow + 1000 + 21024000;

const liquidityNow = tickers.reduce((acc, cur) => {
  if (cur.time <= date && cur.time > lastUpdate) {
    return acc + cur.liquidity;
  }
  return acc;
}, premiumsLiquidity);

console.log("Liquidity now " + date + " : " + liquidityNow);
