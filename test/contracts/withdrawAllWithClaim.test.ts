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
let provider1tokenId: ethers.BigNumberish;
let provider2tokenId: ethers.BigNumberish;
let protocolPool0: ethers.Contract;
let protocolPool2: ethers.Contract;

export function testWithdrawAllWithClaim() {
  describe("Liquidity provider withdraw", function () {
    describe("LP1, LP2 then PT1, PT2 in pool 0", async function () {
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

        protocolPool0 = await this.helpers.getProtocolPoolContract(owner, 0);
        protocolPool2 = await this.helpers.getProtocolPoolContract(owner, 2);

        // ================= Cover Providers ================= //

        const USDT_amount1 = "182500";
        const ATEN_amount1 = "100000";
        await this.helpers.deposit(
          liquidityProvider1,
          USDT_amount1,
          ATEN_amount1,
          [0, 2],
          1 * 24 * 60 * 60,
        );

        const provider1tokenIds = await this.contracts.PositionsManager.connect(
          liquidityProvider1,
        ).allPositionTokensOfOwner(await liquidityProvider1.getAddress());
        provider1tokenId = provider1tokenIds[0];

        const USDT_amount2 = "547500";
        const ATEN_amount2 = "9000000";
        await this.helpers.deposit(
          liquidityProvider2,
          USDT_amount2,
          ATEN_amount2,
          [0, 2],
          1 * 24 * 60 * 60,
        );

        const provider2tokenIds = await this.contracts.PositionsManager.connect(
          liquidityProvider2,
        ).allPositionTokensOfOwner(await liquidityProvider2.getAddress());
        provider2tokenId = provider2tokenIds[0];

        // ================= Policy Buyers ================= //

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

      it("Should resolve claim in Protocol 2", async function () {
        await this.helpers.createClaim(policyTaker2, 1, "182500");

        await this.helpers.resolveClaimWithoutDispute(
          policyTaker2,
          1,
          14 * 24 * 60 * 60 + 10, // 14 days + 10 seconds
        );

        const claim = await protocolPool0.processedClaims(0);

        expect(claim.fromPoolId).to.be.equal(2);
        expect(claim.ratio).to.be.equal("250000000000000000000000000");
        expect(claim.liquidityIndexBeforeClaim).to.be.equal(
          "197261796042617960426179",
        );
      });

      it(`Should commit withdraw all for LP1 after 1 days of claim and withdraw all liquidity after 14 days of committing`, async function () {
        await setNextBlockTimestamp(1 * 24 * 60 * 60);

        const commit_tx =
          await this.contracts.Athena.connect(
            liquidityProvider1,
          ).committingWithdrawAll(provider1tokenId);

        await setNextBlockTimestamp(14 * 24 * 60 * 60);

        const withdraw_tx =
          await this.contracts.Athena.connect(liquidityProvider1).withdrawAll(
            provider1tokenId,
          );

        const result = await withdraw_tx.wait();

        if (!result.events) throw new Error("No events emitted");

        const p0_event = result.events.find(
          (el: any) =>
            el.topics[0] ===
            "0x620d50d2ff399522b99eeffadbd9b188529ed4c6ce9a4ecf9e85fc3c00edc79f",
        );

        if (!p0_event) throw new Error("No events emitted");

        const p0_decodedData = protocolPool0.interface.decodeEventLog(
          p0_event.topics[0],
          p0_event.data,
        );

        expect(p0_decodedData.tokenId).to.be.equal(provider1tokenId);
        expect(p0_decodedData.capital).to.be.equal(136875);
        expect(p0_decodedData.rewardsGross).to.be.equal(62);
        expect(p0_decodedData.rewardsNet).to.be.equal(52);
        expect(p0_decodedData.fee).to.be.equal(10);

        const p0_premiumRate = await protocolPool0.getCurrentPremiumRate();

        expect(p0_premiumRate).to.be.equal("2777777777777777777777777780");

        const p0_slot0 = await protocolPool0.slot0();

        expect(p0_slot0.secondsPerTick).to.be.equal("31104");
        expect(p0_slot0.totalInsuredCapital).to.be.equal("109500");
        expect(p0_slot0.remainingPolicies).to.be.equal("1");
        expect(p0_slot0.lastUpdateTimestamp).to.be.equal(
          await getCurrentTime(),
        );

        //protocol2

        const p2_event: any = result.events.find(
          (el: any) =>
            el.topics[0] ===
            "0x620d50d2ff399522b99eeffadbd9b188529ed4c6ce9a4ecf9e85fc3c00edc79f",
        );

        if (!p2_event) throw new Error("No events emitted");

        const p2_decodedData = protocolPool2.interface.decodeEventLog(
          p2_event.topics[0],
          p2_event.data,
        );

        expect(p2_decodedData.tokenId).to.be.equal(provider1tokenId);
        expect(p2_decodedData.capital).to.be.equal(136875);
        expect(p2_decodedData.rewardsGross).to.be.equal(62);
        expect(p2_decodedData.rewardsNet).to.be.equal(52);
        expect(p2_decodedData.fee).to.be.equal(10);

        const p2_premiumRate = await protocolPool2.getCurrentPremiumRate();

        expect(p2_premiumRate).to.be.equal("4555555555555555555555555555");

        const p2_slot0 = await protocolPool2.slot0();

        expect(p2_slot0.secondsPerTick).to.be.equal("18966");
        expect(p2_slot0.totalInsuredCapital).to.be.equal("219000");
        expect(p2_slot0.remainingPolicies).to.be.equal("1");
        expect(p2_slot0.lastUpdateTimestamp).to.be.equal(
          await getCurrentTime(),
        );
      });

      it("Should call takeInterest for LP2 after 10 day that LP1 withdrawed his capital in protocol 0", async function () {
        const lpInfoBefore = await protocolPool0.LPsInfo(provider2tokenId);

        const days = 10;
        const decodedData = await this.helpers.takeInterest(
          liquidityProvider2,
          provider2tokenId,
          0,
          days * 24 * 60 * 60,
          2,
        );

        expect(decodedData.tokenId).to.be.equal(provider2tokenId);
        expect(decodedData.userCapital).to.be.equal(410625);
        expect(decodedData.rewardsGross).to.be.equal(270);
        expect(decodedData.rewardsNet).to.be.equal(256);
        expect(decodedData.fee).to.be.equal(14);

        const lpInfoAfter = await protocolPool0.LPsInfo(provider2tokenId);

        expect(
          lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex),
        ).to.be.equal(true);
        expect(
          lpInfoAfter.beginClaimIndex.gt(lpInfoBefore.beginClaimIndex),
        ).to.be.equal(true);
      });
    });
  });
}
