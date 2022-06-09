import chai, { expect } from "chai";
import hre, { ethers as ethers_hardhat } from "hardhat";
import { ethers as ethers_ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";
import { increaseTimeAndMine } from "./helpers";

chai.use(chaiAsPromised);

const BN = (num: string | number) => ethers_ethers.BigNumber.from(num);

const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT

const OneRay = BN("1000000000000000000000000000");

const uOptimal = OneRay.mul(75);
const r0 = OneRay;
const rSlope1 = OneRay.mul(5);
const rSlope2 = OneRay.mul(11).div(10);

let allSigners: ethers_ethers.Signer[];
let owner: ethers_ethers.Signer;
let user1: ethers_ethers.Signer;
let user2: ethers_ethers.Signer;
let POLICY_COVER_CONTRACT_TEST: ethers_ethers.Contract;

describe("Policy cover contract", function () {
  before(async () => {
    allSigners = await ethers_hardhat.getSigners();
    owner = allSigners[0];
    user1 = allSigners[1];
    user2 = allSigners[2];
  });

  this.beforeAll(async () => {
    await hre.network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [1646219106],
    });
  });

  /**
   *
   * CONTRACT DEPLOYMENT
   *
   */

  it("Should deploy contract", async function () {
    const factory = await ethers_hardhat.getContractFactory("PolicyCoverTest");
    POLICY_COVER_CONTRACT_TEST = await factory
      .connect(owner)
      .deploy(uOptimal, r0, rSlope1, rSlope2);

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
    expect(slot0.premiumRate).to.be.equal(OneRay);
    expect(slot0.emissionRate).to.be.equal(BN(0));
    expect(slot0.hoursPerTick).to.be.equal(OneRay.mul(24));
    expect(slot0.availableCapital).to.be.equal(BN(0));
    expect(slot0.lastUpdateTimestamp).to.be.equal(BN(1646219106));
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

  it("Should buy policy", async () => {
    await POLICY_COVER_CONTRACT_TEST.setTick(0);
    await POLICY_COVER_CONTRACT_TEST.setRate(OneRay);
    await POLICY_COVER_CONTRACT_TEST.setEmissionRate(0);
    await POLICY_COVER_CONTRACT_TEST.setHoursPerTick(OneRay.mul(24));
    await POLICY_COVER_CONTRACT_TEST.setTotalInsured(0);
    await POLICY_COVER_CONTRACT_TEST.setAvailableCapital(OneRay.mul(730000));

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    const response1 = await POLICY_COVER_CONTRACT_TEST.testBuyPolicy(
      await user1.getAddress(),
      2190,
      109500
    );

    const events = (await response1.wait()).events;
    // console.log(events);

    let slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

    expect(slot0.tick).to.be.equal(10);
    expect(slot0.premiumRate).to.be.equal(OneRay.mul(2));
    expect(slot0.emissionRate).to.be.equal(OneRay.mul(6));
    expect(slot0.hoursPerTick).to.be.equal(OneRay.mul(12));

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    const resultB = await POLICY_COVER_CONTRACT_TEST.testBuyPolicy(
      await user2.getAddress(),
      8760,
      219000
    );

    slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

    expect(slot0.tick).to.be.equal(30);
    expect(slot0.premiumRate.div(OneRay).toNumber()).to.be.lessThanOrEqual(4);
    expect(slot0.premiumRate.div(OneRay).toNumber()).to.be.greaterThanOrEqual(
      3
    );
    expect(slot0.emissionRate.div(OneRay).toNumber()).to.be.lessThanOrEqual(
      6 * 2 + 24
    );
    expect(slot0.emissionRate.div(OneRay).toNumber()).to.be.greaterThanOrEqual(
      6 * 2
    );
    expect(slot0.hoursPerTick.div(OneRay).toNumber()).to.be.greaterThanOrEqual(
      6
    );

    await increaseTimeAndMine(1000 * 24 * 60 * 60);

    console.log("Final actualizing");
    const array3 = await actualizing();
    console.log(`array 3: ${array3}`);
    expect(array3.length).to.be.equal(2);
    expect(Number(array3[0].nbrDays)).to.be.greaterThanOrEqual(177);
    expect(Number(array3[1].nbrDays)).to.be.greaterThanOrEqual(250);

    slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();
    expect(slot0.premiumRate).to.be.equal(OneRay);
    expect(slot0.emissionRate).to.be.equal(0);
    expect(slot0.hoursPerTick).to.be.equal(OneRay.mul(24));

    const totalInsured = await POLICY_COVER_CONTRACT_TEST.getTotalInsured();
    expect(totalInsured).to.be.equal(BN(0));
  });

  it("Should reverted with Owner Not Exist when withdrawPolicy", async () => {
    await POLICY_COVER_CONTRACT_TEST.setTick(0);
    await POLICY_COVER_CONTRACT_TEST.setRate(OneRay);
    await POLICY_COVER_CONTRACT_TEST.setEmissionRate(0);
    await POLICY_COVER_CONTRACT_TEST.setHoursPerTick(OneRay.mul(24));
    await POLICY_COVER_CONTRACT_TEST.setTotalInsured(0);
    await POLICY_COVER_CONTRACT_TEST.setAvailableCapital(OneRay.mul(730000));

    await expect(
      POLICY_COVER_CONTRACT_TEST.withdrawPolicy(user2.getAddress())
    ).revertedWith("Owner Not Exist");

    await expect(
      POLICY_COVER_CONTRACT_TEST.withdrawPolicy(user2.getAddress())
    ).to.eventually.be.rejectedWith("Owner Not Exist");
  });

  it("Should return view for actualizing with given date", async () => {
    await POLICY_COVER_CONTRACT_TEST.setTick(0);
    await POLICY_COVER_CONTRACT_TEST.setRate(OneRay);
    await POLICY_COVER_CONTRACT_TEST.setEmissionRate(0);
    await POLICY_COVER_CONTRACT_TEST.setHoursPerTick(OneRay.mul(24));
    await POLICY_COVER_CONTRACT_TEST.setTotalInsured(0);
    await POLICY_COVER_CONTRACT_TEST.setAvailableCapital(OneRay.mul(730000));

    let slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

    const givenDate1 = slot0.lastUpdateTimestamp.add(10 * 24 * 60 * 60);
    const result1 = await POLICY_COVER_CONTRACT_TEST.actualizingUntilGivenDate(
      givenDate1
    );
    // console.log(result1);

    expect(result1.premiumRate).to.be.equal(slot0.premiumRate);
    expect(result1.emissionRate).to.be.equal(slot0.emissionRate);
    expect(result1.hoursPerTick).to.be.equal(slot0.hoursPerTick);

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    await POLICY_COVER_CONTRACT_TEST.testBuyPolicy(
      await user1.getAddress(),
      2190,
      109500
    );

    slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

    // expect(result1.__slot0.lastUpdateTimestamp).to.be.equal(
    //   slot0.lastUpdateTimestamp
    // );
    expect(result1.tick).to.be.equal(slot0.tick);

    const givenDate2 = slot0.lastUpdateTimestamp.add(10 * 24 * 60 * 60);
    const result2 = await POLICY_COVER_CONTRACT_TEST.actualizingUntilGivenDate(
      givenDate2
    );
    // console.log(result2);

    expect(result2.premiumRate).to.be.equal(slot0.premiumRate);
    expect(result2.emissionRate).to.be.equal(slot0.emissionRate);
    expect(result2.hoursPerTick).to.be.equal(slot0.hoursPerTick);

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    const resultB = await POLICY_COVER_CONTRACT_TEST.testBuyPolicy(
      await user2.getAddress(),
      8760,
      219000
    );

    slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

    // expect(result2.__slot0.lastUpdateTimestamp).to.be.equal(
    //   slot0.lastUpdateTimestamp
    // );
    expect(result2.tick).to.be.equal(slot0.tick);

    const givenDate3 = slot0.lastUpdateTimestamp.add(1000 * 24 * 60 * 60);
    const result3 = await POLICY_COVER_CONTRACT_TEST.actualizingUntilGivenDate(
      givenDate3
    );
    // console.log(result3);

    await increaseTimeAndMine(1000 * 24 * 60 * 60);

    console.log("Final actualizing");
    const array3 = await actualizing();
    console.log(`array 3: ${array3}`);
    expect(array3.length).to.be.equal(2);
    expect(Number(array3[0].nbrDays)).to.be.greaterThanOrEqual(177);
    expect(Number(array3[1].nbrDays)).to.be.greaterThanOrEqual(250);

    slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

    expect(result3.tick).to.be.equal(slot0.tick);
    expect(result3.premiumRate).to.be.equal(slot0.premiumRate);
    expect(result3.emissionRate).to.be.equal(slot0.emissionRate);
    expect(result3.hoursPerTick).to.be.equal(slot0.hoursPerTick);

    // expect(result3.__slot0.lastUpdateTimestamp).to.be.equal(
    //   slot0.lastUpdateTimestamp
    // );
    // expect(result3.__totalInsured).to.be.equal(
    //   await POLICY_COVER_CONTRACT_TEST.getTotalInsured()
    // );
  });

  it("Should withdraw policy", async () => {
    await POLICY_COVER_CONTRACT_TEST.setTick(0);
    await POLICY_COVER_CONTRACT_TEST.setRate(OneRay);
    await POLICY_COVER_CONTRACT_TEST.setEmissionRate(0);
    await POLICY_COVER_CONTRACT_TEST.setHoursPerTick(OneRay.mul(24));
    await POLICY_COVER_CONTRACT_TEST.setTotalInsured(0);
    await POLICY_COVER_CONTRACT_TEST.setAvailableCapital(OneRay.mul(730000));

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    await POLICY_COVER_CONTRACT_TEST.testBuyPolicy(
      await user1.getAddress(),
      2190,
      109500
    );

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    await POLICY_COVER_CONTRACT_TEST.testBuyPolicy(
      await user2.getAddress(),
      8760,
      219000
    );

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    const response = await POLICY_COVER_CONTRACT_TEST.withdrawPolicy(
      await user1.getAddress()
    );
    const result = await response.wait();
    expect(
      result.events[3]
        .decode(result.events[3].data)
        .remainedAmount.div(OneRay)
        .toNumber()
    ).to.be.greaterThanOrEqual(2190 - 60 - 120);

    let slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();
    expect(slot0.tick).to.be.lessThanOrEqual(70);
    expect(slot0.premiumRate.gte(OneRay.mul(2))).to.be.true;
    expect(slot0.premiumRate.lt(OneRay.mul(3))).to.be.true;
    expect(slot0.emissionRate.gte(OneRay.mul(17))).to.be.true;
    expect(slot0.emissionRate.lt(OneRay.mul(18))).to.be.true;
    expect(slot0.hoursPerTick.gte(OneRay.mul(8))).to.be.true;
    expect(slot0.hoursPerTick.lt(OneRay.mul(9))).to.be.true;

    const totalInsured = await POLICY_COVER_CONTRACT_TEST.getTotalInsured();
    expect(totalInsured).to.be.equal(OneRay.mul(219000));

    const response2 = await POLICY_COVER_CONTRACT_TEST.withdrawPolicy(
      await user2.getAddress()
    );
    const result2 = await response2.wait();
    // console.log(result2);
    expect(
      result2.events[1]
        .decode(result2.events[1].data)
        .remainedAmount.gte(OneRay.mul(8760 - 240))
    ).to.be.true;

    slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();
    expect(slot0.tick).to.be.lessThanOrEqual(70);
    expect(slot0.premiumRate).to.be.equal(OneRay);
    expect(slot0.emissionRate).to.be.equal(0);
    expect(slot0.hoursPerTick.lt(OneRay.mul(24))).to.be.true;

    const totalInsured2 = await POLICY_COVER_CONTRACT_TEST.getTotalInsured();
    expect(totalInsured2).to.be.equal(BN(0));
  });

  it("Should return getInfo for a given owner", async () => {
    await POLICY_COVER_CONTRACT_TEST.setTick(0);
    await POLICY_COVER_CONTRACT_TEST.setRate(OneRay);
    await POLICY_COVER_CONTRACT_TEST.setEmissionRate(0);
    await POLICY_COVER_CONTRACT_TEST.setHoursPerTick(OneRay.mul(24));
    await POLICY_COVER_CONTRACT_TEST.setTotalInsured(0);
    await POLICY_COVER_CONTRACT_TEST.setAvailableCapital(OneRay.mul(730000));

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    await POLICY_COVER_CONTRACT_TEST.testBuyPolicy(
      await user1.getAddress(),
      2190,
      109500
    );

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    await POLICY_COVER_CONTRACT_TEST.testBuyPolicy(
      await user2.getAddress(),
      8760,
      219000
    );

    const result1 = await POLICY_COVER_CONTRACT_TEST.testGetInfo(
      await user1.getAddress()
    );
    console.log(result1);

    const result2 = await POLICY_COVER_CONTRACT_TEST.testGetInfo(
      await user2.getAddress()
    );
    console.log(result2);

    await increaseTimeAndMine(1000 * 24 * 60 * 60);

    console.log("Final actualizing");
    const array3 = await actualizing();
    console.log(`array 3: ${array3}`);
    expect(array3.length).to.be.equal(2);

    expect(array3[0].nbrDays).to.be.equal(result1[1]);
    expect(array3[1].nbrDays).to.be.equal(result2[1]);
  });
});
