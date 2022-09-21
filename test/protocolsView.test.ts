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

const numberProtocol = 100;

describe("Liquidity provider withdraw", () => {
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

      for (let i = 0; i < numberProtocol; i++)
        await ProtocolHelper.addNewProtocolPool(`Test protocol ${i}`);

      const USDT_amount1 = "182500";
      const ATEN_amount1 = "100000";
      await ProtocolHelper.deposit(
        liquidityProvider1,
        USDT_amount1,
        ATEN_amount1,
        [0, 2],
        1 * 24 * 60 * 60
      );

      const USDT_amount2 = "547500";
      const ATEN_amount2 = "9000000";
      await ProtocolHelper.deposit(
        liquidityProvider2,
        USDT_amount2,
        ATEN_amount2,
        [0, 2],
        1 * 24 * 60 * 60
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
        2,
        10 * 24 * 60 * 60
      );
    });

    it("Should call Athena.protocolsView(beginId = 0, numberOfProtocols = 3)", async () => {
      const result = await ProtocolHelper.getAthenaContract()
        .connect(owner)
        .protocolsView(0, 3);

      //   console.log(result);

      expect(result.length).to.be.equal(3);

      expect(result[0].symbol).to.be.equal("APP_0");
      expect(result[0].name).to.be.equal("Test protocol 0");
      expect(result[0].protocolId).to.be.equal(0);
      expect(result[0].totalCouvrageValue).to.be.equal(109500);
      expect(result[0].availableCapacity).to.be.equal(620500);
      expect(result[0].utilizationRate).to.be.equal(
        "15000000000000000000000000000"
      );
      expect(result[0].premiumRate).to.be.equal("2000000000000000000000000000");

      expect(result[1].symbol).to.be.equal("APP_1");
      expect(result[1].name).to.be.equal("Test protocol 1");
      expect(result[1].protocolId).to.be.equal(1);
      expect(result[1].totalCouvrageValue).to.be.equal(0);
      expect(result[1].availableCapacity).to.be.equal(0);
      expect(result[1].utilizationRate).to.be.equal("0");
      expect(result[1].premiumRate).to.be.equal("1000000000000000000000000000");

      expect(result[2].symbol).to.be.equal("APP_2");
      expect(result[2].name).to.be.equal("Test protocol 2");
      expect(result[2].protocolId).to.be.equal(2);
      expect(result[2].totalCouvrageValue).to.be.equal(219000);
      expect(result[2].availableCapacity).to.be.equal(511000);
      expect(result[2].utilizationRate).to.be.equal(
        "30000000000000000000000000000"
      );
      expect(result[2].premiumRate).to.be.equal("3000000000000000000000000000");
    });

    it("Should call Athena.protocolsView(beginId = 23, numberOfProtocols = 2)", async () => {
      const result = await ProtocolHelper.getAthenaContract()
        .connect(owner)
        .protocolsView(23, 2);

      expect(result.length).to.be.equal(2);

      expect(result[0].symbol).to.be.equal("APP_23");
      expect(result[0].name).to.be.equal("Test protocol 23");
      expect(result[0].protocolId).to.be.equal(23);
      expect(result[0].totalCouvrageValue).to.be.equal(0);
      expect(result[0].availableCapacity).to.be.equal(0);
      expect(result[0].utilizationRate).to.be.equal("0");
      expect(result[0].premiumRate).to.be.equal("1000000000000000000000000000");

      expect(result[1].symbol).to.be.equal("APP_24");
      expect(result[1].name).to.be.equal("Test protocol 24");
      expect(result[1].protocolId).to.be.equal(24);
      expect(result[1].totalCouvrageValue).to.be.equal(0);
      expect(result[1].availableCapacity).to.be.equal(0);
      expect(result[1].utilizationRate).to.be.equal("0");
      expect(result[1].premiumRate).to.be.equal("1000000000000000000000000000");
    });

    it("Should call Athena.protocolsView(beginId = 99, numberOfProtocols = 10)", async () => {
      const result = await ProtocolHelper.getAthenaContract()
        .connect(owner)
        .protocolsView(99, 10);

      console.log(result);

      expect(result.length).to.be.equal(1);

      expect(result[0].symbol).to.be.equal("APP_99");
      expect(result[0].name).to.be.equal("Test protocol 99");
      expect(result[0].protocolId).to.be.equal(99);
      expect(result[0].totalCouvrageValue).to.be.equal(0);
      expect(result[0].availableCapacity).to.be.equal(0);
      expect(result[0].utilizationRate).to.be.equal("0");
      expect(result[0].premiumRate).to.be.equal("1000000000000000000000000000");
    });

    it("Should call Athena.protocolsView(beginId = 100, numberOfProtocols = 10)", async () => {
      await expect(
        ProtocolHelper.getAthenaContract().connect(owner).protocolsView(100, 10)
      ).to.be.revertedWith("begin Id is not exist");
    });

    it("Should call Athena.protocolsView(beginId = 101, numberOfProtocols = 10)", async () => {
      await expect(
        ProtocolHelper.getAthenaContract().connect(owner).protocolsView(100, 10)
      ).to.be.revertedWith("begin Id is not exist");
    });
  });
});
