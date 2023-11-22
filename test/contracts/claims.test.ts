import chai, { expect } from "chai";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "../helpers/hardhat";
import ProtocolHelper from "../helpers/protocol";

chai.use(chaiAsPromised);

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
let liquidityProvider3: ethers.Signer;
let policyTaker1: ethers.Signer;
let policyTaker2: ethers.Signer;
let policyTaker3: ethers.Signer;
let policyTaker4: ethers.Signer;
let protocolPool0: ethers.Contract;
let protocolPool1: ethers.Contract;
let protocolPool2: ethers.Contract;
let protocolPool3: ethers.Contract;

export function testClaims() {
  describe("Claims", function () {
    before(async function () {
      const allSigners = await HardhatHelper.allSigners();
      owner = allSigners[0];
      liquidityProvider1 = allSigners[1];
      liquidityProvider2 = allSigners[2];
      liquidityProvider3 = allSigners[3];
      policyTaker1 = allSigners[100];
      policyTaker2 = allSigners[101];
      policyTaker3 = allSigners[102];
      policyTaker4 = allSigners[103];

      await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
      await ProtocolHelper.addNewProtocolPool("Test protocol 0");
      await ProtocolHelper.addNewProtocolPool("Test protocol 1");
      await ProtocolHelper.addNewProtocolPool("Test protocol 2");
      await ProtocolHelper.addNewProtocolPool("Test protocol 3");

      protocolPool0 = await ProtocolHelper.getProtocolPoolContract(owner, 0);
      protocolPool1 = await ProtocolHelper.getProtocolPoolContract(owner, 1);
      protocolPool2 = await ProtocolHelper.getProtocolPoolContract(owner, 2);
      protocolPool3 = await ProtocolHelper.getProtocolPoolContract(owner, 3);

      // ================= Cover Providers ================= //

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

      const USDT_amount3 = "365000";
      const ATEN_amount3 = "9000000";
      await ProtocolHelper.deposit(
        liquidityProvider3,
        USDT_amount3,
        ATEN_amount3,
        [1, 3],
        1 * 24 * 60 * 60,
      );

      // ================= Policy Buyers ================= //

      await HardhatHelper.USDT_maxApprove(
        policyTaker3,
        ProtocolHelper.getAthenaContract().address,
      );

      const capital3 = "182500";
      const premium3 = "8760";
      const atensLocked3 = "0";
      await ProtocolHelper.buyPolicy(
        policyTaker3,
        capital3,
        premium3,
        atensLocked3,
        2,
        10 * 24 * 60 * 60,
      );

      await HardhatHelper.USDT_maxApprove(
        policyTaker4,
        ProtocolHelper.getAthenaContract().address,
      );

      await ProtocolHelper.buyPolicy(
        policyTaker4,
        capital3,
        premium3,
        atensLocked3,
        3,
        10 * 24 * 60 * 60,
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

    describe("Claim", async function () {
      it("Should check slot0 in protocol 0 before claim", async function () {
        const slot0 = await protocolPool0.slot0();

        expect(slot0.tick).to.be.equal(20);
        expect(slot0.secondsPerTick).to.be.equal(6 * 60 * 60);
        expect(slot0.totalInsuredCapital).to.be.equal("328500");
        expect(slot0.remainingPolicies).to.be.equal("2");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          await HardhatHelper.getCurrentTime(),
        );

        const premiumRate = await protocolPool0.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("4000000000000000000000000000");

        const availableCapital = await protocolPool0.availableCapital();

        expect(availableCapital).to.be.equal("730000");
      });

      it("Should check intersectingAmounts in protocol 0 before claim", async function () {
        const intersecAmountsP0 = await protocolPool0.intersectingAmounts(0);
        expect(intersecAmountsP0).to.be.equal("730000");

        const intersecAmountsP1 = await protocolPool0.intersectingAmounts(2);
        expect(intersecAmountsP1).to.be.equal("330000");

        const intersecAmountsP2 = await protocolPool0.intersectingAmounts(1); //P2 at index 1
        expect(intersecAmountsP2).to.be.equal("730000");
      });

      it("Should add claim in Protocol 2", async function () {
        await ProtocolHelper.createClaim(policyTaker3, 0, "182500");

        await ProtocolHelper.resolveClaimWithoutDispute(
          policyTaker3,
          0,
          14 * 24 * 60 * 60 + 10, // 14 days + 10 seconds
        );

        const claim = await protocolPool0.processedClaims(0);

        expect(claim.fromPoolId).to.be.equal(2);
        expect(claim.ratio).to.be.equal("250000000000000000000000000");
        expect(claim.liquidityIndexBeforeClaim).to.be.equal(
          "772609969558599695585996",
        );
      });

      it("Should check number of claim in protocol 0", async function () {
        const length = await protocolPool0.claimsCount();
        expect(length).to.be.equal(1);
      });

      it("Should check number of claim in protocol 1", async function () {
        const length = await protocolPool1.claimsCount();
        expect(length).to.be.equal(1);
      });

      it("Should check number of claim in protocol 2", async function () {
        const length = await protocolPool2.claimsCount();
        expect(length).to.be.equal(1);
      });

      it("Should check number of claim in protocol 3", async function () {
        const length = await protocolPool3.claimsCount();
        expect(length).to.be.equal(0);
      });

      it("Should check slot0 in Protocol 0 at the moment of adding claim in Protocol 2", async function () {
        const slot0 = await protocolPool0.slot0();

        expect(slot0.tick).to.be.equal(76);
        expect(slot0.secondsPerTick).to.be.equal(48 * 6 * 60);
        expect(slot0.totalInsuredCapital).to.be.equal("328500");
        expect(slot0.remainingPolicies).to.be.equal("2");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          await HardhatHelper.getCurrentTime(),
        );

        const premiumRate = await protocolPool0.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("5000000000000000000000000000");

        const availableCapital = await protocolPool0.availableCapital();

        expect(availableCapital).to.be.equal("547500");
      });

      it("Should get vSlot0 of Protocol 0 after 1 day claimed in Protocol 2", async function () {
        const days = 1;
        const result = await protocolPool0.actualizingUntilGivenDate(
          (await HardhatHelper.getCurrentTime()) + days * 24 * 60 * 60,
        );

        expect(result.__slot0.tick).to.be.equal(81);
        expect(result.__slot0.secondsPerTick).to.be.equal(48 * 6 * 60);
        expect(result.__slot0.totalInsuredCapital).to.be.equal(328500);
        expect(result.__slot0.remainingPolicies).to.be.equal(2);
        expect(result.__slot0.lastUpdateTimestamp).to.be.equal(
          (await HardhatHelper.getCurrentTime()) + days * 24 * 60 * 60,
        );
      });

      it("Should actualizing after 1 day of adding claim, checking intersectingAmounts and slot0 in protocol 0", async function () {
        await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);
        await ProtocolHelper.getAthenaContract()
          .connect(owner)
          .actualizingProtocolAndRemoveExpiredPolicies(protocolPool0.address);

        const intersecAmounts0 = await protocolPool0.intersectingAmounts(0);
        expect(intersecAmounts0).to.be.equal("730000");

        const intersecAmounts1 = await protocolPool0.intersectingAmounts(2);
        expect(intersecAmounts1).to.be.equal("330000");

        const intersecAmounts2 = await protocolPool0.intersectingAmounts(1);
        expect(intersecAmounts2).to.be.equal("547500");

        const slot0 = await protocolPool0.slot0();
        expect(slot0.tick).to.be.equal(81);
        expect(slot0.secondsPerTick).to.be.equal(48 * 6 * 60);
        expect(slot0.totalInsuredCapital).to.be.equal("328500");
        expect(slot0.remainingPolicies).to.be.equal(2);
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          await HardhatHelper.getCurrentTime(),
        );

        const premiumRate = await protocolPool0.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("5000000000000000000000000000");

        const availableCapital = await protocolPool0.availableCapital();
        expect(availableCapital).to.be.equal("547500");
      });

      it("Should check added claim in protocol 0", async function () {
        const claim = await protocolPool0.processedClaims(0);

        expect(claim.fromPoolId).to.be.equal(2);
        expect(claim.ratio).to.be.equal("250000000000000000000000000");
        expect(claim.liquidityIndexBeforeClaim).to.be.equal(
          "772609969558599695585996",
        );
      });

      it("Should add claim in protocol 3", async function () {
        await ProtocolHelper.createClaim(policyTaker4, 1, "182500");

        await ProtocolHelper.resolveClaimWithoutDispute(
          policyTaker4,
          1,
          14 * 24 * 60 * 60 + 10, // 14 days + 10 seconds
        );

        const claim = await protocolPool1.processedClaims(1);

        expect(claim.fromPoolId).to.be.equal(3);
        expect(claim.ratio).to.be.equal("500000000000000000000000000");
        expect(claim.liquidityIndexBeforeClaim).to.be.equal("0");
      });
    });
  });
}
