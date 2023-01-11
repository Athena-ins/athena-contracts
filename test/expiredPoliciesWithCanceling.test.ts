import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "./helpers/HardhatHelper";
import ProtocolHelper from "./helpers/ProtocolHelper";

chai.use(chaiAsPromised);

const BN = (num: string | number) => hre_ethers.BigNumber.from(num);

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
let liquidityProvider3: ethers.Signer;
let policyTaker1: ethers.Signer;
let policyTaker2: ethers.Signer;
let policyTaker3: ethers.Signer;
let policyTaker4: ethers.Signer;

describe("expired policies", () => {
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
    policyTaker4 = allSigners[103];

    await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
    await ProtocolHelper.addNewProtocolPool("Test protocol 0");
    await ProtocolHelper.addNewProtocolPool("Test protocol 1");
    await ProtocolHelper.addNewProtocolPool("Test protocol 2");
    await ProtocolHelper.addNewProtocolPool("Test protocol 3");

    const USDT_amount1 = "4000000";
    const ATEN_amount1 = "100000";
    await ProtocolHelper.deposit(
      liquidityProvider1,
      USDT_amount1,
      ATEN_amount1,
      [0, 2],
      1 * 24 * 60 * 60
    );

    const USDT_amount2 = "3300000";
    const ATEN_amount2 = "9000000";
    await ProtocolHelper.deposit(
      liquidityProvider2,
      USDT_amount2,
      ATEN_amount2,
      [0, 1, 2],
      1 * 24 * 60 * 60
    );

    const USDT_amount3 = "3650000";
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

    const capital3 = "182500";
    const premium3 = "8760";
    const atensLocked3 = "0";
    await ProtocolHelper.buyPolicy(
      policyTaker3,
      capital3,
      premium3,
      atensLocked3,
      2,
      10 * 24 * 60 * 60
    );

    await HardhatHelper.USDT_maxApprove(
      policyTaker4,
      ProtocolHelper.getAthenaContract().address
    );

    await ProtocolHelper.buyPolicy(
      policyTaker4,
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

    await ProtocolHelper.buyPolicy(
      policyTaker1,
      capital1,
      premium1,
      atensLocked1,
      3,
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

  describe("Should actualizing all protocol", () => {
    it("Should withdraw policy for policyTaker1 in pool 0", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      expect((await protocolContract.slot0()).remainingPolicies).to.be.equal(2);

      await HardhatHelper.setNextBlockTimestamp(10 * 24 * 60 * 60);

      await ProtocolHelper.getAthenaContract()
        .connect(policyTaker1)
        .withdrawPolicy(2);

      const slot0 = await protocolContract.slot0();
      expect(slot0.remainingPolicies).to.be.equal(1);
    });

    it("Should actualizing pool 0", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      expect((await protocolContract.slot0()).remainingPolicies).to.be.equal(1);

      await HardhatHelper.setNextBlockTimestamp(10000 * 24 * 60 * 60);

      await ProtocolHelper.getAthenaContract().actualizingProtocolAndRemoveExpiredPolicies(
        protocolContract.address
      );

      const slot0 = await protocolContract.slot0();
      expect(slot0.remainingPolicies).to.be.equal(0);
    });

    it("Should actualizing pool 1", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        1
      );

      expect((await protocolContract.slot0()).remainingPolicies).to.be.equal(0);

      await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);

      await ProtocolHelper.getAthenaContract().actualizingProtocolAndRemoveExpiredPolicies(
        protocolContract.address
      );

      const slot0 = await protocolContract.slot0();
      expect(slot0.remainingPolicies).to.be.equal(0);
    });

    it("Should actualizing pool 2", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        2
      );

      expect((await protocolContract.slot0()).remainingPolicies).to.be.equal(1);

      await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);

      await ProtocolHelper.getAthenaContract().actualizingProtocolAndRemoveExpiredPolicies(
        protocolContract.address
      );

      const slot0 = await protocolContract.slot0();
      expect(slot0.remainingPolicies).to.be.equal(0);
    });

    it("Should actualizing pool 3", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        owner,
        3
      );

      expect((await protocolContract.slot0()).remainingPolicies).to.be.equal(2);

      await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);

      await ProtocolHelper.getAthenaContract().actualizingProtocolAndRemoveExpiredPolicies(
        protocolContract.address
      );

      const slot0 = await protocolContract.slot0();
      expect(slot0.remainingPolicies).to.be.equal(0);
    });

    it("Should get expired policies for policyTaker1", async () => {
      const expiredPolicies = await ProtocolHelper.getPolicyManagerContract()
        .connect(owner)
        .getExpiredPolicies(await policyTaker1.getAddress());

      expect(expiredPolicies.length).to.be.equal(2);

      expect(expiredPolicies[0].policyId).to.be.equal(2);
      expect(expiredPolicies[0].poolId).to.be.equal(0);
      expect(expiredPolicies[0].isCancelled).to.be.equal(true);

      expect(expiredPolicies[1].policyId).to.be.equal(3);
      expect(expiredPolicies[1].poolId).to.be.equal(3);
      expect(expiredPolicies[1].isCancelled).to.be.equal(false);
    });

    it("Should get expired policies for policyTaker2", async () => {
      const expiredPolicies = await ProtocolHelper.getPolicyManagerContract()
        .connect(owner)
        .getExpiredPolicies(await policyTaker2.getAddress());

      expect(expiredPolicies.length).to.be.equal(1);

      expect(expiredPolicies[0].poolId).to.be.equal(0);
    });

    it("Should get expired policies for policyTaker3", async () => {
      const expiredPolicies = await ProtocolHelper.getPolicyManagerContract()
        .connect(owner)
        .getExpiredPolicies(await policyTaker3.getAddress());

      expect(expiredPolicies.length).to.be.equal(1);

      expect(expiredPolicies[0].poolId).to.be.equal(2);
    });

    it("Should get expired policies for policyTaker4", async () => {
      const expiredPolicies = await ProtocolHelper.getPolicyManagerContract()
        .connect(owner)
        .getExpiredPolicies(await policyTaker4.getAddress());

      expect(expiredPolicies.length).to.be.equal(1);

      expect(expiredPolicies[0].poolId).to.be.equal(3);
    });
  });
});
