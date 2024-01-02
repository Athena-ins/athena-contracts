import chai, { expect } from "chai";
import { ethers } from "hardhat";
import chaiAsPromised from "chai-as-promised";
// Helpers
import { getCurrentTime, setNextBlockTimestamp } from "../helpers/hardhat";
// Types
import { Signer, Contract, BigNumber, BigNumberish } from "ethers";
//
chai.use(chaiAsPromised);

let owner: Signer;
let liquidityProvider1: Signer;
let policyTaker1: Signer;

export function testThaoPremiumLeftError() {
  describe("Staking Policy Rewards", function () {
    before(async function () {
      const allSigners = await ethers.getSigners();
      owner = allSigners[0];
      liquidityProvider1 = allSigners[1];
      policyTaker1 = allSigners[100];

      await this.helpers.addNewProtocolPool("Test protocol 0");
      await this.helpers.addNewProtocolPool("Test protocol 1");

      // ================= Cover Providers ================= //

      const USDT_amount1 = "40000000000";
      const ATEN_amount1 = "100";
      await this.helpers.deposit(
        liquidityProvider1,
        USDT_amount1,
        ATEN_amount1,
        [0, 1],
        0 * 24 * 60 * 60,
      );

      // ================= Policy Buyers ================= //

      const capital1 = "10950000000";
      const premium1 = "21900000000";
      const atensLocked1 = "500";
      await this.helpers.buyPolicies(
        policyTaker1,
        [capital1, capital1],
        [premium1, premium1],
        [atensLocked1, atensLocked1],
        [0, 0],
        0 * 24 * 60 * 60,
      );
    });

    it("Should return remaining lock time ", async function () {
      const userStakes = await this.contracts.StakingPolicy.connect(
        policyTaker1,
      ).getRefundPositionsByAccount(await policyTaker1.getAddress());

      expect(userStakes[1].initTimestamp.toNumber()).to.not.equal(0);
    });
  });
}
