import chai, { expect } from "chai";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "../helpers/hardhat";
import ProtocolHelper from "../helpers/protocol";

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

export function testTakeInterestWithoutClaim() {
  describe("Liquidity provider takeInterest without claims", function () {
    describe("LP1, LP2 then PT1, PT2 in pool 0", async function () {
      before(async function () {
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

        protocolPool0 = await ProtocolHelper.getProtocolPoolContract(owner, 0);

        // ================= Cover Providers ================= //

        const USDT_amount1 = "365000";
        const ATEN_amount1 = "100000";
        await ProtocolHelper.deposit(
          liquidityProvider1,
          USDT_amount1,
          ATEN_amount1,
          [0, 2],
          1 * 24 * 60 * 60,
        );

        const provider1tokenIds =
          await ProtocolHelper.getPositionManagerContract()
            .connect(liquidityProvider1)
            .allPositionTokensOfOwner(await liquidityProvider1.getAddress());
        provider1tokenId = provider1tokenIds[0];

        const USDT_amount2 = "365000";
        const ATEN_amount2 = "9000000";
        await ProtocolHelper.deposit(
          liquidityProvider2,
          USDT_amount2,
          ATEN_amount2,
          [0, 1],
          1 * 24 * 60 * 60,
        );

        const provider2tokenIds =
          await ProtocolHelper.getPositionManagerContract()
            .connect(liquidityProvider2)
            .allPositionTokensOfOwner(await liquidityProvider2.getAddress());
        provider2tokenId = provider2tokenIds[0];

        // ================= Policy Buyers ================= //

        await this.helpers.maxApproveUsdt(
          policyTaker1,
          ProtocolHelper.getAthenaContract().address,
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
          20 * 24 * 60 * 60,
        );

        await this.helpers.maxApproveUsdt(
          policyTaker2,
          ProtocolHelper.getAthenaContract().address,
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
          10 * 24 * 60 * 60,
        );
      });

      it(`Should call takeInterest for LP1 after 1 days of PT2 bought his policy`, async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider1,
          0,
        );

        const lpInfoBefore = await protocolContract.LPsInfo(provider1tokenId);

        const decodedData = await ProtocolHelper.takeInterest(
          liquidityProvider1,
          provider1tokenId,
          0,
          1 * 24 * 60 * 60,
          2,
        );

        const lpInfoAfter = await protocolContract.LPsInfo(provider1tokenId);

        expect(decodedData.tokenId).to.be.equal(provider1tokenId);
        expect(decodedData.userCapital).to.be.equal(365000);
        expect(decodedData.rewardsGross).to.be.equal(48);
        expect(decodedData.rewardsNet).to.be.equal(40);
        expect(decodedData.fee).to.be.equal(8);

        expect(
          lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex),
        ).to.be.equal(true);
        expect(lpInfoAfter.beginClaimIndex).to.be.equal(
          lpInfoBefore.beginClaimIndex,
        );
      });

      it(`Should call takeInterest for LP1 after 1 days again`, async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider1,
          0,
        );

        const lpInfoBefore = await protocolContract.LPsInfo(provider1tokenId);

        const decodedData = await ProtocolHelper.takeInterest(
          liquidityProvider1,
          provider1tokenId,
          0,
          1 * 24 * 60 * 60,
          2,
        );

        const lpInfoAfter = await protocolContract.LPsInfo(provider1tokenId);

        expect(decodedData.tokenId).to.be.equal(provider1tokenId);
        expect(decodedData.userCapital).to.be.equal(365000);
        expect(decodedData.rewardsGross).to.be.equal(18);
        expect(decodedData.rewardsNet).to.be.equal(15);
        expect(decodedData.fee).to.be.equal(3);

        expect(
          lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex),
        ).to.be.equal(true);
        expect(lpInfoAfter.beginClaimIndex).to.be.equal(
          lpInfoBefore.beginClaimIndex,
        );
      });

      it(`Should call takeInterest for LP1 after 10 days again`, async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider1,
          0,
        );

        const lpInfoBefore = await protocolContract.LPsInfo(provider1tokenId);

        const decodedData = await ProtocolHelper.takeInterest(
          liquidityProvider1,
          provider1tokenId,
          0,
          10 * 24 * 60 * 60,
          2,
        );

        const lpInfoAfter = await protocolContract.LPsInfo(provider1tokenId);

        expect(decodedData.tokenId).to.be.equal(provider1tokenId);
        expect(decodedData.userCapital).to.be.equal(365000);
        expect(decodedData.rewardsGross).to.be.equal(180);
        expect(decodedData.rewardsNet).to.be.equal(180 - (180 * 15) / 100);
        expect(decodedData.fee).to.be.equal((180 * 15) / 100);

        expect(
          lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex),
        ).to.be.equal(true);
        expect(lpInfoAfter.beginClaimIndex).to.be.equal(
          lpInfoBefore.beginClaimIndex,
        );
      });

      it(`Should call takeInterest for LP2 after 1 day`, async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider2,
          0,
        );

        const lpInfoBefore = await protocolContract.LPsInfo(provider2tokenId);

        const decodedData = await ProtocolHelper.takeInterest(
          liquidityProvider2,
          provider2tokenId,
          0,
          1 * 24 * 60 * 60,
          2,
        );

        const lpInfoAfter = await protocolContract.LPsInfo(provider2tokenId);

        expect(decodedData.tokenId).to.be.equal(provider2tokenId);
        expect(decodedData.userCapital).to.be.equal(365000);
        expect(decodedData.rewardsGross).to.be.equal(264);
        expect(decodedData.rewardsNet).to.be.equal(264 - 14);
        expect(decodedData.fee).to.be.equal(14);

        expect(
          lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex),
        ).to.be.equal(true);
        expect(lpInfoAfter.beginClaimIndex).to.be.equal(
          lpInfoBefore.beginClaimIndex,
        );
      });

      it(`Should call takeInterest for LP2 after 1 day again`, async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider2,
          0,
        );

        const lpInfoBefore = await protocolContract.LPsInfo(provider2tokenId);

        const decodedData = await ProtocolHelper.takeInterest(
          liquidityProvider2,
          provider2tokenId,
          0,
          1 * 24 * 60 * 60,
          2,
        );

        const lpInfoAfter = await protocolContract.LPsInfo(provider2tokenId);

        expect(decodedData.tokenId).to.be.equal(provider2tokenId);
        expect(decodedData.userCapital).to.be.equal(365000);
        expect(decodedData.rewardsGross).to.be.equal(18);
        expect(decodedData.rewardsNet).to.be.equal(17);
        expect(decodedData.fee).to.be.equal(1);

        expect(
          lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex),
        ).to.be.equal(true);
        expect(lpInfoAfter.beginClaimIndex).to.be.equal(
          lpInfoBefore.beginClaimIndex,
        );
      });

      it(`Should call takeInterest for LP2 after 611 day again`, async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider2,
          0,
        );

        const lpInfoBefore = await protocolContract.LPsInfo(provider2tokenId);

        const decodedData = await ProtocolHelper.takeInterest(
          liquidityProvider2,
          provider2tokenId,
          0,
          611 * 24 * 60 * 60,
          4,
        );

        const lpInfoAfter = await protocolContract.LPsInfo(provider2tokenId);

        expect(decodedData.tokenId).to.be.equal(provider2tokenId);
        expect(decodedData.userCapital).to.be.equal(365000);
        expect(decodedData.rewardsGross).to.be.equal(5193);
        expect(decodedData.rewardsNet).to.be.equal(5193 - 260);
        expect(decodedData.fee).to.be.equal(260);

        expect(
          lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex),
        ).to.be.equal(true);
        expect(lpInfoAfter.beginClaimIndex).to.be.equal(
          lpInfoBefore.beginClaimIndex,
        );
      });

      it(`Should call takeInterest for LP2 after 1 day again`, async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider2,
          0,
        );

        const lpInfoBefore = await protocolContract.LPsInfo(provider2tokenId);

        const decodedData = await ProtocolHelper.takeInterest(
          liquidityProvider2,
          provider2tokenId,
          0,
          1 * 24 * 60 * 60,
          2,
        );

        const lpInfoAfter = await protocolContract.LPsInfo(provider2tokenId);

        expect(decodedData.tokenId).to.be.equal(provider2tokenId);
        expect(decodedData.userCapital).to.be.equal(365000);
        expect(decodedData.rewardsGross).to.be.equal(0);
        expect(decodedData.rewardsNet).to.be.equal(0);
        expect(decodedData.fee).to.be.equal(0);

        expect(lpInfoAfter.beginLiquidityIndex).to.be.equal(
          lpInfoBefore.beginLiquidityIndex,
        );
        expect(lpInfoAfter.beginClaimIndex).to.be.equal(
          lpInfoBefore.beginClaimIndex,
        );
      });

      it(`Should call takeInterest for LP2 after 1 day again`, async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider2,
          0,
        );

        const lpInfoBefore = await protocolContract.LPsInfo(provider2tokenId);

        const decodedData = await ProtocolHelper.takeInterest(
          liquidityProvider2,
          provider2tokenId,
          0,
          1 * 24 * 60 * 60,
          2,
        );

        const lpInfoAfter = await protocolContract.LPsInfo(provider2tokenId);

        expect(decodedData.tokenId).to.be.equal(provider2tokenId);
        expect(decodedData.userCapital).to.be.equal(365000);
        expect(decodedData.rewardsGross).to.be.equal(0);
        expect(decodedData.rewardsNet).to.be.equal(0);
        expect(decodedData.fee).to.be.equal(0);

        expect(lpInfoAfter.beginLiquidityIndex).to.be.equal(
          lpInfoBefore.beginLiquidityIndex,
        );
        expect(lpInfoAfter.beginClaimIndex).to.be.equal(
          lpInfoBefore.beginClaimIndex,
        );
      });

      it(`Should call takeInterest for LP1 after 1 day`, async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider1,
          0,
        );

        const lpInfoBefore = await protocolContract.LPsInfo(provider1tokenId);

        const decodedData = await ProtocolHelper.takeInterest(
          liquidityProvider1,
          provider1tokenId,
          0,
          1 * 24 * 60 * 60,
          2,
        );

        const lpInfoAfter = await protocolContract.LPsInfo(provider1tokenId);

        expect(decodedData.tokenId).to.be.equal(provider1tokenId);
        expect(decodedData.userCapital).to.be.equal(365000);
        expect(decodedData.rewardsGross).to.be.equal(5229);
        expect(decodedData.rewardsNet).to.be.equal(5229 - 785);
        expect(decodedData.fee).to.be.equal(785); //785 = roundingUp((5229 * 15) / 100)

        expect(
          lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex),
        ).to.be.equal(true);
        expect(lpInfoAfter.beginClaimIndex).to.be.equal(
          lpInfoBefore.beginClaimIndex,
        );
      });
    });

    describe("LP1 then PT1, PT2 then LP2 in pool 0", async function () {
      before(async function () {
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

        // ================= Cover Providers ================= //

        const USDT_amount1 = "365000";
        const ATEN_amount1 = "100000";
        await ProtocolHelper.deposit(
          liquidityProvider1,
          USDT_amount1,
          ATEN_amount1,
          [0, 2],
          1 * 24 * 60 * 60,
        );

        // ================= Policy Buyers ================= //

        await this.helpers.maxApproveUsdt(
          policyTaker1,
          ProtocolHelper.getAthenaContract().address,
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
          20 * 24 * 60 * 60,
        );

        await this.helpers.maxApproveUsdt(
          policyTaker2,
          ProtocolHelper.getAthenaContract().address,
        );

        const capital2 = "109500";
        const premium2 = "4380";
        const atensLocked2 = "0";
        await ProtocolHelper.buyPolicy(
          policyTaker2,
          capital2,
          premium2,
          atensLocked2,
          0,
          10 * 24 * 60 * 60,
        );

        const USDT_amount2 = "365000";
        const ATEN_amount2 = "9000000";
        await ProtocolHelper.deposit(
          liquidityProvider2,
          USDT_amount2,
          ATEN_amount2,
          [0, 1],
          1 * 24 * 60 * 60,
        );

        // @dev calc method
        //PT1: UR = 30%; PR = 3%; ER = 9, (PT1 -> 9)
        //10 days => LP1 <- 9 * 10 = 90; PT1 <- 2190 - 90 = 2100
        //PT2: UR = 60%; PR = 5%; ER = 30, (PT1 -> 15; PT2 -> 15)
        //1 day => LP1 <- 30 + 90 = 120; PT1 <- 2100 - 15 = 2085; PT2 <- 4380 - 15 = 4365
        //LP2: UR = 30%; PR = 3%; ER = 18 (PT1 -> 9; PT2 -> 9)
      });

      it("Should check policy1 initial info", async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          0,
        );
        const policyInfo = await protocolContract.premiumPositions(
          await ProtocolHelper.getAccountCoverIdByIndex(policyTaker1, 0),
        );

        expect(policyInfo.beginPremiumRate).to.be.equal(
          "3000000000000000000000000000",
        );
        expect(policyInfo.coverIdIndex).to.be.equal("0");
        expect(policyInfo.lastTick).to.be.equal(730);
      });

      it("Should get policy1 remaning info", async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          0,
        );

        const coverId = await ProtocolHelper.getAccountCoverIdByIndex(
          policyTaker1,
          0,
        );
        const response = await protocolContract.getInfo(coverId);

        expect(response.__premiumLeft).to.be.equal(2085);
        expect(response.__currentEmissionRate).to.be.equal(9);
        expect(response.__remainingSeconds).to.be.equal(20016000);
      });

      it("Should check policy2 initial info", async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker2,
          0,
        );
        const policyInfo = await protocolContract.premiumPositions(
          await ProtocolHelper.getAccountCoverIdByIndex(policyTaker2, 0),
        );

        expect(policyInfo.beginPremiumRate).to.be.equal(
          "5000000000000000000000000000",
        );
        expect(policyInfo.coverIdIndex).to.be.equal("0");
        expect(policyInfo.lastTick).to.be.equal(1490);
      });

      it("Should get policy2 remaning info", async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          0,
        );

        const coverId = await ProtocolHelper.getAccountCoverIdByIndex(
          policyTaker2,
          0,
        );
        const response = await protocolContract.getInfo(coverId);

        expect(response.__premiumLeft).to.be.equal(4365);
        expect(response.__currentEmissionRate).to.be.equal(9);
        expect(response.__remainingSeconds).to.be.equal(52848000);
      });

      it("Should check LP1's info", async function () {
        let lpInfo = await protocolPool0.LPsInfo(provider1tokenId);

        expect(lpInfo.beginLiquidityIndex).to.be.equal(0);
        expect(lpInfo.beginClaimIndex).to.be.equal(0);
      });

      it("Should check LP2's info", async function () {
        let lpInfo = await protocolPool0.LPsInfo(provider2tokenId);

        expect(lpInfo.beginLiquidityIndex).to.not.be.equal(0);
        expect(lpInfo.beginClaimIndex).to.be.equal(0);
      });

      it(`Should call takeInterest for LP1 after 1 day`, async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider1,
          0,
        );

        const lpInfoBefore = await protocolContract.LPsInfo(provider1tokenId);

        const decodedData = await ProtocolHelper.takeInterest(
          liquidityProvider1,
          provider1tokenId,
          0,
          1 * 24 * 60 * 60,
          2,
        );

        const lpInfoAfter = await protocolContract.LPsInfo(provider1tokenId);

        expect(decodedData.tokenId).to.be.equal(provider1tokenId);
        expect(decodedData.userCapital).to.be.equal(365000);
        expect(decodedData.rewardsGross).to.be.equal(129);
        expect(decodedData.rewardsNet).to.be.equal(109);
        expect(decodedData.fee).to.be.equal(20);

        expect(
          lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex),
        ).to.be.equal(true);
        expect(lpInfoAfter.beginClaimIndex).to.be.equal(
          lpInfoBefore.beginClaimIndex,
        );
      });

      it(`Should call takeInterest for LP2 after 1 day`, async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider2,
          0,
        );

        const lpInfoBefore = await protocolContract.LPsInfo(provider2tokenId);

        const decodedData = await ProtocolHelper.takeInterest(
          liquidityProvider2,
          provider2tokenId,
          0,
          1 * 24 * 60 * 60,
          2,
        );

        const lpInfoAfter = await protocolContract.LPsInfo(provider2tokenId);

        expect(decodedData.tokenId).to.be.equal(provider2tokenId);
        expect(decodedData.userCapital).to.be.equal(365000);
        expect(decodedData.rewardsGross).to.be.equal(18);
        expect(decodedData.rewardsNet).to.be.equal(17);
        expect(decodedData.fee).to.be.equal(1);

        expect(
          lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex),
        ).to.be.equal(true);
        expect(lpInfoAfter.beginClaimIndex).to.be.equal(
          lpInfoBefore.beginClaimIndex,
        );
      });

      it(`Should call takeInterest for LP1 after 1 day`, async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider1,
          0,
        );

        const lpInfoBefore = await protocolContract.LPsInfo(provider1tokenId);

        const decodedData = await ProtocolHelper.takeInterest(
          liquidityProvider1,
          provider1tokenId,
          0,
          1 * 24 * 60 * 60,
          2,
        );

        const lpInfoAfter = await protocolContract.LPsInfo(provider1tokenId);

        expect(decodedData.tokenId).to.be.equal(provider1tokenId);
        expect(decodedData.userCapital).to.be.equal(365000);
        expect(decodedData.rewardsGross).to.be.equal(18);
        expect(decodedData.rewardsNet).to.be.equal(15);
        expect(decodedData.fee).to.be.equal(3);

        expect(
          lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex),
        ).to.be.equal(true);
        expect(lpInfoAfter.beginClaimIndex).to.be.equal(
          lpInfoBefore.beginClaimIndex,
        );
      });
    });
  });
}
