import chai, { expect } from "chai";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "./helpers/HardhatHelper";
import ProtocolHelper from "./helpers/ProtocolHelper";

chai.use(chaiAsPromised);

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
let liquidityProvider3: ethers.Signer;
let policyTaker1: ethers.Signer;
let policyTaker2: ethers.Signer;
let policyTaker3: ethers.Signer;

describe("Claims", () => {
  before(async () => {
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

    const USDT_amount3 = "365000";
    const ATEN_amount3 = "9000000";
    await ProtocolHelper.deposit(
      liquidityProvider3,
      USDT_amount3,
      ATEN_amount3,
      [1, 3],
      1 * 24 * 60 * 60
    );

    await HardhatHelper.USDT_maxApprove(
      policyTaker3,
      ProtocolHelper.getAthenaContract().address
    );

    const capital3 = "328500";
    const premium3 = "8760";
    const atensLocked3 = "0";
    await ProtocolHelper.buyPolicy(
      policyTaker3,
      capital3,
      premium3,
      atensLocked3,
      3,
      10 * 24 * 60 * 60
    );

    await HardhatHelper.USDT_maxApprove(
      policyTaker1,
      ProtocolHelper.getAthenaContract().address
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
  });

  describe("Claim", async () => {
    it("Should check slot0 in protocol 0 before claim", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker2,
        0
      );
      const slot0 = await protocolContract.slot0();

      expect(slot0.tick).to.be.equal(20);
      expect(slot0.secondsPerTick).to.be.equal(6 * 60 * 60);
      expect(slot0.totalInsuredCapital).to.be.equal("328500");
      expect(slot0.remainingPolicies).to.be.equal("2");
      expect(slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime()
      );

      const premiumRate = await protocolContract.getCurrentPremiumRate();
      expect(premiumRate).to.be.equal("4000000000000000000000000000");

      const availableCapital = await protocolContract.availableCapital();

      expect(availableCapital).to.be.equal("730000");
    });

    it("Should check intersectingAmounts in protocol 0 before claim", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker2,
        0
      );

      const intersecAmounts0 = await protocolContract.intersectingAmounts(0);
      expect(intersecAmounts0).to.be.equal("730000");

      const intersecAmounts1 = await protocolContract.intersectingAmounts(2);
      expect(intersecAmounts1).to.be.equal("330000");

      const intersecAmounts2 = await protocolContract.intersectingAmounts(1);
      expect(intersecAmounts2).to.be.equal("730000");
    });

    it("Should resolve claim in Protocol 0", async () => {
      await ProtocolHelper.resolveClaimWithoutDispute(
        owner,
        1,
        1 * 24 * 60 * 60
      );

      const protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );
      const claim = await protocolPool0.processedClaims(0);

      expect(claim.fromProtocolId).to.be.equal(0);
      expect(claim.ratio).to.be.equal("250000000000000000000000000");
      expect(claim.liquidityIndexBeforeClaim).to.be.equal(
        "131506849315068493150684"
      );
    });

    it("Should check number of claim in protocol 0", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker2,
        0
      );

      const length = await protocolContract.claimsCount();
      expect(length).to.be.equal(1);
    });

    it("Should check number of claim in protocol 1", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker2,
        1
      );

      const length = await protocolContract.claimsCount();
      expect(length).to.be.equal(1);
    });

    it("Should check number of claim in protocol 2", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker2,
        2
      );

      const length = await protocolContract.claimsCount();
      expect(length).to.be.equal(1);
    });

    it("Should check number of claim in protocol 3", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker2,
        3
      );

      const length = await protocolContract.claimsCount();
      expect(length).to.be.equal(0);
    });

    it("Should check slot0 in Protocol 0 at the moment of adding claim in Protocol 2", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker2,
        0
      );
      const slot0 = await protocolContract.slot0();

      expect(slot0.tick).to.be.equal(24);
      expect(slot0.secondsPerTick).to.be.equal(48 * 6 * 60);
      expect(slot0.totalInsuredCapital).to.be.equal("328500");
      expect(slot0.remainingPolicies).to.be.equal("2");
      expect(slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime()
      );

      const premiumRate = await protocolContract.getCurrentPremiumRate();
      expect(premiumRate).to.be.equal("5000000000000000000000000000");

      const availableCapital = await protocolContract.availableCapital();

      expect(availableCapital).to.be.equal("547500");
    });

    it("Should get vSlot0 of Protocol 0 after 1 day claimed in Protocol 2", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const days = 1;
      const result = await protocolContract.actualizingUntilGivenDate(
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__slot0.tick).to.be.equal(29);
      // expect(result.__slot0.premiumRate).to.be.equal(
      //   "5000000000000000000000000000"
      // );
      expect(result.__slot0.secondsPerTick).to.be.equal(48 * 6 * 60);
      expect(result.__slot0.totalInsuredCapital).to.be.equal(328500);
      expect(result.__slot0.remainingPolicies).to.be.equal(2);
      expect(result.__slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );
    });

    it("Should actualizing after 1 day of adding claim, checking intersectingAmounts and slot0", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);
      await protocolContract.actualizing();

      const intersecAmounts0 = await protocolContract.intersectingAmounts(0);
      expect(intersecAmounts0).to.be.equal("547500");

      const intersecAmounts1 = await protocolContract.intersectingAmounts(2);
      expect(intersecAmounts1).to.be.equal("330000");

      const intersecAmounts2 = await protocolContract.intersectingAmounts(1);
      expect(intersecAmounts2).to.be.equal("730000");

      const slot0 = await protocolContract.slot0();
      expect(slot0.tick).to.be.equal(29);
      expect(slot0.secondsPerTick).to.be.equal(48 * 6 * 60);
      expect(slot0.totalInsuredCapital).to.be.equal("328500");
      expect(slot0.remainingPolicies).to.be.equal(2);
      expect(slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime()
      );

      const premiumRate = await protocolContract.getCurrentPremiumRate();
      expect(premiumRate).to.be.equal("5000000000000000000000000000");

      const availableCapital = await protocolContract.availableCapital();
      expect(availableCapital).to.be.equal("547500");
    });

    it("Should check added claim in protocol 0", async () => {
      const protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );
      const claim = await protocolPool0.processedClaims(0);

      expect(claim.fromProtocolId).to.be.equal(0);
      expect(claim.ratio).to.be.equal("250000000000000000000000000");
      expect(claim.liquidityIndexBeforeClaim).to.be.equal(
        "131506849315068493150684"
      );
    });

    it("Should resolve claim in protocol 3 and check info in its related protocols", async () => {
      await ProtocolHelper.resolveClaimWithoutDispute(
        owner,
        0,
        1 * 24 * 60 * 60
      );

      const protocolPool1 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        1
      );
      const claim = await protocolPool1.processedClaims(1);

      expect(claim.fromProtocolId).to.be.equal(3);
      expect(claim.ratio).to.be.equal("500000000000000000000000000");
      expect(claim.liquidityIndexBeforeClaim).to.be.equal("0");

      const protocolPool3 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        3
      );
      const claim3 = await protocolPool3.processedClaims(0);

      expect(claim3.fromProtocolId).to.be.equal(3);
      expect(claim3.ratio).to.be.equal("500000000000000000000000000");
      expect(claim3.liquidityIndexBeforeClaim.gt(0)).to.be.equal(true);
    });
  });
});
