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

    it("Should resolve claim in Protocol 2", async () => {
      await ProtocolHelper.resolveClaim(
        owner,
        1,
        "182500",
        policyTaker2,
        1 * 24 * 60 * 60
      );

      const protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );
      const claim = await protocolPool0.claims(0);

      expect(claim.fromProtocolId).to.be.equal(2);
      expect(claim.ratio).to.be.equal("250000000000000000000000000");
      expect(claim.liquidityIndexBeforeClaim).to.be.equal(
        "90410958904109589041095"
      );
    });

    it(`Should commit withdraw all for LP1 after 1 days of claim and withdraw all liquidity after 14 days of committing`, async () => {
      await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);

      const commit_tx = await ProtocolHelper.getAthenaContract()
        .connect(liquidityProvider1)
        .committingWithdrawAll();

      await HardhatHelper.setNextBlockTimestamp(14 * 24 * 60 * 60);

      const withdraw_tx = await ProtocolHelper.getAthenaContract()
        .connect(liquidityProvider1)
        .withdrawAll();

      const result = await withdraw_tx.wait();
      //   console.log(result);

      //protocol0
      const p0_contract = await ProtocolHelper.getProtocolPoolContract(
        liquidityProvider1,
        0
      );

      const p0_event = result.events[3];

      const p0_decodedData = p0_contract.interface.decodeEventLog(
        p0_event.topics[0],
        p0_event.data
      );

      expect(p0_decodedData.account).to.be.equal(
        await liquidityProvider1.getAddress()
      );
      expect(p0_decodedData.capital).to.be.equal(136875);
      expect(p0_decodedData.rewardsGross).to.be.equal(42);
      expect(p0_decodedData.rewardsNet).to.be.equal(35);
      expect(p0_decodedData.fee).to.be.equal(7);

      const p0_premiumRate = await p0_contract.getCurrentPremiumRate();

      expect(p0_premiumRate).to.be.equal("2777777777777777777777777780");

      const p0_slot0 = await p0_contract.slot0();

      expect(p0_slot0.secondsPerTick).to.be.equal("31104");
      expect(p0_slot0.totalInsuredCapital).to.be.equal("109500");
      expect(p0_slot0.remainingPolicies).to.be.equal("1");
      expect(p0_slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime()
      );

      //protocol2
      const p2_contract = await ProtocolHelper.getProtocolPoolContract(
        liquidityProvider1,
        2
      );
      const p2_event = result.events[7];

      const p2_decodedData = p2_contract.interface.decodeEventLog(
        p2_event.topics[0],
        p2_event.data
      );

      expect(p2_decodedData.account).to.be.equal(
        await liquidityProvider1.getAddress()
      );
      expect(p2_decodedData.capital).to.be.equal(136875);
      expect(p2_decodedData.rewardsGross).to.be.equal(86);
      expect(p2_decodedData.rewardsNet).to.be.equal(73);
      expect(p2_decodedData.fee).to.be.equal(13);

      const p2_premiumRate = await p2_contract.getCurrentPremiumRate();

      expect(p2_premiumRate).to.be.equal("4555555555555555555555555555");

      const p2_slot0 = await p2_contract.slot0();

      expect(p2_slot0.secondsPerTick).to.be.equal("18966");
      expect(p2_slot0.totalInsuredCapital).to.be.equal("219000");
      expect(p2_slot0.remainingPolicies).to.be.equal("1");
      expect(p2_slot0.lastUpdateTimestamp).to.be.equal(
        HardhatHelper.getCurrentTime()
      );
    });

    it("Should call takeInterest for LP2 after 10 day that LP1 withdrawed his capital in protocol 0", async () => {
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
      expect(decodedData.userCapital).to.be.equal(410625);
      expect(decodedData.rewardsGross).to.be.equal(211);
      expect(decodedData.rewardsNet).to.be.equal(200);
      expect(decodedData.fee).to.be.equal(11);

      const lpInfoAfter = await protocolContract.LPsInfo(
        liquidityProvider2.getAddress()
      );

      expect(
        lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
      ).to.be.equal(true);
      expect(
        lpInfoAfter.beginClaimIndex.gt(lpInfoBefore.beginClaimIndex)
      ).to.be.equal(true);
    });
  });
});
