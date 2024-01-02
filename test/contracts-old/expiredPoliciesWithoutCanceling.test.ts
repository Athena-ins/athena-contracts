import chai, { expect } from "chai";
import { ethers } from "hardhat";
import chaiAsPromised from "chai-as-promised";
// Helpers
import { getCurrentTime, setNextBlockTimestamp } from "../helpers/hardhat";
// Types
import { Signer, Contract, BigNumber, BigNumberish } from "ethers";
//
chai.use(chaiAsPromised);

const BN = (num: string | number) => BigNumber.from(num);

let owner: Signer;
let liquidityProvider1: Signer;
let liquidityProvider2: Signer;
let liquidityProvider3: Signer;
let policyTaker1: Signer;
let policyTaker2: Signer;
let policyTaker3: Signer;
let policyTaker4: Signer;

export function testExpiredPoliciesWithoutCanceling() {
  describe("expired policies", function () {
    before(async function () {
      const allSigners = await ethers.getSigners();
      owner = allSigners[0];
      liquidityProvider1 = allSigners[1];
      liquidityProvider2 = allSigners[2];
      liquidityProvider3 = allSigners[3];
      policyTaker1 = allSigners[100];
      policyTaker2 = allSigners[101];
      policyTaker3 = allSigners[102];
      policyTaker4 = allSigners[103];

      await this.helpers.addNewProtocolPool("Test protocol 0");
      await this.helpers.addNewProtocolPool("Test protocol 1");
      await this.helpers.addNewProtocolPool("Test protocol 2");
      await this.helpers.addNewProtocolPool("Test protocol 3");

      const USDT_amount1 = "4000000";
      const ATEN_amount1 = "100000";
      await this.helpers.deposit(
        liquidityProvider1,
        USDT_amount1,
        ATEN_amount1,
        [0, 2],
        1 * 24 * 60 * 60,
      );

      const USDT_amount2 = "3300000";
      const ATEN_amount2 = "9000000";
      await this.helpers.deposit(
        liquidityProvider2,
        USDT_amount2,
        ATEN_amount2,
        [0, 1, 2],
        1 * 24 * 60 * 60,
      );

      const USDT_amount3 = "3650000";
      const ATEN_amount3 = "9000000";
      await this.helpers.deposit(
        liquidityProvider3,
        USDT_amount3,
        ATEN_amount3,
        [1, 3],
        1 * 24 * 60 * 60,
      );

      await this.helpers.maxApproveUsdt(
        policyTaker3,
        this.contracts.Athena.address,
      );

      const capital3 = "182500";
      const premium3 = "8760";
      const atensLocked3 = "0";
      await this.helpers.buyPolicy(
        policyTaker3,
        capital3,
        premium3,
        atensLocked3,
        2,
        10 * 24 * 60 * 60,
      );

      await this.helpers.maxApproveUsdt(
        policyTaker4,
        this.contracts.Athena.address,
      );

      await this.helpers.buyPolicy(
        policyTaker4,
        capital3,
        premium3,
        atensLocked3,
        3,
        10 * 24 * 60 * 60,
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

      await this.helpers.buyPolicy(
        policyTaker1,
        capital1,
        premium1,
        atensLocked1,
        3,
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
        0,
        10 * 24 * 60 * 60,
      );
    });

    describe("Should actualizing all protocol", function () {
      it("Should actualizing pool 0", async function () {
        const protocolContract = await this.helpers.getProtocolPoolContract(
          owner,
          0,
        );

        expect((await protocolContract.slot0()).remainingPolicies).to.be.equal(
          2,
        );

        await setNextBlockTimestamp(10000 * 24 * 60 * 60);

        await this.contracts.Athena.actualizingProtocolAndRemoveExpiredPolicies(
          protocolContract.address,
        );

        const slot0 = await protocolContract.slot0();
        expect(slot0.remainingPolicies).to.be.equal(0);
      });

      it("Should actualizing pool 1", async function () {
        const protocolContract = await this.helpers.getProtocolPoolContract(
          owner,
          1,
        );

        expect((await protocolContract.slot0()).remainingPolicies).to.be.equal(
          0,
        );

        await setNextBlockTimestamp(1 * 24 * 60 * 60);

        await this.contracts.Athena.actualizingProtocolAndRemoveExpiredPolicies(
          protocolContract.address,
        );

        const slot0 = await protocolContract.slot0();
        expect(slot0.remainingPolicies).to.be.equal(0);
      });

      it("Should actualizing pool 2", async function () {
        const protocolContract = await this.helpers.getProtocolPoolContract(
          owner,
          2,
        );

        expect((await protocolContract.slot0()).remainingPolicies).to.be.equal(
          1,
        );

        await setNextBlockTimestamp(1 * 24 * 60 * 60);

        await this.contracts.Athena.actualizingProtocolAndRemoveExpiredPolicies(
          protocolContract.address,
        );

        const slot0 = await protocolContract.slot0();
        expect(slot0.remainingPolicies).to.be.equal(0);
      });

      it("Should actualizing pool 3", async function () {
        const protocolContract = await this.helpers.getProtocolPoolContract(
          owner,
          3,
        );

        expect((await protocolContract.slot0()).remainingPolicies).to.be.equal(
          2,
        );

        await setNextBlockTimestamp(1 * 24 * 60 * 60);

        await this.contracts.Athena.actualizingProtocolAndRemoveExpiredPolicies(
          protocolContract.address,
        );

        const slot0 = await protocolContract.slot0();
        expect(slot0.remainingPolicies).to.be.equal(0);
      });

      it("Should get expired policies for policyTaker1", async function () {
        const expiredPolicies =
          await this.helpers.getExpiredCovers(policyTaker1);

        expect(expiredPolicies.length).to.be.equal(2);

        expect(expiredPolicies[0].poolId).to.be.equal(0);
        expect(expiredPolicies[1].poolId).to.be.equal(3);
      });

      it("Should get expired policies for policyTaker2", async function () {
        const expiredPolicies =
          await this.helpers.getExpiredCovers(policyTaker2);

        expect(expiredPolicies.length).to.be.equal(1);

        expect(expiredPolicies[0].poolId).to.be.equal(0);
      });

      it("Should get expired policies for policyTaker3", async function () {
        const expiredPolicies =
          await this.helpers.getExpiredCovers(policyTaker3);

        expect(expiredPolicies.length).to.be.equal(1);

        expect(expiredPolicies[0].poolId).to.be.equal(2);
      });

      it("Should get expired policies for policyTaker4", async function () {
        const expiredPolicies =
          await this.helpers.getExpiredCovers(policyTaker4);

        expect(expiredPolicies.length).to.be.equal(1);

        expect(expiredPolicies[0].poolId).to.be.equal(3);
      });
    });
  });
}
