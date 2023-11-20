import chai, { expect } from "chai";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "../helpers/HardhatHelper";
import ProtocolHelper from "../helpers/ProtocolHelper";

chai.use(chaiAsPromised);

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
let policyTaker1: ethers.Signer;
let policyTaker2: ethers.Signer;

export function testPolicyView() {
  describe("View policy", () => {
    before(async () => {
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
        1 * 24 * 60 * 60,
      );

      const USDT_amount2 = "330000";
      const ATEN_amount2 = "9000000";
      await ProtocolHelper.deposit(
        liquidityProvider2,
        USDT_amount2,
        ATEN_amount2,
        [0, 1, 2],
        1 * 24 * 60 * 60,
      );

      await HardhatHelper.USDT_maxApprove(
        policyTaker1,
        ProtocolHelper.getAthenaContract().address,
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
        20 * 24 * 60 * 60,
      );

      await HardhatHelper.USDT_maxApprove(
        policyTaker2,
        ProtocolHelper.getAthenaContract().address,
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
        10 * 24 * 60 * 60,
      );
    });

    describe("Should view actualize", () => {
      it("Should get vSlot0 after 10 days", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0,
        );

        const days = 10;
        const result = await protocolContract.actualizingUntilGivenDate(
          (await HardhatHelper.getCurrentTime()) + days * 24 * 60 * 60,
        );

        expect(result.__slot0.tick).to.be.equal(60);
        // expect(result.__slot0.premiumRate).to.be.equal(
        //   "4000000000000000000000000000"
        // );
        expect(result.__slot0.secondsPerTick).to.be.equal(6 * 60 * 60);
        expect(result.__slot0.totalInsuredCapital).to.be.equal(328500);
        expect(result.__slot0.remainingPolicies).to.be.equal(2);
        expect(result.__slot0.lastUpdateTimestamp).to.be.equal(
          (await HardhatHelper.getCurrentTime()) + days * 24 * 60 * 60,
        );
      });

      it("Should get vSlot0 after 178 days", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0,
        );

        const days = 178;
        const result = await protocolContract.actualizingUntilGivenDate(
          (await HardhatHelper.getCurrentTime()) + days * 24 * 60 * 60,
        );

        // console.log("vSlot0 178:", result);

        expect(result.__slot0.tick).to.be.equal(731);
        // expect(result.__slot0.premiumRate).to.be.equal(
        //   "3000000000000000000000000000"
        // );
        expect(result.__slot0.secondsPerTick).to.be.equal(28800);
        expect(result.__slot0.totalInsuredCapital).to.be.equal(219000);
        expect(result.__slot0.remainingPolicies).to.be.equal(1);
        expect(result.__slot0.lastUpdateTimestamp).to.be.equal(
          (await HardhatHelper.getCurrentTime()) + days * 24 * 60 * 60,
        );

        expect(result.__liquidityIndex).to.be.equal(
          "8847945585996955859969557",
        );
      });

      it("Should get vSlot0 after 428 days", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0,
        );

        const days = 428;
        const result = await protocolContract.actualizingUntilGivenDate(
          (await HardhatHelper.getCurrentTime()) + days * 24 * 60 * 60,
        );

        expect(result.__slot0.tick).to.be.equal(1480);
        // expect(result.__slot0.premiumRate).to.be.equal(
        //   "1000000000000000000000000000"
        // );
        expect(result.__slot0.secondsPerTick).to.be.equal(24 * 60 * 60);
        expect(result.__slot0.totalInsuredCapital).to.be.equal(0);
        expect(result.__slot0.remainingPolicies).to.be.equal(0);
        expect(result.__slot0.lastUpdateTimestamp).to.be.equal(
          (await HardhatHelper.getCurrentTime()) + days * 24 * 60 * 60,
        );
      });
    });

    describe("Should view info of PT1 after 10 days and arriving of PT2", () => {
      it("Should get info via protocol contract", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          0,
        );

        const coverId = await ProtocolHelper.getAccountCoverIdByIndex(
          policyTaker1,
          0,
        );
        const response = await protocolContract.getInfo(coverId);

        expect(response.__premiumLeft).to.be.equal("2130");
        expect(response.__currentEmissionRate).to.be.equal("12");
        expect(response.__remainingSeconds).to.be.equal("15336000");
      });
    });

    describe("Should withdraw policy of PT1 after 1 days arriving of PT2", () => {
      it("Should withdraw policy", async () => {
        await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);
        const tx = await ProtocolHelper.getAthenaContract()
          .connect(policyTaker1)
          .withdrawPolicy(0);

        const result = await tx.wait();
        // console.log(result);
        const event = result?.events?.[2];

        if (!event) throw new Error("Event not found");

        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          0,
        );

        const decodedData = protocolContract.interface.decodeEventLog(
          event.topics[0],
          event.data,
        );

        expect(decodedData.coverId.toNumber()).to.be.equal(0);
        expect(decodedData.remainedAmount).to.be.equal("2118");
      });

      it("Should check slot0 after PT1 quit", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0,
        );

        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(24);
        expect(slot0.secondsPerTick).to.be.equal(8 * 60 * 60);
        expect(slot0.totalInsuredCapital).to.be.equal("219000");
        expect(slot0.remainingPolicies).to.be.equal(1);
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          await HardhatHelper.getCurrentTime(),
        );

        const premiumRate = await protocolContract.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("3000000000000000000000000000");

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal("730000");
      });
    });

    describe("Should withdraw policy of PT2 after 10 days withdrawed of PT1", () => {
      it("Should withdraw policy", async () => {
        await HardhatHelper.setNextBlockTimestamp(10 * 24 * 60 * 60);
        const tx = await ProtocolHelper.getAthenaContract()
          .connect(policyTaker2)
          .withdrawPolicy(1);

        const result = await tx.wait();
        const event = result?.events?.[2];

        if (!event) throw new Error("Event not found");

        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker2,
          0,
        );

        const decodedData = protocolContract.interface.decodeEventLog(
          event.topics[0],
          event.data,
        );

        expect(decodedData.coverId.toNumber()).to.be.equal(1);
        expect(decodedData.remainedAmount).to.be.equal("8556");
      });

      it("Should check slot0 after PT2 quit", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0,
        );

        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(54);
        expect(slot0.secondsPerTick).to.be.equal(24 * 60 * 60);
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal(0);
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          await HardhatHelper.getCurrentTime(),
        );

        const premiumRate = await protocolContract.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("1000000000000000000000000000");

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal("730000");
      });
    });
  });
}
