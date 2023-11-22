import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "ethers";

import { getCurrentTime, setNextBlockTimestamp } from "../helpers/hardhat";
import ProtocolHelper from "../helpers/protocol";
import type { StakingPolicy } from "../../typechain";

chai.use(chaiAsPromised);

const { toUsdt, toAten } = ProtocolHelper;

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
let policyTaker1: ethers.Signer;
let policyTaker2: ethers.Signer;

let STAKING_POLICY: StakingPolicy;

export function testUpdateCover() {
  describe("Update User Cover", function () {
    before(async function () {
      const allSigners = await ethers.getSigners();
      owner = allSigners[0];
      liquidityProvider1 = allSigners[1];
      liquidityProvider2 = allSigners[2];
      policyTaker1 = allSigners[100];
      policyTaker2 = allSigners[101];

      await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
      await ProtocolHelper.addNewProtocolPool("Test protocol 0");
      await ProtocolHelper.addNewProtocolPool("Test protocol 1");
      await ProtocolHelper.addNewProtocolPool("Test protocol 2");
      await ProtocolHelper.addNewProtocolPool("Test protocol 3");

      // ================= Get Contracts ================= //

      STAKING_POLICY = ProtocolHelper.getStakedAtensPolicyContract();

      // ================= Cover Providers ================= //

      const USDT_amount1 = toUsdt(400_000);
      const ATEN_amount1 = toAten(100);
      await ProtocolHelper.deposit(
        liquidityProvider1,
        USDT_amount1,
        ATEN_amount1,
        [0, 1],
        1 * 24 * 60 * 60,
      );

      const USDT_amount2 = toUsdt(75_000);
      const ATEN_amount2 = toAten(950_000000);
      await ProtocolHelper.deposit(
        liquidityProvider2,
        USDT_amount2,
        ATEN_amount2,
        [0, 1, 2, 3],
        10 * 24 * 60 * 60,
      );

      // ================= Policy Buyers ================= //

      const capital1 = toUsdt(35_000);
      const capital1_2 = toUsdt(25_000);
      const premium1 = toUsdt(10_000);
      const atensLocked1 = toAten(100_000);
      await ProtocolHelper.buyPolicies(
        policyTaker1,
        [capital1, capital1_2],
        [premium1, premium1],
        [atensLocked1, atensLocked1],
        [0, 2],
        10 * 24 * 60 * 60,
      );
      // 50 000 000000
      // 49 690 000000
      // 475 000 000000
      const capital2 = toUsdt(2_190);
      const premium2 = toUsdt(87);
      const atensLocked2 = toAten(100);
      await ProtocolHelper.buyPolicy(
        policyTaker2,
        capital2,
        premium2,
        atensLocked2,
        0,
        10 * 24 * 60 * 60,
      );
    });

    it("Should increase the amount of capital covered", async function () {
      const userCoverBefore = (
        await ProtocolHelper.getAllUserCovers(policyTaker1)
      )[0];

      const amount = toUsdt(35_000);
      await ProtocolHelper.updateCover(
        policyTaker1,
        "increaseCover",
        userCoverBefore.coverId,
        amount,
      );

      const userCoverAfter = (
        await ProtocolHelper.getAllUserCovers(policyTaker1)
      )[0];

      expect(userCoverBefore.amountCovered.add(amount)).to.equal(
        userCoverAfter.amountCovered,
      );
      expect(
        userCoverBefore.dailyCost.mul(2).lt(userCoverAfter.dailyCost),
      ).to.equal(true);
    });

    it("Should decrease the amount of capital covered", async function () {
      // ===== policy taker 1 ===== //
      const user1CoverBefore = (
        await ProtocolHelper.getAllUserCovers(policyTaker1)
      )[0];

      const amount1 = toUsdt(10_000);
      await ProtocolHelper.updateCover(
        policyTaker1,
        "decreaseCover",
        user1CoverBefore.coverId,
        amount1,
      );

      const user1CoverAfter = (
        await ProtocolHelper.getAllUserCovers(policyTaker1)
      )[0];

      expect(user1CoverBefore.amountCovered.sub(amount1)).to.equal(
        user1CoverAfter.amountCovered,
      );
      expect(user1CoverAfter.dailyCost.lt(user1CoverBefore.dailyCost)).to.equal(
        true,
      );

      // ===== policy taker 2 ===== //

      const user2CoverBefore = (
        await ProtocolHelper.getAllUserCovers(policyTaker2)
      )[0];

      const amount2 = toUsdt(1_000);
      await ProtocolHelper.updateCover(
        policyTaker2,
        "decreaseCover",
        user2CoverBefore.coverId,
        amount2,
      );

      const user2CoverAfter = (
        await ProtocolHelper.getAllUserCovers(policyTaker2)
      )[0];

      expect(user2CoverBefore.amountCovered.sub(amount2)).to.equal(
        user2CoverAfter.amountCovered,
      );
      expect(user2CoverAfter.dailyCost.lt(user2CoverBefore.dailyCost)).to.equal(
        true,
      );
    });

    it("Should add premiums to the cover", async function () {
      const user2CoverBefore = (
        await ProtocolHelper.getAllUserCovers(policyTaker2)
      )[0];
      const balanceBefore = await this.helpers.getUsdt(
        await policyTaker2.getAddress(),
      );

      const amount2 = toUsdt(100);
      await ProtocolHelper.updateCover(
        policyTaker2,
        "addPremiums",
        user2CoverBefore.coverId,
        amount2,
      );

      const user2CoverAfter = (
        await ProtocolHelper.getAllUserCovers(policyTaker2)
      )[0];
      const balanceAfter = await this.helpers.getUsdt(
        await policyTaker2.getAddress(),
      );

      expect(balanceBefore.sub(amount2)).to.equal(balanceAfter);
      // We add a 1% tolerance for the premium spent during the tx
      expect(
        user2CoverAfter.premiumLeft
          .mul(101)
          .div(100)
          .gt(user2CoverBefore.premiumLeft.add(amount2)),
      ).to.equal(true);
      expect(
        user2CoverBefore.remainingDuration
          .mul(2)
          .lt(user2CoverAfter.remainingDuration),
      ).to.equal(true);
    });

    it("Should remove premiums from the cover", async function () {
      const userAddress = await policyTaker1.getAddress();
      const user1CoverBefore = (
        await ProtocolHelper.getAllUserCovers(policyTaker1)
      )[1];

      const balanceBefore = await this.contracts.USDT.balanceOf(userAddress);

      const amount1 = toUsdt(5_000);
      await ProtocolHelper.updateCover(
        policyTaker1,
        "removePremiums",
        user1CoverBefore.coverId,
        amount1,
      );

      const user1CoverAfter = (
        await ProtocolHelper.getAllUserCovers(policyTaker1)
      )[1];
      const balanceAfter = await this.contracts.USDT.balanceOf(userAddress);

      expect(balanceBefore.add(amount1)).to.equal(balanceAfter);
      expect(
        user1CoverAfter.premiumLeft.lt(
          user1CoverBefore.premiumLeft.sub(amount1),
        ),
      ).to.equal(true);
      expect(
        user1CoverAfter.remainingDuration
          .div(2)
          .lt(user1CoverBefore.remainingDuration),
      ).to.equal(true);
    });

    it("Should add ATEN to the cover refund staking", async function () {
      const user2CoverId0 = await ProtocolHelper.getAccountCoverIdByIndex(
        policyTaker2,
        0,
      );
      const user2RefundBefore =
        await STAKING_POLICY.getRefundPosition(user2CoverId0);
      const balanceBefore = await this.contracts.ATEN.balanceOf(
        await policyTaker2.getAddress(),
      );

      const amount2 = toAten(200);
      await ProtocolHelper.updateCover(
        policyTaker2,
        "addToCoverRefundStake",
        user2CoverId0,
        amount2,
      );

      const user2RefundAfter =
        await STAKING_POLICY.getRefundPosition(user2CoverId0);
      const balanceAfter = await this.contracts.ATEN.balanceOf(
        await policyTaker2.getAddress(),
      );

      // We apply a 1% tolerance for the token fees
      expect(
        balanceBefore.gt(balanceAfter.add(amount2.mul(99).div(100))),
      ).to.equal(true);
      expect(user2RefundBefore.stakedAmount.add(amount2)).to.equal(
        user2RefundAfter.stakedAmount,
      );
      expect(
        user2RefundAfter.rewardsSinceTimestamp.gt(
          user2RefundBefore.rewardsSinceTimestamp,
        ),
      ).to.equal(true);
      expect(
        user2RefundAfter.earnedRewards.gt(user2RefundBefore.earnedRewards),
      ).to.equal(true);
    });

    it("Should remove ATEN from the cover refund staking", async function () {
      const userAddress = await policyTaker1.getAddress();
      const user1CoverId0 = await ProtocolHelper.getAccountCoverIdByIndex(
        policyTaker1,
        0,
      );
      const user1RefundBefore =
        await STAKING_POLICY.getRefundPosition(user1CoverId0);

      const balanceBefore = await this.contracts.ATEN.balanceOf(userAddress);

      const amount1 = toAten(30_000);
      await ProtocolHelper.updateCover(
        policyTaker1,
        "withdrawCoverRefundStakedAten",
        user1CoverId0,
        amount1,
      );

      const user1RefundAfter =
        await STAKING_POLICY.getRefundPosition(user1CoverId0);
      const balanceAfter = await this.contracts.ATEN.balanceOf(userAddress);

      expect(user1RefundBefore.stakedAmount.sub(amount1)).to.equal(
        user1RefundAfter.stakedAmount,
      );
      expect(
        user1RefundAfter.rewardsSinceTimestamp.gt(
          user1RefundBefore.rewardsSinceTimestamp,
        ),
      ).to.equal(true);
      expect(
        user1RefundAfter.earnedRewards.gt(user1RefundBefore.earnedRewards),
      ).to.equal(true);
      // We apply a 1% tolerance for the token fees
      expect(
        balanceAfter.gt(balanceBefore.add(amount1.mul(99).div(100))),
      ).to.equal(true);
    });
  });
}
