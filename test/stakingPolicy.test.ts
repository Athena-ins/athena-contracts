import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { BigNumber, ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "./helpers/HardhatHelper";
import type {
  typeAthena,
  typeStakingPolicy,
  typeATEN,
} from "./helpers/TypedContracts";
import ProtocolHelper from "./helpers/ProtocolHelper";

chai.use(chaiAsPromised);

const BN = (num: string | number) => hre_ethers.BigNumber.from(num);

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
let liquidityProvider3: ethers.Signer;
let policyTaker1: ethers.Signer;
let policyTaker2: ethers.Signer;
let policyTaker3: ethers.Signer;

let ATEN: typeATEN;
let ATHENA_CONTRACT: typeAthena;
let STAKING_POLICY: typeStakingPolicy;

describe("Staking Policy Rewards", function () {
  before(async function () {
    await HardhatHelper.reset();
    const allSigners = await HardhatHelper.allSigners();
    owner = allSigners[0];
    liquidityProvider1 = allSigners[1];
    liquidityProvider2 = allSigners[2];
    liquidityProvider3 = allSigners[3];
    policyTaker1 = allSigners[100];
    policyTaker2 = allSigners[101];
    policyTaker3 = allSigners[102];

    await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
    await ProtocolHelper.addNewProtocolPool("Test protocol 0");
    await ProtocolHelper.addNewProtocolPool("Test protocol 1");
    await ProtocolHelper.addNewProtocolPool("Test protocol 2");
    await ProtocolHelper.addNewProtocolPool("Test protocol 3");

    // ================= Get Contracts ================= //

    ATEN = ProtocolHelper.getAtenTokenContract();
    ATHENA_CONTRACT = ProtocolHelper.getAthenaContract();
    STAKING_POLICY = ProtocolHelper.getStakedAtensPolicyContract();

    // ================= Cover Providers ================= //

    const USDT_amount1 = "4000000";
    const ATEN_amount1 = "100";
    await ProtocolHelper.deposit(
      liquidityProvider1,
      USDT_amount1,
      ATEN_amount1,
      [0, 2],
      1 * 24 * 60 * 60
    );

    const USDT_amount2 = "330";
    const ATEN_amount2 = "9000000";
    await ProtocolHelper.deposit(
      liquidityProvider2,
      USDT_amount2,
      ATEN_amount2,
      [0, 1, 2],
      1 * 24 * 60 * 60
    );

    const USDT_amount3 = "36500";
    const ATEN_amount3 = "9000";
    await ProtocolHelper.deposit(
      liquidityProvider3,
      USDT_amount3,
      ATEN_amount3,
      [1, 3],
      1 * 24 * 60 * 60
    );

    // ================= Policy Buyers ================= //

    const capital1 = "109500";
    const capital1_2 = "140";
    const premium1 = "2190";
    const atensLocked1 = "500";
    await ProtocolHelper.buyPolicies(
      policyTaker1,
      [capital1, capital1_2],
      [premium1, premium1],
      [atensLocked1, atensLocked1],
      [0, 3],
      20 * 24 * 60 * 60
    );

    const capital2 = "219000";
    const premium2 = "8760";
    const atensLocked2 = "30000";
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
      3
    );

    expect(policy).to.haveOwnProperty("hash");
  });

  it("Should buy Policy 2 with Atens", async function () {
    const policy = await ProtocolHelper.buyPolicy(
      policyTaker1,
      "1000",
      "100",
      "6000",
      1,
      3
    );

    expect(policy).to.haveOwnProperty("hash");
  });

  it("Should return remaining lock time ", async function () {
    const userStakes = await STAKING_POLICY.connect(
      policyTaker1
    ).allAccountStakingPositions(await policyTaker1.getAddress());

    expect(userStakes[1].timestamp.toNumber()).to.not.equal(0);
  });

  it("Should reject withdraw of other user's policy rewards", async function () {
    await expect(
      ATHENA_CONTRACT.connect(policyTaker3).withdrawAtensPolicy(1)
    ).to.eventually.be.rejectedWith("NotPolicyOwner()");
  });

  it("Should reject withdrawal before 1 year lock time", async function () {
    await expect(
      ATHENA_CONTRACT.connect(policyTaker1).withdrawAtensPolicy(0)
    ).to.eventually.be.rejectedWith("SP: year has not elapsed");
  });

  it("Expect 12 months rewards for 100% APR", async function () {
    const rewards = await STAKING_POLICY.connect(
      policyTaker1
    ).positionRefundRewards(0);
    expect(rewards.toNumber()).to.equal(13);

    await HardhatHelper.setNextBlockTimestamp(60 * 60 * 24 * 365 + 10);

    const rewards2 = await STAKING_POLICY.connect(
      policyTaker1
    ).positionRefundRewards(0);

    expect(rewards2.toString()).to.equal("500");
  });

  it("Should return 2 staking Policy ", async function () {
    const indexUser = await STAKING_POLICY.connect(
      policyTaker1
    ).allAccountStakingPositions(await policyTaker1.getAddress());

    expect(indexUser.length).to.equal(3);
  });

  it("Should unlock ATENS and withdraw after 1 year", async function () {
    const balBefore = await ATEN.connect(policyTaker1).balanceOf(
      await policyTaker1.getAddress()
    );

    const txWithdrawAten = await (
      await ATHENA_CONTRACT.connect(policyTaker1).withdrawAtensPolicy(0)
    ).wait();
    expect(txWithdrawAten).to.haveOwnProperty("transactionHash");

    const balAfter = await ATEN.connect(policyTaker1).balanceOf(
      await policyTaker1.getAddress()
    );

    // 1000 = 500 staked + 500 rewards
    expect(balAfter.sub(balBefore).toString()).to.equal("1000");
  });
});
