import { expect } from "chai";

const TOKENS_STAKING = 300000000;
const STAKING_REWARD = 30;
const LIQUIDITY_PROVIDER = 10000;
const LIQUIDITY = 10000;
const POLICY = 10000;

describe("Testing financial calculations", () => {
  it("Should return 10", () => {
    expect(10).to.equal(10);
  });
  it("Should return 30% staking reward", () => {
    expect(
      (LIQUIDITY_PROVIDER * (LIQUIDITY / POLICY) * STAKING_REWARD) / 100
    ).to.equal(3000); // ANNUALIZED
  });
  it("Should return 30% staking reward on 1 day", () => {
    const result =
      (LIQUIDITY_PROVIDER * (LIQUIDITY / POLICY) * STAKING_REWARD) / 100 / 365;
    expect(result).to.be.greaterThanOrEqual(8.21);
    expect(result).to.be.lessThanOrEqual(8.22);
  });
});
