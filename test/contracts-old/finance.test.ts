import chai, { expect } from "chai";
import { ethers } from "hardhat";
import chaiAsPromised from "chai-as-promised";
// Helpers
import { getCurrentTime, setNextBlockTimestamp } from "../helpers/hardhat";
// Types
import { Signer, Contract, BigNumber, BigNumberish } from "ethers";
//
chai.use(chaiAsPromised);

const TOKENS_STAKING = 300000000;
const STAKING_REWARD = 30;
const LIQUIDITY_PROVIDER = 10000;
const LIQUIDITY = 10000;
const POLICY = 10000;

export function testFinance() {
  describe("Testing financial calculations", function () {
    it("Should return 10", function () {
      expect(10).to.equal(10);
    });
    it("Should return 30% staking reward", function () {
      expect(
        (LIQUIDITY_PROVIDER * (LIQUIDITY / POLICY) * STAKING_REWARD) / 100,
      ).to.equal(3000); // ANNUALIZED
    });
    it("Should return 30% staking reward on 1 day", function () {
      const result =
        (LIQUIDITY_PROVIDER * (LIQUIDITY / POLICY) * STAKING_REWARD) /
        100 /
        365;
      expect(result).to.be.greaterThanOrEqual(8.21);
      expect(result).to.be.lessThanOrEqual(8.22);
    });
  });
}
