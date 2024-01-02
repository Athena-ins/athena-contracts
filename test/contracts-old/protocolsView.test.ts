import chai, { expect } from "chai";
import { ethers } from "hardhat";
import chaiAsPromised from "chai-as-promised";
// Helpers
import { getCurrentTime, setNextBlockTimestamp } from "../helpers/hardhat";
// Types
import { Signer, Contract, BigNumber, BigNumberish } from "ethers";
//
chai.use(chaiAsPromised);

let owner: Signer;
let liquidityProvider1: Signer;
let liquidityProvider2: Signer;
let policyTaker1: Signer;
let policyTaker2: Signer;
let policyTaker3: Signer;

const numberProtocol = 100;

export function testProtocolsView() {
  describe("Protocols view", function () {
    before(async function () {
      const allSigners = await ethers.getSigners();
      owner = allSigners[0];
      liquidityProvider1 = allSigners[1];
      liquidityProvider2 = allSigners[2];
      policyTaker1 = allSigners[100];
      policyTaker2 = allSigners[101];
      policyTaker3 = allSigners[102];

      for (let i = 0; i < numberProtocol; i++)
        await this.helpers.addNewProtocolPool(`Test protocol ${i}`);

      const USDT_amount1 = "182500";
      const ATEN_amount1 = "100000";
      await this.helpers.deposit(
        liquidityProvider1,
        USDT_amount1,
        ATEN_amount1,
        [0, 2],
        1 * 24 * 60 * 60,
      );

      const USDT_amount2 = "547500";
      const ATEN_amount2 = "9000000";
      await this.helpers.deposit(
        liquidityProvider2,
        USDT_amount2,
        ATEN_amount2,
        [0, 2],
        1 * 24 * 60 * 60,
      );

      await this.helpers.maxApproveUsdt(
        policyTaker1,
        this.contracts.Athena.address,
      );

      const capital1 = "109500";
      const premium1 = "2190";
      const atensLocked1 = "0";
      await this.helpers.buyPolicy(
        policyTaker1,
        capital1,
        premium1,
        atensLocked1,
        0,
        20 * 24 * 60 * 60,
      );

      await this.helpers.maxApproveUsdt(
        policyTaker2,
        this.contracts.Athena.address,
      );

      const capital2 = "219000";
      const premium2 = "8760";
      const atensLocked2 = "0";
      await this.helpers.buyPolicy(
        policyTaker2,
        capital2,
        premium2,
        atensLocked2,
        2,
        10 * 24 * 60 * 60,
      );
    });

    it("Should call Athena.linearProtocolsView(beginId = 0, numberOfProtocols = 3)", async function () {
      const result = await Promise.all([
        this.contracts.Athena.connect(owner).getProtocol(0),
        this.contracts.Athena.connect(owner).getProtocol(1),
        this.contracts.Athena.connect(owner).getProtocol(2),
      ]);

      expect(result.length).to.be.equal(3);

      expect(result[0].name).to.be.equal("Test protocol 0");
      expect(result[0].poolId).to.be.equal(0);
      expect(result[0].insuredCapital).to.be.equal(109500);
      expect(result[0].availableCapacity).to.be.equal(620500);
      expect(result[0].utilizationRate).to.be.equal(
        "15000000000000000000000000000",
      );
      expect(result[0].premiumRate).to.be.equal("2000000000000000000000000000");

      expect(result[1].name).to.be.equal("Test protocol 1");
      expect(result[1].poolId).to.be.equal(1);
      expect(result[1].insuredCapital).to.be.equal(0);
      expect(result[1].availableCapacity).to.be.equal(0);
      expect(result[1].utilizationRate).to.be.equal("0");
      expect(result[1].premiumRate).to.be.equal("1000000000000000000000000000");

      expect(result[2].name).to.be.equal("Test protocol 2");
      expect(result[2].poolId).to.be.equal(2);
      expect(result[2].insuredCapital).to.be.equal(219000);
      expect(result[2].availableCapacity).to.be.equal(511000);
      expect(result[2].utilizationRate).to.be.equal(
        "30000000000000000000000000000",
      );
      expect(result[2].premiumRate).to.be.equal("3000000000000000000000000000");
    });

    it("Should call Athena.linearProtocolsView(beginId = 23, numberOfProtocols = 2)", async function () {
      const result = await Promise.all([
        this.contracts.Athena.connect(owner).getProtocol(23),
        this.contracts.Athena.connect(owner).getProtocol(23),
      ]);

      expect(result.length).to.be.equal(2);

      expect(result[0].name).to.be.equal("Test protocol 23");
      expect(result[0].poolId).to.be.equal(23);
      expect(result[0].insuredCapital).to.be.equal(0);
      expect(result[0].availableCapacity).to.be.equal(0);
      expect(result[0].utilizationRate).to.be.equal("0");
      expect(result[0].premiumRate).to.be.equal("1000000000000000000000000000");

      expect(result[1].name).to.be.equal("Test protocol 24");
      expect(result[1].poolId).to.be.equal(24);
      expect(result[1].insuredCapital).to.be.equal(0);
      expect(result[1].availableCapacity).to.be.equal(0);
      expect(result[1].utilizationRate).to.be.equal("0");
      expect(result[1].premiumRate).to.be.equal("1000000000000000000000000000");
    });

    it("Should call Athena.protocolsView([2, 37, 90, 85])", async function () {
      const result = await Promise.all([
        this.contracts.Athena.connect(owner).getProtocol(2),
        this.contracts.Athena.connect(owner).getProtocol(37),
        this.contracts.Athena.connect(owner).getProtocol(90),
        this.contracts.Athena.connect(owner).getProtocol(85),
      ]);

      expect(result.length).to.be.equal(4);

      expect(result[0].name).to.be.equal("Test protocol 2");
      expect(result[0].poolId).to.be.equal(2);
      expect(result[0].insuredCapital).to.be.equal(219000);
      expect(result[0].availableCapacity).to.be.equal(511000);
      expect(result[0].utilizationRate).to.be.equal(
        "30000000000000000000000000000",
      );
      expect(result[0].premiumRate).to.be.equal("3000000000000000000000000000");

      expect(result[1].name).to.be.equal("Test protocol 37");
      expect(result[1].poolId).to.be.equal(37);
      expect(result[1].insuredCapital).to.be.equal(0);
      expect(result[1].availableCapacity).to.be.equal(0);
      expect(result[1].utilizationRate).to.be.equal("0");
      expect(result[1].premiumRate).to.be.equal("1000000000000000000000000000");

      expect(result[2].name).to.be.equal("Test protocol 90");
      expect(result[2].poolId).to.be.equal(90);
      expect(result[2].insuredCapital).to.be.equal(0);
      expect(result[2].availableCapacity).to.be.equal(0);
      expect(result[2].utilizationRate).to.be.equal("0");
      expect(result[2].premiumRate).to.be.equal("1000000000000000000000000000");

      expect(result[3].name).to.be.equal("Test protocol 85");
      expect(result[3].poolId).to.be.equal(85);
      expect(result[3].insuredCapital).to.be.equal(0);
      expect(result[3].availableCapacity).to.be.equal(0);
      expect(result[3].utilizationRate).to.be.equal("0");
      expect(result[3].premiumRate).to.be.equal("1000000000000000000000000000");
    });
  });
}
