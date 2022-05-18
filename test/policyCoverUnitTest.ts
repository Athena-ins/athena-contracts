import chai, { expect } from "chai";
import { ethers as ethers_hardhat } from "hardhat";
import { ethers as ethers_ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";
import { increaseTimeAndMine } from "./helpers";

chai.use(chaiAsPromised);

const BN = (num: string | number) => ethers_ethers.BigNumber.from(num);

const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT

let allSigners: ethers_ethers.Signer[];
let owner: ethers_ethers.Signer;
let POLICY_COVER_CONTRACT_TEST: ethers_ethers.Contract;

describe("Policy cover contract", function () {
  before(async () => {
    allSigners = await ethers_hardhat.getSigners();
    owner = allSigners[0];
  });

  /**
   *
   * CONTRACT DEPLOYMENT
   *
   */

  it("Should deploy contract", async function () {
    const factory = await ethers_hardhat.getContractFactory("PolicyCoverTest");
    POLICY_COVER_CONTRACT_TEST = await factory.connect(owner).deploy(USDT);

    await POLICY_COVER_CONTRACT_TEST.deployed();

    expect(
      await ethers_hardhat.provider.getCode("0x" + "0".repeat(40))
    ).to.equal("0x");

    expect(
      await ethers_hardhat.provider.getCode(POLICY_COVER_CONTRACT_TEST.address)
    ).to.not.equal("0x");
  });

  it("Should initialize slot0 in constructor", async function () {
    const slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

    expect(slot0.tick).to.be.equal(BN(0));
    expect(slot0.useRate).to.be.equal(BN(1));
    expect(slot0.emissionRate).to.be.equal(BN(0));
    expect(slot0.hoursPerTick).to.be.equal(BN(48));
    expect(slot0.numerator).to.be.equal(BN(1));
    expect(slot0.denominator).to.be.equal(BN(1));
    expect(slot0.lastUpdateTimestamp).to.be.equal(BN(1646219106));
  });

  it.skip("Should actualizing and show information about initialised tick and remaning days", async () => {
    await POLICY_COVER_CONTRACT_TEST.mineTick(370, 365000, 20, 2, 1);
    await POLICY_COVER_CONTRACT_TEST.mineTick(745, 365000, 40, 4, 1);

    await POLICY_COVER_CONTRACT_TEST.setTick(15);
    await POLICY_COVER_CONTRACT_TEST.setRate(4);
    await POLICY_COVER_CONTRACT_TEST.setEmissionRate(80);
    await POLICY_COVER_CONTRACT_TEST.setHoursPerTick(12);
    await POLICY_COVER_CONTRACT_TEST.setNumerator(4);
    await POLICY_COVER_CONTRACT_TEST.setDenumerator(1);
    await POLICY_COVER_CONTRACT_TEST.setLastUpdateTimestamp(
      1646219106 + 20 * 24 * 60 * 60
    );

    let slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();
    console.log(`tick: ${slot0.tick}`);
    console.log(`useRate: ${slot0.useRate}`);
    console.log(`emissionRate: ${slot0.emissionRate}`);
    console.log(`hoursPerTick: ${slot0.hoursPerTick}`);
    console.log(`numerator: ${slot0.numerator}`);
    console.log(`denumerator: ${slot0.denumerator}`);
    console.log(`lastUpdateTimestamp: ${slot0.lastUpdateTimestamp}`);

    await increaseTimeAndMine(375 * 5 * 24 * 60 * 60);

    const response = await POLICY_COVER_CONTRACT_TEST.testActualizing();
    const result = await response.wait();

    console.log("-------------------------------");
    for (let i = 0; i < result.events.length; i++) {
      const decodedData = result.events[i].decode(result.events[i].data);
      console.log(`${decodedData}`);
    }

    // expect(decodedData.tick).to.be.equal(10);

    console.log("-------------------------------");

    slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();
    console.log(`tick: ${slot0.tick}`);
    console.log(`useRate: ${slot0.useRate}`);
    console.log(`emissionRate: ${slot0.emissionRate}`);
    console.log(`hoursPerTick: ${slot0.hoursPerTick}`);
    console.log(`numerator: ${slot0.numerator}`);
    console.log(`denumerator: ${slot0.denumerator}`);
    console.log(`lastUpdateTimestamp: ${slot0.lastUpdateTimestamp}`);
  });

  async function actualizing() {
    const response = await POLICY_COVER_CONTRACT_TEST.testActualizing();
    const result = await response.wait();

    const array = [];
    for (let i = 0; i < result.events.length; i++) {
      const decodedData = result.events[i].decode(result.events[i].data);
      console.log(`${decodedData}`);
      if (decodedData.msg === "HoursToDay") {
        array.push(decodedData);
      }
    }

    console.log("-------------------------------");
    return array;
  }

  async function performBuyPolicy(
    newRate: number,
    amount: number,
    capital: number
  ) {
    const response = await POLICY_COVER_CONTRACT_TEST.testPerformBuyPolicy(
      newRate,
      amount,
      capital
    );

    const result = await response.wait();
    const decodedData = result.events[0].decode(result.events[0].data);
    return decodedData;
  }

  it("Should update slot0 when perform buy policy and mine new tick", async () => {
    await POLICY_COVER_CONTRACT_TEST.setTick(0);
    await POLICY_COVER_CONTRACT_TEST.setRate(1);
    await POLICY_COVER_CONTRACT_TEST.setEmissionRate(0);
    await POLICY_COVER_CONTRACT_TEST.setHoursPerTick(48);
    await POLICY_COVER_CONTRACT_TEST.setNumerator(1);
    await POLICY_COVER_CONTRACT_TEST.setDenumerator(1);
    await POLICY_COVER_CONTRACT_TEST.setLastUpdateTimestamp(1646219106);

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    const array1 = await actualizing();
    expect(array1.length).to.be.equal(0);

    const resultA = await performBuyPolicy(2, 7300, 365000);
    expect(resultA.useRate).to.be.equal(2);
    expect(resultA.addingEmissionRate).to.be.equal(20);
    expect(resultA.hourPerTick).to.be.equal(24);
    expect(resultA.tick).to.be.equal(370);

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    const array2 = await actualizing();
    expect(array2.length).to.be.equal(0);

    const resultB = await performBuyPolicy(4, 14600, 365000);
    expect(resultB.useRate).to.be.equal(4);
    expect(resultB.addingEmissionRate).to.be.equal(40);
    expect(resultB.hourPerTick).to.be.equal(12);
    expect(resultB.tick).to.be.equal(745);

    await increaseTimeAndMine(1000 * 24 * 60 * 60);
    const array3 = await actualizing();
    expect(array3.length).to.be.equal(2);
    expect(array3[0].nbrDays.toString()).to.be.equal("177");
    expect(array3[1].nbrDays.toString()).to.be.equal("375");
  });
});
