import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "./helpers/HardhatHelper";
import ProtocolHelper from "./helpers/ProtocolHelper";

chai.use(chaiAsPromised);

const bn = (num: string | number) => hre_ethers.BigNumber.from(num);

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
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
    policyTaker1 = allSigners[100];
    policyTaker2 = allSigners[101];
    policyTaker3 = allSigners[102];

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
      [USDT_amount1, USDT_amount1]
    );

    const USDT_amount2 = "330000";
    const ATEN_amount2 = "9000000";
    await ProtocolHelper.deposit(
      liquidityProvider2,
      USDT_amount2,
      ATEN_amount2,
      [0, 1, 2],
      [USDT_amount2, USDT_amount2, USDT_amount2]
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

  describe("Claim", async () => {
    it("Should check slot0 in protocol 0 before claim", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker2,
        0
      );
      const slot0 = await protocolContract.slot0();

      expect(slot0.tick).to.be.equal(20);
      expect(slot0.premiumRate).to.be.equal("4000000000000000000000000000");
      expect(slot0.emissionRate).to.be.equal("36000000000000000000000000000");
      expect(slot0.hoursPerTick).to.be.equal("6000000000000000000000000000");
      expect(slot0.totalInsuredCapital).to.be.equal(
        "328500000000000000000000000000000"
      );
      expect(slot0.premiumSpent).to.be.equal("60000000000000000000000000000");
      expect(slot0.remainingPolicies).to.be.equal("2");
      expect(slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime()
      );

      const availableCapital = await protocolContract.availableCapital();

      expect(availableCapital).to.be.equal("730000000000000000000000000000000");
    });

    it("Should check intersectingAmounts in protocol 0 before claim", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker2,
        0
      );

      const intersecAmounts0 = await protocolContract.intersectingAmounts(0);
      expect(intersecAmounts0).to.be.equal("730000000000000000000000000000000");

      const intersecAmounts1 = await protocolContract.intersectingAmounts(2);
      expect(intersecAmounts1).to.be.equal("330000000000000000000000000000000");

      const intersecAmounts2 = await protocolContract.intersectingAmounts(1);
      expect(intersecAmounts2).to.be.equal("730000000000000000000000000000000");
    });

    it("Should add claim of policyTaker3 in Protocol 2", async () => {
      HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);

      await ProtocolHelper.getAthenaContract()
        .connect(owner)
        .addClaim(await policyTaker3.getAddress(), 2, 182500);

      const protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );
      const claim = await protocolPool0.claims(0);

      expect(claim.disputeId).to.be.equal(2);
      expect(claim.amount).to.be.equal("182500000000000000000000000000000");
      expect(claim.ratio).to.be.equal("250000000000000000000000000");
      expect(claim.createdAt).to.be.equal(HardhatHelper.getCurrentTime());
      expect(claim.availableCapitalBefore).to.be.equal(0);
      expect(claim.premiumSpentBefore).to.be.equal(0);

      const claimIndex = await protocolPool0.claimIndex();
      expect(claimIndex).to.be.equal(0);
    });

    it("Should check slot0 in Protocol 0 at the moment of adding claim in Protocol 2", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker2,
        0
      );
      const slot0 = await protocolContract.slot0();

      expect(slot0.tick).to.be.equal(24);
      expect(slot0.premiumRate).to.be.equal("4000000000000000000000000000");
      expect(slot0.emissionRate).to.be.equal("36000000000000000000000000000");
      expect(slot0.hoursPerTick).to.be.equal("6000000000000000000000000000");
      expect(slot0.totalInsuredCapital).to.be.equal(
        "328500000000000000000000000000000"
      );
      expect(slot0.premiumSpent).to.be.equal("96000000000000000000000000000");
      expect(slot0.remainingPolicies).to.be.equal("2");
      expect(slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime()
      );

      const availableCapital = await protocolContract.availableCapital();

      expect(availableCapital).to.be.equal("730000000000000000000000000000000");
    });

    it("Should get vSlot0 of Protocol 0 after 1 day claimed in Protocol 2", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const days = 1;
      const view = await protocolContract.actualizingUntilGivenDate(
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(view.__slot0.tick).to.be.equal(29);
      expect(view.__slot0.premiumRate).to.be.equal(5);
      expect(view.__slot0.emissionRate).to.be.equal(45);
      expect(view.__slot0.hoursPerTick).to.be.equal(5); //Thao@NOTE: la vrai valeur est 4,8 mais arrondi par RayMath
      expect(view.__slot0.totalInsuredCapital).to.be.equal(328500);
      expect(view.__slot0.premiumSpent).to.be.equal(45);
      expect(view.__slot0.remainingPolicies).to.be.equal(2);
      expect(view.__slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(view.__availableCapital).to.be.equal(730000 - 182500);
    });

    it("Should actualizing after 1 day of adding claim, checking intersectingAmounts and slot0", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);
      await protocolContract.actualizingTest();

      const intersecAmounts0 = await protocolContract.intersectingAmounts(0);
      expect(intersecAmounts0).to.be.equal("730000000000000000000000000000000");

      const intersecAmounts1 = await protocolContract.intersectingAmounts(2);
      expect(intersecAmounts1).to.be.equal("330000000000000000000000000000000");

      const intersecAmounts2 = await protocolContract.intersectingAmounts(1);
      expect(intersecAmounts2).to.be.equal("547500000000000000000000000000000");

      const slot0 = await protocolContract.slot0();
      expect(slot0.tick).to.be.equal(29);
      expect(slot0.premiumRate).to.be.equal("5000000000000000000000000000");
      expect(slot0.emissionRate).to.be.equal("45000000000000000000000000000");
      expect(slot0.hoursPerTick).to.be.equal("4800000000000000000000000000");
      expect(slot0.totalInsuredCapital).to.be.equal(
        "328500000000000000000000000000000"
      );
      expect(slot0.premiumSpent).to.be.equal("45000000000000000000000000000");
      expect(slot0.remainingPolicies).to.be.equal(2);
      expect(slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime()
      );

      const availableCapital = await protocolContract.availableCapital();
      expect(availableCapital).to.be.equal("547500000000000000000000000000000");
    });

    it("Should check availableCapitalBefore and premiumSpentBefore", async () => {
      const protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );
      const claim = await protocolPool0.claims(0);

      expect(claim.disputeId).to.be.equal(2);
      expect(claim.amount).to.be.equal("182500000000000000000000000000000");
      expect(claim.ratio).to.be.equal("250000000000000000000000000");
      expect(claim.createdAt).to.be.equal(
        HardhatHelper.getCurrentTime() - 1 * 24 * 60 * 60
      );
      expect(claim.availableCapitalBefore).to.be.equal(
        "730000000000000000000000000000000"
      );
      expect(claim.premiumSpentBefore).to.be.equal(
        "96000000000000000000000000000"
      );

      const claimIndex = await protocolPool0.claimIndex();
      expect(claimIndex).to.be.equal(1);
    });
  });
});
