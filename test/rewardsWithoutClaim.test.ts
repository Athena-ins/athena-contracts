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

    it(`Should call _rewardsOf for LP1 after ${days} days of PT2 bought his policy`, async () => {
      days = 1;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(30 + 18 * days);
    });

    it(`Should call _rewardsOf for LP2 after ${days} days of PT2 bought his policy`, async () => {
      days = 1;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider2.getAddress(),
        365000,
        [0, 1],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(30 + 18 * days);
    });

    days = 2;

    it(`Should call _rewardsOf for LP1 after ${days} days of PT2 bought his policy`, async () => {
      days = 2;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(30 + 18 * days);
    });

    it(`Should call _rewardsOf for LP2 after ${days} days of PT2 bought his policy`, async () => {
      days = 2;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider2.getAddress(),
        365000,
        [0, 1],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(30 + 18 * days);
    });

    days = 10;

    it(`Should call _rewardsOf for LP1 after ${days} days of PT2 bought his policy`, async () => {
      days = 10;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(30 + 18 * days);
    });

    it(`Should call _rewardsOf for LP2 after ${days} days of PT2 bought his policy`, async () => {
      days = 10;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
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

    let days = 1;

    it(`Should call _rewardsOf for LP1 after ${days} days of LP2 deposit`, async () => {
      days = 1;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(90 + 30 + 9 * days);
    });

    it(`Should call _rewardsOf for LP2 after ${days} days of LP2 deposit`, async () => {
      days = 1;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider2.getAddress(),
        365000,
        [0, 1],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(9 * days);
    });

    days = 2;

    it(`Should call _rewardsOf for LP1 after ${days} days of LP2 deposit`, async () => {
      days = 2;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(90 + 30 + 9 * days);
    });

    it(`Should call _rewardsOf for LP2 after ${days} days of LP2 deposit`, async () => {
      days = 2;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider2.getAddress(),
        365000,
        [0, 1],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(9 * days);
    });

    days = 10;

    it(`Should call _rewardsOf for LP1 after ${days} days of LP2 deposit`, async () => {
      days = 10;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(90 + 30 + 9 * days);
    });

    it(`Should call _rewardsOf for LP2 after ${days} days of LP2 deposit`, async () => {
      days = 10;

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider2.getAddress(),
        365000,
        [0, 1],
        HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(9 * days);
    });
  });
});
