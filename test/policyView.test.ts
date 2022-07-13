import chai, { expect } from "chai";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "./helpers/HardhatHelper";
import ProtocolHelper from "./helpers/ProtocolHelper";

chai.use(chaiAsPromised);

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
let policyTaker1: ethers.Signer;
let policyTaker2: ethers.Signer;

describe("View policy", () => {
  before(async () => {
    await HardhatHelper.reset();
    const allSigners = await HardhatHelper.allSigners();
    owner = allSigners[0];
    liquidityProvider1 = allSigners[1];
    liquidityProvider2 = allSigners[2];
    policyTaker1 = allSigners[100];
    policyTaker2 = allSigners[101];

    await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
    await ProtocolHelper.addNewProtocolPool("Test protocol 0");
    await ProtocolHelper.addNewProtocolPool("Test protocol 1");
    await ProtocolHelper.addNewProtocolPool("Test protocol 2");

    const USDT_amount1 = "400000";
    const ATEN_amount1 = "100000";
    await ProtocolHelper.deposit(
      liquidityProvider1,
      USDT_amount1,
      ATEN_amount1,
      [0, 2],
      1 * 24 * 60 * 60
    );

    const USDT_amount2 = "330000";
    const ATEN_amount2 = "9000000";
    await ProtocolHelper.deposit(
      liquidityProvider2,
      USDT_amount2,
      ATEN_amount2,
      [0, 1, 2],
      1 * 24 * 60 * 60
    );

    const capital1 = "109500";
    const premium1 = "2190";
    const atensLocked1 = "0";
    await ProtocolHelper.buyPolicy(
      policyTaker1,
      capital1,
      premium1,
      atensLocked1,
      0,
      20 * 24 * 60 * 60
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
  });

  describe("Should view actualize", () => {
    it("Should get vSlot0 after 10 days", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const slot0 = await protocolContract.actualizingUntilGivenDate(
        HardhatHelper.getCurrentTime() + 10 * 24 * 60 * 60
      );

      // console.log(slot0);

      expect(slot0.tick).to.be.equal(60);
      expect(slot0.premiumRate).to.be.equal(4);
      expect(slot0.emissionRate).to.be.equal(36);
      expect(slot0.hoursPerTick).to.be.equal(6);
      expect(slot0.totalInsuredCapital).to.be.equal(328500);
      expect(slot0.currentPremiumSpent).to.be.equal(420);
      expect(slot0.cumulatedPremiumSpent).to.be.equal(420);
      expect(slot0.remainingPolicies).to.be.equal(2);
      expect(slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime() + 10 * 24 * 60 * 60
      );
    });

    it("Should get vSlot0 after 178 days", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const days = 178;
      const slot0 = await protocolContract.actualizingUntilGivenDate(
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(slot0.tick).to.be.equal(731);
      expect(slot0.premiumRate).to.be.equal(3);
      expect(slot0.emissionRate).to.be.equal(18);
      expect(slot0.hoursPerTick).to.be.equal(8);
      expect(slot0.totalInsuredCapital).to.be.equal(219000);
      expect(slot0.currentPremiumSpent).to.be.equal(6459); //Thao@TODO: check why ???
      expect(slot0.cumulatedPremiumSpent).to.be.equal(6459); //Thao@TODO: check why ???
      expect(slot0.remainingPolicies).to.be.equal(1);
      expect(slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );
    });

    it("Should get vSlot0 after 428 days", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const days = 428;
      const slot0 = await protocolContract.actualizingUntilGivenDate(
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(slot0.tick).to.be.equal(1480);
      expect(slot0.premiumRate).to.be.equal(1);
      expect(slot0.emissionRate).to.be.equal(0);
      expect(slot0.hoursPerTick).to.be.equal(24);
      expect(slot0.totalInsuredCapital).to.be.equal(0);
      expect(slot0.currentPremiumSpent).to.be.equal(10950);
      expect(slot0.cumulatedPremiumSpent).to.be.equal(10950);
      expect(slot0.remainingPolicies).to.be.equal(0);
      expect(slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );
    });
  });

  describe("Should view info of PT1 after 10 days and arriving of PT2", () => {
    it("Should get info via protocol contract", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker1,
        0
      );

      const response = await protocolContract.getInfo(
        await policyTaker1.getAddress()
      );

      expect(response.__remainingPremium).to.be.equal("2130");
      expect(response.__remainingDay).to.be.equal("177");
    });
  });

  describe("Should withdraw policy of PT1 after 1 days arriving of PT2", () => {
    it("Should withdraw policy", async () => {
      await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);
      const tx = await ProtocolHelper.getAthenaContract()
        .connect(policyTaker1)
        .withdrawPolicy(0);

      const result = await tx.wait();
      const event = result.events[1];

      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker1,
        0
      );

      const decodedData = protocolContract.interface.decodeEventLog(
        event.topics[0],
        event.data
      );

      expect(decodedData.owner).to.be.equal(await policyTaker1.getAddress());
      expect(decodedData.remainedAmount).to.be.equal("2118");
    });

    it("Should check slot0 after PT1 quit", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const slot0 = await protocolContract.slot0();

      expect(slot0.tick).to.be.equal(24);
      expect(slot0.premiumRate).to.be.equal("3000000000000000000000000000");
      expect(slot0.emissionRate).to.be.equal("18000000000000000000000000000");
      expect(slot0.hoursPerTick).to.be.equal("8000000000000000000000000000");
      expect(slot0.totalInsuredCapital).to.be.equal(
        "219000000000000000000000000000000"
      );
      expect(slot0.currentPremiumSpent).to.be.equal(
        "96000000000000000000000000000"
      );
      expect(slot0.cumulatedPremiumSpent).to.be.equal(
        "96000000000000000000000000000"
      );
      expect(slot0.remainingPolicies).to.be.equal(1);
      expect(slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime()
      );

      const availableCapital = await protocolContract.availableCapital();

      expect(availableCapital).to.be.equal("730000000000000000000000000000000");
    });
  });

  describe("Should withdraw policy of PT2 after 10 days withdrawed of PT1", () => {
    it("Should withdraw policy", async () => {
      await HardhatHelper.setNextBlockTimestamp(10 * 24 * 60 * 60);
      const tx = await ProtocolHelper.getAthenaContract()
        .connect(policyTaker2)
        .withdrawPolicy(0);

      const result = await tx.wait();
      const event = result.events[1];

      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker2,
        0
      );

      const decodedData = protocolContract.interface.decodeEventLog(
        event.topics[0],
        event.data
      );

      expect(decodedData.owner).to.be.equal(await policyTaker2.getAddress());
      expect(decodedData.remainedAmount).to.be.equal("8556");
    });

    it("Should check slot0 after PT2 quit", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const slot0 = await protocolContract.slot0();

      expect(slot0.tick).to.be.equal(54);
      expect(slot0.premiumRate).to.be.equal("1000000000000000000000000000");
      expect(slot0.emissionRate).to.be.equal("0");
      expect(slot0.hoursPerTick).to.be.equal("24000000000000000000000000000");
      expect(slot0.totalInsuredCapital).to.be.equal("0");
      expect(slot0.currentPremiumSpent).to.be.equal(
        "276000000000000000000000000000"
      );
      expect(slot0.cumulatedPremiumSpent).to.be.equal(
        "276000000000000000000000000000"
      );
      expect(slot0.remainingPolicies).to.be.equal(0);
      expect(slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime()
      );

      const availableCapital = await protocolContract.availableCapital();

      expect(availableCapital).to.be.equal("730000000000000000000000000000000");
    });
  });
});
