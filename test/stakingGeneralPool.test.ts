import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "./helpers/HardhatHelper";
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

describe("Staking General Pool", function () {
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

    const USDT_amount1 = "4000000";
    const ATEN_amount1 = "0";
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

    await HardhatHelper.USDT_maxApprove(
      policyTaker1,
      ProtocolHelper.getAthenaContract().address
    );

    const capital1 = "109500";
    const capital1_2 = "140";
    const premium1 = "2190";
    const atensLocked1 = "0";
    await ProtocolHelper.buyPolicies(
      policyTaker1,
      [capital1, capital1_2],
      [premium1, premium1],
      [atensLocked1, atensLocked1],
      [0, 3],
      20 * 24 * 60 * 60
    );

    await HardhatHelper.USDT_maxApprove(
      policyTaker2,
      ProtocolHelper.getAthenaContract().address
    );

    const capital2 = "219000";
    const premium2 = "8760";
    const atensLocked2 = "0";
    await ProtocolHelper.buyPolicy(
      policyTaker2,
      capital2,
      premium2,
      atensLocked2,
      0,
      10 * 24 * 60 * 60
    );

    await HardhatHelper.USDT_maxApprove(
      policyTaker3,
      ProtocolHelper.getAthenaContract().address
    );

    const capital3 = "18250";
    const premium3 = "8760";
    const atensLocked3 = "0";
    await ProtocolHelper.buyPolicy(
      policyTaker3,
      capital3,
      premium3,
      atensLocked3,
      1,
      10 * 24 * 60 * 60
    );
  });

  // it("Should check staking rate of liquidity providers", async function () {
  //   const ATHENA_CONTRACT = ProtocolHelper.getAthenaContract();
  //   const feeLevels = await ATHENA_CONTRACT.connect(
  //     owner
  //   ).getAtenStakingFeeLevels();

  //   console.log("feeLevels: ", feeLevels);
  // });

  it("Should try and stake, wait, extract interests and withdraw from GP", async function () {
    const STAKING_GP_CONTRACT =
      ProtocolHelper.getStakedAtenContract().connect(liquidityProvider1);
    const ATHENA_CONTRACT =
      ProtocolHelper.getAthenaContract().connect(liquidityProvider1);

    const liquidityProvider1Address = await liquidityProvider1.getAddress();

    const stakingPosBefore = await STAKING_GP_CONTRACT.getUserStakingPosition(
      liquidityProvider1Address
    );

    expect(stakingPosBefore.amount).to.equal("0");
    expect(stakingPosBefore.since).to.equal("0");
    expect(stakingPosBefore.accruedRewards).to.equal("0");
    expect(stakingPosBefore.rate).to.equal("0");

    const stakingAmount = 1000000;
    await ProtocolHelper.stakingGeneralPoolDeposit(
      liquidityProvider1,
      stakingAmount
    );

    const stakingPosAfter = await STAKING_GP_CONTRACT.getUserStakingPosition(
      liquidityProvider1Address
    );

    expect(stakingPosAfter.amount).to.equal(stakingAmount);
    expect(stakingPosAfter.since).to.equal(
      await HardhatHelper.getCurrentTime()
    );
    expect(stakingPosAfter.accruedRewards).to.equal("0");
    expect(stakingPosAfter.rate).to.equal("2000");

    const nbRewardDays = 30;
    await HardhatHelper.setNextBlockTimestamp(30 * 24 * 60 * 60);

    const rewards = await STAKING_GP_CONTRACT.rewardsOf(
      liquidityProvider1Address
    );

    const expectedRewards = Math.round(
      stakingAmount *
        (stakingPosAfter.rate.toNumber() / 10_000) *
        (nbRewardDays / 365)
    );

    expect(rewards).to.equal(expectedRewards);
    const balanceBefore = await HardhatHelper.ATEN_balanceOf(
      liquidityProvider1Address
    );
    await (await ATHENA_CONTRACT.takeStakingProfits()).wait();

    const balanceAfter = await HardhatHelper.ATEN_balanceOf(
      liquidityProvider1Address
    );

    // Substract 4 because of the fees
    expect(balanceAfter).to.equal(balanceBefore.add(expectedRewards).sub(4));

    const amountUnstaked = 10_000;
    await (await ATHENA_CONTRACT.unstakeAtens(amountUnstaked)).wait();

    const stakingPosAfterWithdraw =
      await STAKING_GP_CONTRACT.getUserStakingPosition(
        liquidityProvider1Address
      );

    expect(stakingPosAfterWithdraw.amount).to.equal(
      stakingAmount - amountUnstaked
    );
    expect(stakingPosAfterWithdraw.since).to.equal("1680283987");
    expect(stakingPosAfterWithdraw.accruedRewards).to.equal("0");
    expect(stakingPosAfterWithdraw.rate).to.equal("2000");
  });
});
