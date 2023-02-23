import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { BigNumber, ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "./helpers/HardhatHelper";
import type { Athena, StakingPolicy, ATEN } from "../typechain";
import ProtocolHelper from "./helpers/ProtocolHelper";

chai.use(chaiAsPromised);

const { toUsdt, toAten } = ProtocolHelper;

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
let policyTaker1: ethers.Signer;
let policyTaker2: ethers.Signer;
let policyTaker3: ethers.Signer;

let ATEN_TOKEN: ATEN;
let ATHENA_CONTRACT: Athena;
let STAKING_POLICY: StakingPolicy;

describe("Cover Refund Staking", function () {
  before(async function () {
    await HardhatHelper.reset();
    const allSigners = await HardhatHelper.allSigners();
    owner = allSigners[0];
    liquidityProvider1 = allSigners[1];
    liquidityProvider2 = allSigners[2];
    policyTaker1 = allSigners[100];
    policyTaker2 = allSigners[101];
    policyTaker3 = allSigners[102];

    await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
    await ProtocolHelper.addNewProtocolPool("Test protocol 0");
    await ProtocolHelper.addNewProtocolPool("Test protocol 1");
    await ProtocolHelper.addNewProtocolPool("Test protocol 2");
    await ProtocolHelper.addNewProtocolPool("Test protocol 3");

    // ================= Get Contracts ================= //

    ATEN_TOKEN = ProtocolHelper.getAtenTokenContract();
    ATHENA_CONTRACT = ProtocolHelper.getAthenaContract();
    STAKING_POLICY = ProtocolHelper.getStakedAtensPolicyContract();

    // ================= Cover Providers ================= //

    const USDT_amount1 = toUsdt(400_000);
    const ATEN_amount1 = toAten(100);
    await ProtocolHelper.deposit(
      liquidityProvider1,
      USDT_amount1,
      ATEN_amount1,
      [0, 1],
      1 * 24 * 60 * 60
    );

    const USDT_amount2 = toUsdt(75_000);
    const ATEN_amount2 = toAten(950_000000);
    await ProtocolHelper.deposit(
      liquidityProvider2,
      USDT_amount2,
      ATEN_amount2,
      [0, 1, 2, 3],
      10 * 24 * 60 * 60
    );

    // ================= Policy Buyers ================= //

    const capital1 = toUsdt(47_500);
    const capital1_2 = toUsdt(25_000);
    const premium1 = toUsdt(10_000);
    const atensLocked1 = toAten(100_000);
    await ProtocolHelper.buyPolicies(
      policyTaker1,
      [capital1, capital1_2],
      [premium1, premium1],
      [atensLocked1, atensLocked1],
      [0, 2],
      10 * 24 * 60 * 60
    );

    const capital2 = toUsdt(2190);
    const premium2 = toUsdt(87);
    const atensLocked2 = toAten(10);
    await ProtocolHelper.buyPolicy(
      policyTaker2,
      capital2,
      premium2,
      atensLocked2,
      0,
      10 * 24 * 60 * 60
    );
  });

  it("Should fail to buy Policy with Atens cause too many ATENS", async function () {
    const oneMillionAten = BigNumber.from(1_000_000).mul(
      BigNumber.from(10).pow(18)
    );

    expect(
      ProtocolHelper.buyPolicy(
        policyTaker3,
        "1000",
        "10",
        oneMillionAten.toString(),
        0,
        0
      )
    ).to.eventually.be.rejectedWith("AmountAtenTooHigh()");
  });

  it("Should buy Policy with Atens", async function () {
    const policy = await ProtocolHelper.buyPolicy(
      policyTaker3,
      "1000",
      "100",
      "10000",
      0,
      0 * 24 * 60 * 60
    );

    expect(policy).to.haveOwnProperty("hash");
  });

  it("Should buy Policy 2 with Atens", async function () {
    const capital = toUsdt(1000);
    const premium = toUsdt(100);
    const atensLocked = toAten(1000);
    const policy = await ProtocolHelper.buyPolicies(
      policyTaker1,
      [capital, capital, capital, capital],
      [premium, premium, premium, premium],
      [atensLocked, 0, atensLocked, 0],
      [0, 1, 2, 3],
      0
    );

    expect(policy).to.haveOwnProperty("hash");
  });

  it("Should check if position has been initialized", async function () {
    const userStakes = await STAKING_POLICY.connect(
      policyTaker1
    ).getRefundPositionsByAccount(await policyTaker1.getAddress());

    userStakes.map((stake) => {
      expect(stake.initTimestamp.toNumber()).to.not.equal(0);
    });
  });

  it("Should reject withdraw of other user's policy rewards", async function () {
    await expect(
      ATHENA_CONTRACT.connect(policyTaker3).withdrawCoverRefundStakedAten(1, 10)
    ).to.eventually.be.rejectedWith("NotPolicyOwner()");
  });

  it("Check rewards after 120 & 240 days", async function () {
    await HardhatHelper.setNextBlockTimestamp(120 * 24 * 60 * 60);

    const rewards = await STAKING_POLICY.connect(
      policyTaker1
    ).positionRefundRewards(0);
    expect(rewards).to.equal("35616504946727549400000");

    await HardhatHelper.setNextBlockTimestamp(120 * 24 * 60 * 60);

    const rewards2 = await STAKING_POLICY.connect(
      policyTaker1
    ).positionRefundRewards(0);

    expect(rewards2.toString()).to.equal("68493217275494672700000");
  });

  it("Should return 2 staking Policy ", async function () {
    const indexUser = await STAKING_POLICY.connect(
      policyTaker1
    ).getRefundPositionsByAccount(await policyTaker1.getAddress());

    expect(indexUser.length).to.equal(4);
  });

  it("Should claim rewards and be capped at amount of staked ATEN", async function () {
    await HardhatHelper.setNextBlockTimestamp(125 * 24 * 60 * 60);

    const balBefore = await ATEN_TOKEN.connect(policyTaker2).balanceOf(
      await policyTaker2.getAddress()
    );

    const txWithdrawAten = await (
      await ATHENA_CONTRACT.connect(policyTaker2).withdrawCoverRefundRewards(2)
    ).wait();
    expect(txWithdrawAten).to.haveOwnProperty("transactionHash");

    const balAfter = await ATEN_TOKEN.connect(policyTaker2).balanceOf(
      await policyTaker2.getAddress()
    );

    expect(balAfter.sub(balBefore).lt(toAten(12))).to.equal(true);
  });
});
