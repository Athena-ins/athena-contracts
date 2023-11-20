import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "../helpers/HardhatHelper";
import ProtocolHelper from "../helpers/ProtocolHelper";

chai.use(chaiAsPromised);

const BN = (num: string | number) => hre_ethers.BigNumber.from(num);

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
let policyTaker1: ethers.Signer;
let policyTaker2: ethers.Signer;

export function testPolicyTaker() {
  describe("Buy policy", () => {
    before(async () => {
      const allSigners = await HardhatHelper.allSigners();
      owner = allSigners[0];
      liquidityProvider1 = allSigners[1];
      liquidityProvider2 = allSigners[2];
      policyTaker1 = allSigners[100];
      policyTaker2 = allSigners[101];

      await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
      await ProtocolHelper.addNewProtocolPool("Test protocol 0");
      await ProtocolHelper.addNewProtocolPool("Test protocol 1");
      await ProtocolHelper.addNewProtocolPool("Test protocol 2");

      const USDT_amount1 = "400000";
      const ATEN_amount1 = "100000";
      await ProtocolHelper.deposit(
        liquidityProvider1,
        USDT_amount1,
        ATEN_amount1,
        [0, 2],
        1 * 24 * 60 * 60,
      );

      const USDT_amount2 = "330000";
      const ATEN_amount2 = "9000000";
      await ProtocolHelper.deposit(
        liquidityProvider2,
        USDT_amount2,
        ATEN_amount2,
        [0, 1, 2],
        1 * 24 * 60 * 60,
      );
    });

    let totalPremium = BN(0);

    describe("Should do actions of policy taker 1", () => {
      const capital = "109500";
      const premium = "2190";
      const atensLocked = "0";

      it("Should prepare USDT balance", async () => {
        expect(
          await HardhatHelper.USDT_balanceOf(await policyTaker1.getAddress()),
        ).to.be.equal(0);

        await HardhatHelper.USDT_transfer(
          await policyTaker1.getAddress(),
          hre_ethers.utils.parseUnits(premium, 6),
        );

        expect(
          await HardhatHelper.USDT_balanceOf(await policyTaker1.getAddress()),
        ).to.be.equal(hre_ethers.utils.parseUnits(premium, 6));
      });

      it("Should success buy policy in protocol 0 for 1 year", async () => {
        const USDT_Approved = await HardhatHelper.USDT_maxApprove(
          policyTaker1,
          ProtocolHelper.getAthenaContract().address,
        );

        expect(USDT_Approved).to.haveOwnProperty("transactionHash");

        await HardhatHelper.setNextBlockTimestamp(20 * 24 * 60 * 60);

        const tx = await ProtocolHelper.getAthenaContract()
          .connect(policyTaker1)
          .buyPolicies([capital], [premium], [atensLocked], [0]);
        expect(tx).to.haveOwnProperty("hash");

        totalPremium = totalPremium.add(premium);
      });

      it("Should check policy info", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          0,
        );

        const coverId = await ProtocolHelper.getAccountCoverIdByIndex(
          policyTaker1,
          0,
        );
        const policyInfo = await protocolContract.premiumPositions(coverId);

        expect(policyInfo.beginPremiumRate).to.be.equal(
          "2000000000000000000000000000",
        );
        expect(policyInfo.coverIdIndex).to.be.equal("0");
        expect(policyInfo.lastTick).to.be.equal(730);
      });

      it("Should get info", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          0,
        );

        const coverId = await ProtocolHelper.getAccountCoverIdByIndex(
          policyTaker1,
          0,
        );
        const response = await protocolContract.getInfo(coverId);

        expect(response.__premiumLeft).to.be.equal(2190);
        expect(response.__currentEmissionRate).to.be.equal(6);
        expect(response.__remainingSeconds).to.be.equal(365 * 24 * 60 * 60);
      });

      it("Should check slot0 in protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          0,
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(0);
        expect(slot0.secondsPerTick).to.be.equal("43200");
        expect(slot0.totalInsuredCapital).to.be.equal("109500");
        expect(slot0.remainingPolicies).to.be.equal("1");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          await HardhatHelper.getCurrentTime(),
        );

        const premiumRate = await protocolContract.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("2000000000000000000000000000");

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal("730000");
      });

      it("Should check NFT", async () => {
        const POLICY_MANAGER_CONTRACT =
          ProtocolHelper.getPolicyManagerContract();

        const balance = await POLICY_MANAGER_CONTRACT.balanceOf(
          await policyTaker1.getAddress(),
        );
        expect(balance).to.equal(1);

        const tokenId = await POLICY_MANAGER_CONTRACT.tokenOfOwnerByIndex(
          await policyTaker1.getAddress(),
          0,
        );
        expect(tokenId).to.equal(0);

        const policy = await POLICY_MANAGER_CONTRACT.policy(tokenId);
        expect(policy.amountCovered).to.equal(capital);
        expect(policy.poolId).to.equal(BN(0));

        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          0,
        );

        expect((await protocolContract.poolId()).toString() === "0").to.equal(
          true,
        );

        const balanceProtocol = await HardhatHelper.USDT_balanceOf(
          protocolContract.address,
        );
        expect(balanceProtocol).to.equal(totalPremium);
      });
    });

    describe("Should do actions of policy taker 2", () => {
      const capital = "219000";
      const premium = "8760";
      const atensLocked = "0";

      it("Should prepare USDT balance", async () => {
        expect(
          await HardhatHelper.USDT_balanceOf(await policyTaker2.getAddress()),
        ).to.be.equal(0);

        await HardhatHelper.USDT_transfer(
          await policyTaker2.getAddress(),
          hre_ethers.utils.parseUnits(premium, 6),
        );

        expect(
          await HardhatHelper.USDT_balanceOf(await policyTaker2.getAddress()),
        ).to.be.equal(hre_ethers.utils.parseUnits(premium, 6));
      });

      it("Should success buy policy in protocol 0 for 1 year", async () => {
        const USDT_Approved = await HardhatHelper.USDT_maxApprove(
          policyTaker2,
          ProtocolHelper.getAthenaContract().address,
        );

        expect(USDT_Approved).to.haveOwnProperty("transactionHash");

        await HardhatHelper.setNextBlockTimestamp(10 * 24 * 60 * 60);

        const tx = await ProtocolHelper.getAthenaContract()
          .connect(policyTaker2)
          .buyPolicies([capital], [premium], [atensLocked], [0]);
        expect(tx).to.haveOwnProperty("hash");

        totalPremium = totalPremium.add(premium);
      });

      it("Should check policy info", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker2,
          0,
        );
        const policyInfo = await protocolContract.premiumPositions(
          await ProtocolHelper.getAccountCoverIdByIndex(policyTaker2, 0),
        );

        expect(policyInfo.beginPremiumRate).to.be.equal(
          "4000000000000000000000000000",
        );
        expect(policyInfo.coverIdIndex).to.be.equal("0");
        expect(policyInfo.lastTick).to.be.equal(1480);
      });

      it("Should get info", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker2,
          0,
        );

        const coverId = await ProtocolHelper.getAccountCoverIdByIndex(
          policyTaker2,
          0,
        );
        const response = await protocolContract.getInfo(coverId);

        expect(response.__premiumLeft).to.be.equal("8760");
        expect(response.__currentEmissionRate).to.be.equal("24");
        //remainingDay == 428 and not 365 because of expired policy of PT1
        expect(response.__remainingSeconds).to.be.equal("36936000");
      });

      it("Should check slot0 in protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker2,
          0,
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(20);
        expect(slot0.secondsPerTick).to.be.equal("21600");
        expect(slot0.totalInsuredCapital).to.be.equal("328500");
        expect(slot0.remainingPolicies).to.be.equal("2");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          await HardhatHelper.getCurrentTime(),
        );

        const premiumRate = await protocolContract.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("4000000000000000000000000000");

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal("730000");
      });

      it("Should check NFT", async () => {
        const POLICY_MANAGER_CONTRACT =
          ProtocolHelper.getPolicyManagerContract();

        const balance = await POLICY_MANAGER_CONTRACT.balanceOf(
          await policyTaker2.getAddress(),
        );
        expect(balance).to.equal(1);

        const tokenId = await POLICY_MANAGER_CONTRACT.tokenOfOwnerByIndex(
          await policyTaker2.getAddress(),
          0,
        );
        expect(tokenId).to.equal(1);

        const policy = await POLICY_MANAGER_CONTRACT.policy(tokenId);
        expect(policy.amountCovered).to.equal(capital);
        expect(policy.poolId).to.equal(BN(0));

        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker2,
          0,
        );

        expect((await protocolContract.poolId()).toString() === "0").to.equal(
          true,
        );

        const balanceProtocol = await HardhatHelper.USDT_balanceOf(
          protocolContract.address,
        );
        expect(balanceProtocol).to.equal(totalPremium);
      });
    });

    describe("Should check PolicyTaker1's info", () => {
      it("Should get info", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          0,
        );

        const coverId = await ProtocolHelper.getAccountCoverIdByIndex(
          policyTaker1,
          0,
        );
        const response = await protocolContract.getInfo(coverId);

        expect(response.__premiumLeft).to.be.equal(2130);
        expect(response.__currentEmissionRate).to.be.equal(12);
        expect(response.__remainingSeconds).to.be.equal(15336000);
      });

      it("Should check all position of LP2", async () => {
        const POSITIONS_MANAGER_CONTRACT =
          ProtocolHelper.getPositionManagerContract();

        const allPositions =
          await POSITIONS_MANAGER_CONTRACT.allPositionsOfOwner(
            await liquidityProvider2.getAddress(),
          );

        expect(allPositions.length).to.be.equal(1);
      });

      it("Should get info after policy has expired", async () => {
        const protocolContract =
          await ProtocolHelper.getPolicyManagerContract().connect(policyTaker1);

        const coverId = await ProtocolHelper.getAccountCoverIdByIndex(
          policyTaker1,
          0,
        );

        await HardhatHelper.setNextBlockTimestamp(177 * 24 * 60 * 60);

        const resBeforeExpire = await protocolContract.fullCoverData(coverId);
        expect(resBeforeExpire.premiumLeft).to.be.equal(6);
        expect(resBeforeExpire.dailyCost).to.be.equal(12);
        expect(resBeforeExpire.remainingDuration).to.be.equal(43200);

        await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);

        const response = await protocolContract.fullCoverData(coverId);
        expect(response.premiumLeft).to.be.equal(0);
        expect(response.dailyCost).to.be.equal(0);
        expect(response.remainingDuration).to.be.equal(0);
      });
    });
  });
}
