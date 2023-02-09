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
let provider1tokenId: ethers.BigNumberish;
let provider2tokenId: ethers.BigNumberish;

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

      const provider1tokenIds =
        await ProtocolHelper.getPositionManagerContract()
          .connect(liquidityProvider1)
          .allPositionTokensOfOwner(await liquidityProvider1.getAddress());
      provider1tokenId = provider1tokenIds[0];

      const USDT_amount2 = "547500";
      const ATEN_amount2 = "9000000";
      await ProtocolHelper.deposit(
        liquidityProvider2,
        USDT_amount2,
        ATEN_amount2,
        [0, 2],
        1 * 24 * 60 * 60
      );

      const provider2tokenIds =
        await ProtocolHelper.getPositionManagerContract()
          .connect(liquidityProvider2)
          .allPositionTokensOfOwner(await liquidityProvider2.getAddress());
      provider2tokenId = provider2tokenIds[0];

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

    it(`Should commit withdraw all for LP1 after 1 days of PT2 bought his policy in protocol2 and withdraw all liquidity after 14 days of committing`, async () => {
      await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);

      const commit_tx = await ProtocolHelper.getAthenaContract()
        .connect(liquidityProvider1)
        .committingWithdrawAll(provider1tokenId);

      await HardhatHelper.setNextBlockTimestamp(14 * 24 * 60 * 60);

      const withdraw_tx = await ProtocolHelper.getAthenaContract()
        .connect(liquidityProvider1)
        .withdrawAll(provider1tokenId);

      const result = await withdraw_tx.wait();

      //protocol0
      const p0_contract = await ProtocolHelper.getProtocolPoolContract(
        liquidityProvider1,
        0
      );

      const p0_event = result?.events?.find(
        (el: any) =>
          el.topics[0] ===
            "0x620d50d2ff399522b99eeffadbd9b188529ed4c6ce9a4ecf9e85fc3c00edc79f" &&
          el.logIndex === 5
      );

      if (!p0_event) throw new Error("Event not found");

      const p0_decodedData = p0_contract.interface.decodeEventLog(
        p0_event?.topics?.[0],
        p0_event?.data
      );

      expect(p0_decodedData.tokenId).to.be.equal(provider1tokenId);
      expect(p0_decodedData.capital).to.be.equal(182500);
      expect(p0_decodedData.rewardsGross).to.be.equal(68);
      expect(p0_decodedData.rewardsNet).to.be.equal(57);
      expect(p0_decodedData.fee).to.be.equal(11);

      const p0_premiumRate = await p0_contract.getCurrentPremiumRate();

      expect(p0_premiumRate).to.be.equal("2333333333333333333333333335");

      const p0_slot0 = await p0_contract.slot0();

      expect(p0_slot0.secondsPerTick).to.be.equal("37029");
      expect(p0_slot0.totalInsuredCapital).to.be.equal("109500");
      expect(p0_slot0.remainingPolicies).to.be.equal("1");
      expect(p0_slot0.lastUpdateTimestamp).to.be.equal(
        await HardhatHelper.getCurrentTime()
      );

      //protocol2
      const p2_contract = await ProtocolHelper.getProtocolPoolContract(
        liquidityProvider1,
        2
      );

      const p2_event = result?.events?.find(
        (el: any) =>
          el.topics[0] ===
            "0x620d50d2ff399522b99eeffadbd9b188529ed4c6ce9a4ecf9e85fc3c00edc79f" &&
          el.logIndex === 5
      );

      if (!p2_event) throw new Error("Event not found");

      const p2_decodedData = p2_contract.interface.decodeEventLog(
        p2_event.topics[0],
        p2_event.data
      );

      expect(p2_decodedData.tokenId).to.be.equal(provider1tokenId);
      expect(p2_decodedData.capital).to.be.equal(182500);
      expect(p2_decodedData.rewardsGross).to.be.equal(68);
      expect(p2_decodedData.rewardsNet).to.be.equal(57);
      expect(p2_decodedData.fee).to.be.equal(11);

      const p2_premiumRate = await p2_contract.getCurrentPremiumRate();

      expect(p2_premiumRate).to.be.equal("3666666666666666666666666665");

      const p2_slot0 = await p2_contract.slot0();

      expect(p2_slot0.secondsPerTick).to.be.equal("23564");
      expect(p2_slot0.totalInsuredCapital).to.be.equal("219000");
      expect(p2_slot0.remainingPolicies).to.be.equal("1");
      expect(p2_slot0.lastUpdateTimestamp).to.be.equal(
        await HardhatHelper.getCurrentTime()
      );
    });

    it("Should call takeInterest for LP2 after 10 day that LP1 withdrawed his capital in protocol 0", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        liquidityProvider2,
        0
      );

      const lpInfoBefore = await protocolContract.LPsInfo(provider2tokenId);

      const days = 10;
      const decodedData = await ProtocolHelper.takeInterest(
        liquidityProvider2,
        provider2tokenId,
        0,
        days * 24 * 60 * 60,
        2
      );

      expect(decodedData.tokenId).to.be.equal(provider2tokenId);
      expect(decodedData.userCapital).to.be.equal(547500);
      expect(decodedData.rewardsGross).to.be.equal(113 + 70);
      expect(decodedData.rewardsNet).to.be.equal(113 + 70 - 10);
      expect(decodedData.fee).to.be.equal(10);

      const lpInfoAfter = await protocolContract.LPsInfo(provider2tokenId);

      expect(
        lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
      ).to.be.equal(true);
      expect(lpInfoAfter.beginClaimIndex).to.be.equal(
        lpInfoBefore.beginClaimIndex
      );
    });
  });
});
