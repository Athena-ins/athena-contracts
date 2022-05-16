import { BigNumber } from "ethers";

const RAY = BigNumber.from(10).pow(27);
const halfRAY = RAY.div(2);
function rayMul(a: string, b: string) {
  return halfRAY.add(BigNumber.from(a).mul(b)).div(RAY);
}

const a = rayMul(RAY.mul("7").toString(), RAY.mul("3").toString());
console.log(a.toString());

function rayDiv(a: string, b: string) {
  const halfB = BigNumber.from(b).div(2);

  // return halfB.add(BigNumber.from(a).mul(RAY)).div(b);
  return BigNumber.from(a).mul(RAY).div(b);
}

const b = rayDiv(RAY.mul("12").toString(), RAY.mul("7").toString());
console.log(b.toString());
const c = rayDiv("12", "7");
console.log(c.toString());

console.log(c.mul(5000).div(RAY).toString());

let tu = BigNumber.from(1);
let mau = BigNumber.from(1);
function cumuleRatio(newRate: string | number, oldRate: string | number) {
  tu = tu.mul(newRate);
  mau = mau.mul(oldRate);
}

cumuleRatio(7, 3);
cumuleRatio(1, 7);
cumuleRatio(5, 1);

const so1 = BigNumber.from(10).pow(18).mul(tu).div(mau);
console.log(so1.toString());
const so2 = rayDiv(
  BigNumber.from(10).pow(18).mul(tu).toString(),
  mau.toString()
).div(RAY);
console.log(so2.toString());

console.log(BigNumber.from(10).pow(1).mul(1).div(60).toString());
console.log(rayDiv("10", "60").div(RAY).toString());
