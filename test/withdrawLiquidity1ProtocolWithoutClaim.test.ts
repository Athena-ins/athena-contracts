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
      await ProtocolHelper.addNewProtocolPool("Test protocol 0");
      await ProtocolHelper.addNewProtocolPool("Test protocol 1");
      await ProtocolHelper.addNewProtocolPool("Test protocol 2");

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
        [0, 1],
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
        0,
        10 * 24 * 60 * 60
      );
    });

    it(`Should commit withdraw for LP1 after 1 days of PT2 bought his policy in protocol0 and withdraw liquidity after 14 days of committing`, async () => {
      await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);

      const commit_tx = await ProtocolHelper.getAthenaContract()
        .connect(liquidityProvider1)
        .committingWithdrawInOneProtocol(0);

      await HardhatHelper.setNextBlockTimestamp(14 * 24 * 60 * 60);

      const withdraw_tx = await ProtocolHelper.getAthenaContract()
        .connect(liquidityProvider1)
        .withdrawLiquidityInOneProtocol(0);

      const result = await withdraw_tx.wait();
      // console.log(result);

      const event = result.events[3];

      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        liquidityProvider1,
        0
      );

      const decodedData = protocolContract.interface.decodeEventLog(
        event.topics[0],
        event.data
      );

      expect(decodedData.account).to.be.equal(
        await liquidityProvider1.getAddress()
      );
      expect(decodedData.capital).to.be.equal(182500);
      expect(decodedData.rewardsGross).to.be.equal(150);
      expect(decodedData.rewardsNet).to.be.equal(127);
      expect(decodedData.fee).to.be.equal(23);

      const slot0 = await protocolContract.slot0();

      expect(slot0.secondsPerTick).to.be.equal("17280");
      expect(slot0.totalInsuredCapital).to.be.equal("328500");
      expect(slot0.remainingPolicies).to.be.equal("2");
      expect(slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime()
      );

      const premiumRate = await protocolContract.getCurrentPremiumRate();
      expect(premiumRate).to.be.equal("5000000000000000000000000000");
    });

    it("Should call takeInterest for LP2 after 10 day that LP1 withdrawed his capital", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        liquidityProvider2,
        0
      );

      const lpInfoBefore = await protocolContract.LPsInfo(
        liquidityProvider2.getAddress()
      );

      const days = 10;
      const decodedData = await ProtocolHelper.takeInterest(
        liquidityProvider2,
        0,
        days * 24 * 60 * 60,
        2
      );

      expect(decodedData.account).to.be.equal(
        await liquidityProvider2.getAddress()
      );
      expect(decodedData.userCapital).to.be.equal(547500);
      expect(decodedData.rewardsGross).to.be.equal(450 + 450);
      expect(decodedData.rewardsNet).to.be.equal(450 + 450 - 45);
      expect(decodedData.fee).to.be.equal(45);

      const lpInfoAfter = await protocolContract.LPsInfo(
        liquidityProvider2.getAddress()
      );

      expect(
        lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
      ).to.be.equal(true);
      expect(lpInfoAfter.beginClaimIndex).to.be.equal(
        lpInfoBefore.beginClaimIndex
      );
    });
  });
});
