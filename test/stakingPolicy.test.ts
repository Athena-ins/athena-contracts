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

    // ================= Cover Providers ================= //

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
    await expect(
      ATHENA_CONTRACT.connect(policyTaker1).buyPolicies(
        [1000],
        [100],
        [20000],
        [0]
      )
    ).to.eventually.be.rejectedWith("Too many ATENS");
  });

  it("Should buy Policy with Atens", async function () {
    const policy = await ATHENA_CONTRACT.connect(policyTaker1).buyPolicies(
      [1000],
      [100],
      [10000],
      [0]
    );
    await policy.wait();
    expect(policy).to.haveOwnProperty("hash");
  });

  it("Should buy Policy 2 with Atens", async function () {
    const policy = await ATHENA_CONTRACT.connect(policyTaker1).buyPolicies(
      [1000],
      [100],
      [6000],
      [1]
    );
    await policy.wait();
    expect(policy).to.haveOwnProperty("hash");
  });

  it("Should return remaining lock time ", async function () {
    const userStakes = await STAKING_POLICY.connect(
      policyTaker1
    ).allAccountStakingPositions(await policyTaker1.getAddress());
    console.log("User stakes", userStakes);

    expect(userStakes[1].timestamp.toNumber()).to.not.equal(0);
  });

  it("Should reject invalid withdraw Atens amount", async function () {
    await expect(
      ATHENA_CONTRACT.connect(policyTaker1).withdrawAtensPolicy(1)
    ).to.eventually.be.rejectedWith("Invalid amount");
  });

  it("Should lock ATENS on 1 year", async function () {
    await expect(
      ATHENA_CONTRACT.connect(policyTaker1).withdrawAtensPolicy(0)
    ).to.eventually.be.rejectedWith("Locked window");
  });

  it("Expect 12 months rewards for 100% APR", async function () {
    const rewards = await STAKING_POLICY.connect(policyTaker1).rewardsOf(
      await policyTaker1.getAddress(),
      0
    );
    expect(rewards.toNumber()).to.be.lessThanOrEqual(0.001);

    await HardhatHelper.setNextBlockTimestamp(60 * 60 * 24 * 365 + 10);

    const rewards2 = await STAKING_POLICY.connect(policyTaker1).rewardsOf(
      await policyTaker1.getAddress(),
      0
    );

    expect(rewards2.toString()).to.equal(10000);
  });

  it("Should return 2 staking Policy ", async function () {
    const indexUser = await STAKING_POLICY.connect(
      policyTaker1
    ).allAccountStakingPositions(await policyTaker1.getAddress());

    expect(indexUser.length).to.equal(2);
  });

  it("Should unlock ATENS and withdraw after 1 year", async function () {
    await ATEN.connect(policyTaker2).transfer(STAKING_POLICY.address, 100);
    await ATEN.connect(policyTaker2).transfer(STAKING_POLICY.address, 100);
    const balBefore = await ATEN.connect(policyTaker2).balanceOf(
      await policyTaker1.getAddress()
    );
    await expect(
      ATHENA_CONTRACT.connect(policyTaker1).withdrawAtensPolicy(0)
    ).to.eventually.haveOwnProperty("hash");
    const balAfter = await ATEN.connect(policyTaker2).balanceOf(
      await policyTaker1.getAddress()
    );
    expect(balAfter.sub(balBefore).toString()).to.equal(
      BigNumber.from(10000).mul(99975).div(100000).mul(2).toString()
    );
    await expect(
      ATHENA_CONTRACT.connect(policyTaker1).withdrawAtensPolicy(1)
    ).to.eventually.haveOwnProperty("hash");
  });
});
