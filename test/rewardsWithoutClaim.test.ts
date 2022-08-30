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
let policyTaker3: ethers.Signer;

describe("Liquidity provider rewards", () => {
  describe("LP1, LP2 then PT1, PT2 in pool 0", async () => {
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

      const USDT_amount1 = "365000";
      const ATEN_amount1 = "100000";
      await ProtocolHelper.deposit(
        liquidityProvider1,
        USDT_amount1,
        ATEN_amount1,
        [0, 2],
        1 * 24 * 60 * 60
      );

      const USDT_amount2 = "365000";
      const ATEN_amount2 = "9000000";
      await ProtocolHelper.deposit(
        liquidityProvider2,
        USDT_amount2,
        ATEN_amount2,
        [0, 1],
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

    let days = 1;

    it(`Should call _getLPInfoUntil for LP1 after ${days} days of PT2 bought his policy`, async () => {
      days = 1;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._getLPInfoUntil(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(30 + 18 * days);
    });

    it(`Should call _getLPInfoUntil for LP2 after ${days} days of PT2 bought his policy`, async () => {
      days = 1;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._getLPInfoUntil(
        await liquidityProvider2.getAddress(),
        365000,
        [0, 1],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(30 + 18 * days);
    });

    days = 2;

    it(`Should call _getLPInfoUntil for LP1 after ${days} days of PT2 bought his policy`, async () => {
      days = 2;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._getLPInfoUntil(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(30 + 18 * days);
    });

    it(`Should call _getLPInfoUntil for LP2 after ${days} days of PT2 bought his policy`, async () => {
      days = 2;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._getLPInfoUntil(
        await liquidityProvider2.getAddress(),
        365000,
        [0, 1],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(30 + 18 * days);
    });

    days = 10;

    it(`Should call _getLPInfoUntil for LP1 after ${days} days of PT2 bought his policy`, async () => {
      days = 10;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._getLPInfoUntil(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(30 + 18 * days);
    });

    it(`Should call _getLPInfoUntil for LP2 after ${days} days of PT2 bought his policy`, async () => {
      days = 10;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._getLPInfoUntil(
        await liquidityProvider2.getAddress(),
        365000,
        [0, 1],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(30 + 18 * days);
    });
  });

  describe("LP1 then PT1, PT2 then LP2 in pool 0", async () => {
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

      const USDT_amount1 = "365000";
      const ATEN_amount1 = "100000";
      await ProtocolHelper.deposit(
        liquidityProvider1,
        USDT_amount1,
        ATEN_amount1,
        [0, 2],
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

      const capital2 = "109500";
      const premium2 = "4380";
      const atensLocked2 = "0";
      await ProtocolHelper.buyPolicy(
        policyTaker2,
        capital2,
        premium2,
        atensLocked2,
        0,
        10 * 24 * 60 * 60
      );

      const USDT_amount2 = "365000";
      const ATEN_amount2 = "9000000";
      await ProtocolHelper.deposit(
        liquidityProvider2,
        USDT_amount2,
        ATEN_amount2,
        [0, 1],
        1 * 24 * 60 * 60
      );

      //PT1: UR = 30%; PR = 3%; ER = 9, (PT1 -> 9)
      //10 days => LP1 <- 9 * 10 = 90; PT1 <- 2190 - 90 = 2100
      //PT2: UR = 60%; PR = 5%; ER = 30, (PT1 -> 15; PT2 -> 15)
      //1 day => LP1 <- 30 + 90 = 120; PT1 <- 2100 - 15 = 2085; PT2 <- 4380 - 15 = 4365
      //LP2: UR = 30%; PR = 3%; ER = 18 (PT1 -> 9; PT2 -> 9)
    });

    it("Should check policy1 initial info", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker1,
        0
      );
      const policyInfo = await protocolContract.premiumPositions(
        await policyTaker1.getAddress()
      );

      expect(policyInfo.capitalInsured).to.be.equal("109500");
      expect(policyInfo.beginPremiumRate).to.be.equal(
        "3000000000000000000000000000"
      );
      expect(policyInfo.ownerIndex).to.be.equal("0");
      expect(policyInfo.lastTick).to.be.equal(730);
    });

    it("Should get policy1 remaning info", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker1,
        0
      );

      const response = await protocolContract.getInfo(
        await policyTaker1.getAddress()
      );

      expect(response.__remainingPremium).to.be.equal(2085);
      expect(response.__remainingDay).to.be.equal(231);
    });

    it("Should check policy2 initial info", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker2,
        0
      );
      const policyInfo = await protocolContract.premiumPositions(
        await policyTaker2.getAddress()
      );

      expect(policyInfo.capitalInsured).to.be.equal("109500");
      expect(policyInfo.beginPremiumRate).to.be.equal(
        "5000000000000000000000000000"
      );
      expect(policyInfo.ownerIndex).to.be.equal("0");
      expect(policyInfo.lastTick).to.be.equal(1490);
    });

    it("Should get policy2 remaning info", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker1,
        0
      );

      const response = await protocolContract.getInfo(
        await policyTaker2.getAddress()
      );

      expect(response.__remainingPremium).to.be.equal(4365);
      expect(response.__remainingDay).to.be.equal(611);
    });

    it("Should check LP1's info", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let lpInfo = await protocolPool0.LPsInfo(liquidityProvider1.getAddress());
      expect(lpInfo.beginLiquidityIndex).to.be.equal(0);
      expect(lpInfo.beginClaimIndex).to.be.equal(0);
    });

    it("Should check LP2's info", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let lpInfo = await protocolPool0.LPsInfo(liquidityProvider2.getAddress());
      expect(lpInfo.beginLiquidityIndex).to.not.be.equal(0);
      expect(lpInfo.beginClaimIndex).to.be.equal(0);
    });

    describe("rewards after 1 days", async () => {
      const days = 1;

      it(`Should call _getLPInfoUntil for LP1`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider1.getAddress(),
          365000,
          [0, 2],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(90 + 30 + 9 * days);
      });

      it(`Should call _getLPInfoUntil for LP2`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider2.getAddress(),
          365000,
          [0, 1],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(9 * days);
      });
    });

    describe("rewards after 2 days", async () => {
      const days = 2;

      it(`Should call _getLPInfoUntil for LP1`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider1.getAddress(),
          365000,
          [0, 2],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(90 + 30 + 9 * days);
      });

      it(`Should call _getLPInfoUntil for LP2`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider2.getAddress(),
          365000,
          [0, 1],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(9 * days);
      });
    });

    describe("rewards after 10 days", async () => {
      const days = 10;

      it(`Should call _getLPInfoUntil for LP1`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider1.getAddress(),
          365000,
          [0, 2],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(90 + 30 + 9 * days);
      });

      it(`Should call _getLPInfoUntil for LP2`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider2.getAddress(),
          365000,
          [0, 1],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(9 * days);
      });
    });

    describe("rewards after 122 days", async () => {
      const days = 122;

      it(`Should call _getLPInfoUntil for LP1`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider1.getAddress(),
          365000,
          [0, 2],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(90 + 30 + 9 * days);
      });

      it(`Should call _getLPInfoUntil for LP2`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider2.getAddress(),
          365000,
          [0, 1],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(9 * days);
      });
    });

    describe("rewards after 611 days (the expired day of the last policy)", async () => {
      const days = 611;
      it(`Should call _getLPInfoUntil for LP1`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider1.getAddress(),
          365000,
          [0, 2],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(90 + 30 + 3223);
      });

      it(`Should call _getLPInfoUntil for LP2`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider2.getAddress(),
          365000,
          [0, 1],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(3223);
      });
    });

    describe("rewards after 612 days (after 1 day of all policies expired)", async () => {
      const days = 612;
      it(`Should call _getLPInfoUntil for LP1`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider1.getAddress(),
          365000,
          [0, 2],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(90 + 30 + 3225);
      });

      it(`Should call _getLPInfoUntil for LP2`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider2.getAddress(),
          365000,
          [0, 1],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(3225);
      });
    });

    describe("rewards after 613 days (after 2 days of all policies expired)", async () => {
      const days = 613;
      it(`Should call _getLPInfoUntil for LP1`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider1.getAddress(),
          365000,
          [0, 2],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(90 + 30 + 3225);
      });

      it(`Should call _getLPInfoUntil for LP2`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider2.getAddress(),
          365000,
          [0, 1],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(3225);
      });
    });

    describe("rewards after 1000 days (after 389 days of all policies expired)", async () => {
      const days = 1000;
      it(`Should call _getLPInfoUntil for LP1`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider1.getAddress(),
          365000,
          [0, 2],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(90 + 30 + 3225);
      });

      it(`Should call _getLPInfoUntil for LP2`, async () => {
        let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        let result = await protocolPool0._getLPInfoUntil(
          await liquidityProvider2.getAddress(),
          365000,
          [0, 1],
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(result.__finalUserCapital).to.be.equal(365000);
        expect(result.__totalRewards).to.be.equal(3225);
      });
    });
  });
});
