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

export function testOngoingCoveragePolicies() {
  describe("Ongoing coverage policies", function () {
    before(async function () {
      const allSigners = await ethers.getSigners();
      owner = allSigners[0];
      liquidityProvider1 = allSigners[1];
      liquidityProvider2 = allSigners[2];
      policyTaker1 = allSigners[100];
      policyTaker2 = allSigners[101];
      policyTaker3 = allSigners[102];

      await this.helpers.addNewProtocolPool("Test protocol 0");
      await this.helpers.addNewProtocolPool("Test protocol 1");
      await this.helpers.addNewProtocolPool("Test protocol 2");

      const USDT_amount1 = "400000";
      const ATEN_amount1 = "100000";
      await this.helpers.deposit(
        liquidityProvider1,
        USDT_amount1,
        ATEN_amount1,
        [0, 2],
        1 * 24 * 60 * 60,
      );

      const USDT_amount2 = "330000";
      const ATEN_amount2 = "9000000";
      await this.helpers.deposit(
        liquidityProvider2,
        USDT_amount2,
        ATEN_amount2,
        [0, 1, 2],
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
        policyTaker3,
        this.contracts.Athena.address,
      );

      await this.helpers.buyPolicy(
        policyTaker3,
        capital1,
        premium1,
        atensLocked1,
        0,
        1 * 24 * 60 * 60,
      );

      const capital2 = "219000";
      const premium2 = "8760";
      const atensLocked2 = "0";
      await this.helpers.buyPolicy(
        policyTaker1,
        capital2,
        premium2,
        atensLocked2,
        2,
        10 * 24 * 60 * 60,
      );
    });

    it("Should call PolicyManager.fullCoverDataByAccount for PT1", async function () {
      const result = await this.contracts.PolicyManager.fullCoverDataByAccount(
        await policyTaker1.getAddress(),
      );

      expect(result.length).to.be.equals(2);
      expect(result[0].coverId).to.be.equals(0);
      expect(result[0].amountCovered).to.be.equals(109500);
      expect(result[0].premiumDeposit).to.be.equals(2190);
      expect(result[0].premiumLeft).to.be.equals(2094);
      expect(result[0].dailyCost).to.be.equals(9);
      // @dev hacky check because value is inconsistent (1 sec variation)
      expect(
        Math.floor(result[0].beginCoveredTime.toNumber() / 10),
      ).to.be.equals(167587757);
      expect(result[0].remainingDuration).to.be.equals(20102400);
      expect(result[0].poolId).to.be.equals(0);

      expect(result[1].coverId).to.be.equals(2);
      expect(result[1].amountCovered).to.be.equals(219000);
      expect(result[1].premiumDeposit).to.be.equals(8760);
      expect(result[1].premiumLeft).to.be.equals(8760);
      expect(result[1].dailyCost).to.be.equals(18);
      // @dev hacky check because value is inconsistent (1 sec variation)
      expect(
        Math.floor(result[1].beginCoveredTime.toNumber() / 10),
      ).to.be.equals(167682797);
      expect(result[1].remainingDuration).to.be.equals(42048000);
      expect(result[1].poolId).to.be.equals(2);
    });

    it("Should call PolicyManager.fullCoverDataByAccount for PT1 after expireing of token 0", async function () {
      await this.helpers.maxApproveUsdt(
        policyTaker2,
        this.contracts.Athena.address,
      );

      await setNextBlockTimestamp(400 * 24 * 60 * 60);

      const capital2 = "219000";
      const premium2 = "8760";
      const atensLocked2 = "0";

      await this.helpers.buyPolicy(
        policyTaker2,
        capital2,
        premium2,
        atensLocked2,
        0,
        10 * 24 * 60 * 60,
      );

      await this.helpers.buyPolicy(
        policyTaker2,
        capital2,
        premium2,
        atensLocked2,
        2,
        10 * 24 * 60 * 60,
      );

      const result = await this.helpers.getOngoingCovers(policyTaker1);

      expect(result.length).to.be.equals(1);
      expect(result[0].coverId).to.be.equals(2);
      expect(result[0].poolId).to.be.equals(2);

      const result1 = await this.helpers.getExpiredCovers(policyTaker1);

      expect(result1.length).to.be.equals(1);
      expect(result1[0].coverId).to.be.equals(0);
      expect(result1[0].poolId).to.be.equals(0);

      const result2 = await this.contracts.PolicyManager.allPolicyTokensOfOwner(
        await policyTaker1.getAddress(),
      );

      expect(result2.length).to.be.equals(2);
    });
  });
}
