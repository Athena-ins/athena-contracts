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
    const slot0 = await POLICY_COVER_CONTRACT_TEST.testGetSlot0();

    expect(slot0.tick).to.be.equal(BN("0"));
    expect(slot0.useRate).to.be.equal(BN("1"));
    expect(slot0.emissionRate).to.be.equal(BN("0"));
    expect(slot0.hoursPerTick).to.be.equal(BN("48"));
    expect(slot0.numerator).to.be.equal(BN("1"));
    expect(slot0.denumerator).to.be.equal(BN("1"));
    expect(slot0.lastUpdateTimestamp);
  });

  it("Should set newUseRate slot0", async () => {
    await POLICY_COVER_CONTRACT_TEST.testSetRate(2);
    let rate = await POLICY_COVER_CONTRACT_TEST.testGetRate();
    expect(rate).to.be.equal(BN(2));

    await POLICY_COVER_CONTRACT_TEST.testSetRate(5);
    rate = await POLICY_COVER_CONTRACT_TEST.testGetRate();
    expect(rate).to.be.equal(BN(5));

    await POLICY_COVER_CONTRACT_TEST.testSetRate(6);
    rate = await POLICY_COVER_CONTRACT_TEST.testGetRate();
    expect(rate).to.be.equal(BN(6));

    await POLICY_COVER_CONTRACT_TEST.testSetRate(1);
    rate = await POLICY_COVER_CONTRACT_TEST.testGetRate();
    expect(rate).to.be.equal(BN(1));
  });

  it("Should return duration by hour unit", async () => {
    const durationHourUnit =
      await POLICY_COVER_CONTRACT_TEST.testDurationHourUnit(3650, 182500, 2);

    expect(durationHourUnit).to.be.equal(BN(365 * 24));
  });

  it("Should return emission rate per day", async () => {
    const emissionRatePerDay =
      await POLICY_COVER_CONTRACT_TEST.testGetEmissionRatePerDay(182500, 2);

    expect(emissionRatePerDay).to.be.equal(BN(10));
  });

  it("Should update slot0 when perform buy policy", async () => {
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

  it("should return current tick when actualizing after 10 days", async () => {
    await increaseTimeAndMine(10 * 24 * 60 * 60);
    const response = await POLICY_COVER_CONTRACT_TEST.testActualizing();
    const result = await response.wait();
    const decodedData = result.events[0].decode(result.events[0].data);

    expect(decodedData.currentTick).to.be.equal(10);

    const slot0 = await POLICY_COVER_CONTRACT_TEST.testGetSlot0();
    expect(slot0.tick).to.be.equal(BN("10"));
    expect(slot0.useRate).to.be.equal(BN("2"));
    expect(slot0.emissionRate).to.be.equal(BN("10"));
    expect(slot0.hoursPerTick).to.be.equal(BN("24"));
    expect(slot0.numerator).to.be.equal(BN("2"));
    expect(slot0.denumerator).to.be.equal(BN("1"));
    expect(slot0.lastUpdateTimestamp);
  });

  it("should return number of remained day with fee = 5%", async () => {
    const remainedDays = await POLICY_COVER_CONTRACT_TEST.testRemainedDay(
      5,
      365
    );
    expect(remainedDays).to.be.equal(BN(142));
  });
});
