import chai, { expect } from "chai";
import { ethers } from "hardhat";
import chaiAsPromised from "chai-as-promised";
// Helpers
import { getCurrentTime, setNextBlockTimestamp } from "../helpers/hardhat";
import { toUsdt, toAten } from "../helpers/protocol";
// Types
import { Signer, Contract, BigNumber, BigNumberish } from "ethers";
//
chai.use(chaiAsPromised);

let owner: Signer;
let liquidityProvider1: Signer;
let liquidityProvider2: Signer;
let policyTaker1: Signer;
let policyTaker2: Signer;
let policyTaker3: Signer;

export function testStakingPolicy() {
  describe("Cover Refund Staking", function () {
    before(async function () {
      const allSigners = await ethers.getSigners();
      owner = allSigners[0];
      liquidityProvider1 = allSigners[1];
      liquidityProvider2 = allSigners[2];
      policyTaker1 = allSigners[100];
      policyTaker2 = allSigners[101];
      policyTaker3 = allSigners[102];

      await this.helpers.addNewProtocolPool("Test protocol 0");
      await this.helpers.addNewProtocolPool("Test protocol 1");
      await this.helpers.addNewProtocolPool("Test protocol 2");
      await this.helpers.addNewProtocolPool("Test protocol 3");

      // ================= Cover Providers ================= //

      const USDT_amount1 = toUsdt(400_000);
      const ATEN_amount1 = toAten(100);
      await this.helpers.deposit(
        liquidityProvider1,
        USDT_amount1,
        ATEN_amount1,
        [0, 1],
        1 * 24 * 60 * 60,
      );

      const USDT_amount2 = toUsdt(75_000);
      const ATEN_amount2 = toAten(950_000000);
      await this.helpers.deposit(
        liquidityProvider2,
        USDT_amount2,
        ATEN_amount2,
        [0, 1, 2, 3],
        10 * 24 * 60 * 60,
      );

      // ================= Policy Buyers ================= //

      const capital1 = toUsdt(47_500);
      const capital1_2 = toUsdt(25_000);
      const premium1 = toUsdt(10_000);
      const atensLocked1 = toAten(100_000);
      await this.helpers.buyPolicies(
        policyTaker1,
        [capital1, capital1_2],
        [premium1, premium1],
        [atensLocked1, atensLocked1],
        [0, 2],
        10 * 24 * 60 * 60,
      );

      const capital2 = toUsdt(2190);
      const premium2 = toUsdt(87);
      const atensLocked2 = toAten(10);
      await this.helpers.buyPolicy(
        policyTaker2,
        capital2,
        premium2,
        atensLocked2,
        0,
        10 * 24 * 60 * 60,
      );
    });

    it("Should fail to buy Policy with Atens cause too many ATENS", async function () {
      const oneMillionAten = BigNumber.from(1_000_000).mul(
        BigNumber.from(10).pow(18),
      );

      expect(
        this.helpers.buyPolicy(
          policyTaker3,
          "1000",
          "10",
          oneMillionAten.toString(),
          0,
          0,
        ),
      ).to.eventually.be.rejectedWith("AmountAtenTooHigh()");
    });

    it("Should buy Policy with Atens", async function () {
      const policy = await this.helpers.buyPolicy(
        policyTaker3,
        "1000",
        "100",
        "10000",
        0,
        0 * 24 * 60 * 60,
      );

      expect(policy).to.haveOwnProperty("hash");
    });

    it("Should buy Policy 2 with Atens", async function () {
      const capital = toUsdt(1000);
      const premium = toUsdt(100);
      const atensLocked = toAten(1000);
      const policy = await this.helpers.buyPolicies(
        policyTaker1,
        [capital, capital, capital, capital],
        [premium, premium, premium, premium],
        [atensLocked, 0, atensLocked, 0],
        [0, 1, 2, 3],
        0,
      );

      expect(policy).to.haveOwnProperty("hash");
    });

    it("Should check if position has been initialized", async function () {
      const userStakes = await this.contracts.StakingPolicy.connect(
        policyTaker1,
      ).getRefundPositionsByAccount(await policyTaker1.getAddress());

      userStakes.map((stake) => {
        expect(stake.initTimestamp.toNumber()).to.not.equal(0);
      });
    });

    it("Should reject withdraw of other user's policy rewards", async function () {
      await expect(
        this.contracts.Athena.connect(
          policyTaker3,
        ).withdrawCoverRefundStakedAten(1, 10),
      ).to.eventually.be.rejectedWith("NotPolicyOwner()");
    });

    it("Check rewards after 120 & 240 days", async function () {
      await setNextBlockTimestamp(120 * 24 * 60 * 60);

      const rewards =
        await this.contracts.StakingPolicy.connect(
          policyTaker1,
        ).positionRefundRewards(0);
      expect(rewards).to.equal("35616504946727549400000");

      await setNextBlockTimestamp(120 * 24 * 60 * 60);

      const rewards2 =
        await this.contracts.StakingPolicy.connect(
          policyTaker1,
        ).positionRefundRewards(0);

      expect(rewards2.toString()).to.equal("68493217275494672700000");
    });

    it("Should return 2 staking Policy ", async function () {
      const indexUser = await this.contracts.StakingPolicy.connect(
        policyTaker1,
      ).getRefundPositionsByAccount(await policyTaker1.getAddress());

      expect(indexUser.length).to.equal(4);
    });

    it("Should claim rewards and be capped at amount of staked ATEN", async function () {
      await setNextBlockTimestamp(125 * 24 * 60 * 60);

      const balBefore = await this.contracts.ATEN.connect(
        policyTaker2,
      ).balanceOf(await policyTaker2.getAddress());

      const txWithdrawAten = await (
        await this.contracts.Athena.connect(
          policyTaker2,
        ).withdrawCoverRefundRewards(2)
      ).wait();
      expect(txWithdrawAten).to.haveOwnProperty("transactionHash");

      const balAfter = await this.contracts.ATEN.connect(
        policyTaker2,
      ).balanceOf(await policyTaker2.getAddress());

      expect(balAfter.sub(balBefore).lt(toAten(12))).to.equal(true);
    });
  });
}
