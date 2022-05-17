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

  it.skip("Should initialize slot0 in constructor", async function () {
    const slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

    expect(slot0.tick).to.be.equal(BN("0"));
    expect(slot0.useRate).to.be.equal(BN("1"));
    expect(slot0.emissionRate).to.be.equal(BN("0"));
    expect(slot0.hoursPerTick).to.be.equal(BN("48"));
    expect(slot0.numerator).to.be.equal(BN("1"));
    expect(slot0.denumerator).to.be.equal(BN("1"));
    expect(slot0.lastUpdateTimestamp);
  });

  it.skip("Should set newUseRate slot0", async () => {
    await POLICY_COVER_CONTRACT_TEST.setRate(2);
    let rate = await POLICY_COVER_CONTRACT_TEST.getRate();
    expect(rate).to.be.equal(BN(2));

    await POLICY_COVER_CONTRACT_TEST.setRate(5);
    rate = await POLICY_COVER_CONTRACT_TEST.getRate();
    expect(rate).to.be.equal(BN(5));

    await POLICY_COVER_CONTRACT_TEST.setRate(6);
    rate = await POLICY_COVER_CONTRACT_TEST.getRate();
    expect(rate).to.be.equal(BN(6));

    await POLICY_COVER_CONTRACT_TEST.setRate(1);
    rate = await POLICY_COVER_CONTRACT_TEST.getRate();
    expect(rate).to.be.equal(BN(1));
  });

  it.skip("Should return duration by hour unit", async () => {
    const durationHourUnit =
      await POLICY_COVER_CONTRACT_TEST.testDurationHourUnit(3650, 182500, 2);

    expect(durationHourUnit).to.be.equal(BN(365 * 24));
  });

  it.skip("Should return emission rate per day", async () => {
    const emissionRatePerDay =
      await POLICY_COVER_CONTRACT_TEST.testGetEmissionRatePerDay(182500, 2);

    expect(emissionRatePerDay).to.be.equal(BN(10));
  });

  it.skip("Should update slot0 when perform buy policy", async () => {
    const response = await POLICY_COVER_CONTRACT_TEST.testPerformBuyPolicy(
      2,
      3650,
      182500
    );
    const result = await response.wait();
    const decodedData = result.events[0].decode(result.events[0].data);

    expect(decodedData.useRate).to.be.equal(BN(2));
    expect(decodedData.addingEmissionRate).to.be.equal(BN(10));
    expect(decodedData.hourPerTick).to.be.equal(BN(24));
    expect(decodedData.tick).to.be.equal(365);

    // console.log(result.events[0].decode(result.events[0].data));

    for (let i = 0; i < 365 * 2; i++) {
      const isInit = await POLICY_COVER_CONTRACT_TEST.testIsInitializedTick(i);
      if (i === 365) expect(isInit).to.be.equal(true);
      else expect(isInit).to.be.equal(false);
    }
  });

  it.skip("should return current tick when actualizing after 10 days", async () => {
    await increaseTimeAndMine(10 * 24 * 60 * 60);
    const response = await POLICY_COVER_CONTRACT_TEST.testActualizing();
    const result = await response.wait();
    const decodedData = result.events[0].decode(result.events[0].data);

    expect(decodedData.tick).to.be.equal(10);

    const slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();
    expect(slot0.tick).to.be.equal(BN("10"));
    expect(slot0.useRate).to.be.equal(BN("2"));
    expect(slot0.emissionRate).to.be.equal(BN("10"));
    expect(slot0.hoursPerTick).to.be.equal(BN("24"));
    expect(slot0.numerator).to.be.equal(BN("2"));
    expect(slot0.denumerator).to.be.equal(BN("1"));
    expect(slot0.lastUpdateTimestamp);
  });

  it.skip("should return number of remained day with fee = 5%", async () => {
    const remainedDays = await POLICY_COVER_CONTRACT_TEST.testRemainedDay(
      5,
      365
    );
    expect(remainedDays).to.be.equal(BN(142));
  });

  it("Should actualizing", async () => {
    await POLICY_COVER_CONTRACT_TEST.mineTick(375, 365000, 20, 2, 1);
    await POLICY_COVER_CONTRACT_TEST.mineTick(740, 365000, 40, 4, 1);
    await POLICY_COVER_CONTRACT_TEST.mineTick(1000, 0, 0, 1, 1);

    //initTimestamp: 1646219106
    await POLICY_COVER_CONTRACT_TEST.setTick(20);
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

    await increaseTimeAndMine(375 * 2 * 24 * 60 * 60);

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
});
