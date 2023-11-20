import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "ethers";

import HardhatHelper from "../helpers/HardhatHelper";
import ProtocolHelper from "../helpers/ProtocolHelper";
import { StakingPolicy } from "../../typechain";

chai.use(chaiAsPromised);

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let policyTaker1: ethers.Signer;

let STAKING_POLICY: StakingPolicy;

export function testThaoPremiumLeftError() {
  describe("Staking Policy Rewards", function () {
    before(async function () {
      const allSigners = await HardhatHelper.allSigners();
      owner = allSigners[0];
      liquidityProvider1 = allSigners[1];
      policyTaker1 = allSigners[100];

      await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
      await ProtocolHelper.addNewProtocolPool("Test protocol 0");
      await ProtocolHelper.addNewProtocolPool("Test protocol 1");

      // ================= Get Contracts ================= //

      STAKING_POLICY = ProtocolHelper.getStakedAtensPolicyContract();

      // ================= Cover Providers ================= //

      const USDT_amount1 = "40000000000";
      const ATEN_amount1 = "100";
      await ProtocolHelper.deposit(
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
      await ProtocolHelper.buyPolicies(
        policyTaker1,
        [capital1, capital1],
        [premium1, premium1],
        [atensLocked1, atensLocked1],
        [0, 0],
        0 * 24 * 60 * 60,
      );
    });

    it("Should return remaining lock time ", async function () {
      const userStakes = await STAKING_POLICY.connect(
        policyTaker1,
      ).getRefundPositionsByAccount(await policyTaker1.getAddress());

      expect(userStakes[1].initTimestamp.toNumber()).to.not.equal(0);
    });
  });
}
