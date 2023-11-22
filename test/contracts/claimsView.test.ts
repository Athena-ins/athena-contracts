import chai, { expect } from "chai";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import { getCurrentTime, setNextBlockTimestamp } from "../helpers/hardhat";

chai.use(chaiAsPromised);

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
let policyTaker1: ethers.Signer;
let policyTaker2: ethers.Signer;
let policyTaker3: ethers.Signer;

const numberProtocol = 100;

export function testClaimsView() {
  describe("Claims view", function () {
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

    it("Should call 2 time Athena.startClaim(...)", async function () {
      await this.contracts.Athena.connect(policyTaker1).startClaim(0, 0, 1000, {
        value: "100000000000000000",
      });

      await this.contracts.Athena.connect(policyTaker2).startClaim(1, 0, 2000, {
        value: "100000000000000000",
      });
    });

    it("Should call ClaimManager.linearClaimsView(beginDisputeId = 0, numberOfClaims = 5)", async function () {
      const result = await this.contracts.ClaimManager.connect(
        owner,
      ).linearClaimsView(0, 5);

      expect(result.length).to.be.equal(2);

      expect(result[0].from).to.be.equal(await policyTaker1.getAddress());
      expect(result[0].disputeId).to.be.equal(0);
      expect(result[0].amount).to.be.equal(1000);
      expect(result[0].status).to.be.equal(0);

      expect(result[1].from).to.be.equal(await policyTaker2.getAddress());
      expect(result[1].disputeId).to.be.equal(1);
      expect(result[1].amount).to.be.equal(2000);
      expect(result[1].status).to.be.equal(0);
    });

    it("Should call ClaimManager.linearClaimsView(beginDisputeId = 3, numberOfClaims = 2)", async function () {
      await expect(
        this.contracts.ClaimManager.connect(owner).linearClaimsView(3, 2),
      ).to.be.revertedWith("begin dispute Id is not exist");
    });
  });
}
