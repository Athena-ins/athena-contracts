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
    expect(slot0.premiumSpent).to.be.equal(BN(0));
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
    for (let i = 0; i < 3; i++) {
      // await hre.network.provider.request({
      //   method: "hardhat_reset",
      //   params: [
      //     {
      //       forking: {
      //         // jsonRpcUrl: process.env.MAINNET_URL,
      //         blockNumber: 14307200,
      //       },
      //     },
      //   ],
      // });

      await POLICY_COVER_CONTRACT_TEST.setTick(0);
      await POLICY_COVER_CONTRACT_TEST.setRate(1);
      await POLICY_COVER_CONTRACT_TEST.setEmissionRate(0);
      await POLICY_COVER_CONTRACT_TEST.setHoursPerTick(48);
      await POLICY_COVER_CONTRACT_TEST.setPremiumSpent(0);
      // await POLICY_COVER_CONTRACT_TEST.setLastUpdateTimestamp(1646219106);
      await POLICY_COVER_CONTRACT_TEST.setTotalInsured(0);

      await increaseTimeAndMine(10 * 24 * 60 * 60);

      await POLICY_COVER_CONTRACT_TEST.testBuyPolicy(
        await user1.getAddress(),
        7300,
        365000
      );

      let slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

      expect(slot0.tick).to.be.equal(5);
      expect(slot0.useRate).to.be.equal(2);
      expect(slot0.emissionRate).to.be.equal(20);
      expect(slot0.hoursPerTick).to.be.equal(24);
      expect(slot0.premiumSpent).to.be.equal(0);

      await increaseTimeAndMine(10 * 24 * 60 * 60);

      const resultB = await POLICY_COVER_CONTRACT_TEST.testBuyPolicy(
        await user2.getAddress(),
        14600,
        365000
      );

      slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

      expect(slot0.tick).to.be.equal(15);
      expect(slot0.useRate).to.be.equal(4);
      expect(slot0.emissionRate).to.be.equal(80);
      expect(slot0.hoursPerTick).to.be.equal(12);
      expect(slot0.premiumSpent).to.be.equal(200);

      await increaseTimeAndMine(1000 * 24 * 60 * 60);

      console.log("Final actualizing");
      const array3 = await actualizing();
      console.log(`array 3: ${array3}`);
      expect(array3.length).to.be.equal(2);
      expect(array3[0].nbrDays.toString()).to.be.equal("177");
      expect(array3[1].nbrDays.toString()).to.be.equal("375");

      slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();
      // expect(slot0.tick).to.be.equal(15);
      expect(slot0.useRate).to.be.equal(1);
      expect(slot0.emissionRate).to.be.equal(0);
      expect(slot0.hoursPerTick).to.be.equal(48);
      expect(slot0.premiumSpent).to.be.equal(21900);

      const totalInsured = await POLICY_COVER_CONTRACT_TEST.getTotalInsured();
      expect(totalInsured).to.be.equal(BN(0));
    }
  });

  it("Should return view for actualizing with given date", async () => {
    await POLICY_COVER_CONTRACT_TEST.setTick(0);
    await POLICY_COVER_CONTRACT_TEST.setRate(1);
    await POLICY_COVER_CONTRACT_TEST.setEmissionRate(0);
    await POLICY_COVER_CONTRACT_TEST.setHoursPerTick(48);
    await POLICY_COVER_CONTRACT_TEST.setPremiumSpent(0);
    await POLICY_COVER_CONTRACT_TEST.setTotalInsured(0);

    let slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

    const givenDate1 = slot0.lastUpdateTimestamp.add(10 * 24 * 60 * 60);
    const result1 = await POLICY_COVER_CONTRACT_TEST.actualizingUntilGivenDate(
      givenDate1
    );
    // console.log(result1);

    expect(result1.vSlot0.useRate).to.be.equal(slot0.useRate);
    expect(result1.vSlot0.emissionRate).to.be.equal(slot0.emissionRate);
    expect(result1.vSlot0.hoursPerTick).to.be.equal(slot0.hoursPerTick);
    expect(result1.vSlot0.premiumSpent).to.be.equal(slot0.premiumSpent);
    expect(result1.vTotalInsured).to.be.equal(
      await POLICY_COVER_CONTRACT_TEST.getTotalInsured()
    );

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    await POLICY_COVER_CONTRACT_TEST.testBuyPolicy(
      await user1.getAddress(),
      7300,
      365000
    );

    slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

    // expect(result1.vSlot0.lastUpdateTimestamp).to.be.equal(
    //   slot0.lastUpdateTimestamp
    // );
    expect(result1.vSlot0.tick).to.be.equal(slot0.tick);

    const givenDate2 = slot0.lastUpdateTimestamp.add(10 * 24 * 60 * 60);
    const result2 = await POLICY_COVER_CONTRACT_TEST.actualizingUntilGivenDate(
      givenDate2
    );
    // console.log(result2);

    expect(result2.vSlot0.useRate).to.be.equal(slot0.useRate);
    expect(result2.vSlot0.emissionRate).to.be.equal(slot0.emissionRate);
    expect(result2.vSlot0.hoursPerTick).to.be.equal(slot0.hoursPerTick);
    expect(result2.vSlot0.premiumSpent).to.be.equal(200);
    expect(result2.vTotalInsured).to.be.equal(
      await POLICY_COVER_CONTRACT_TEST.getTotalInsured()
    );

    await increaseTimeAndMine(10 * 24 * 60 * 60);

    const resultB = await POLICY_COVER_CONTRACT_TEST.testBuyPolicy(
      await user2.getAddress(),
      14600,
      365000
    );

    slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

    // expect(result2.vSlot0.lastUpdateTimestamp).to.be.equal(
    //   slot0.lastUpdateTimestamp
    // );
    expect(result2.vSlot0.tick).to.be.equal(slot0.tick);

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
    expect(array3[0].nbrDays.toString()).to.be.equal("177");
    expect(array3[1].nbrDays.toString()).to.be.equal("375");

    slot0 = await POLICY_COVER_CONTRACT_TEST.getSlot0();

    expect(result3.vSlot0.tick).to.be.equal(slot0.tick);
    expect(result3.vSlot0.useRate).to.be.equal(slot0.useRate);
    expect(result3.vSlot0.emissionRate).to.be.equal(slot0.emissionRate);
    expect(result3.vSlot0.hoursPerTick).to.be.equal(slot0.hoursPerTick);
    expect(result3.vSlot0.premiumSpent).to.be.equal(slot0.premiumSpent);
    // expect(result3.vSlot0.lastUpdateTimestamp).to.be.equal(
    //   slot0.lastUpdateTimestamp
    // );
    expect(result3.vTotalInsured).to.be.equal(
      await POLICY_COVER_CONTRACT_TEST.getTotalInsured()
    );
  });
});
