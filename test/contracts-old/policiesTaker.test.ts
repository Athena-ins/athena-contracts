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
let policyTaker1: Signer;

export function testPoliciesTaker() {
  describe("Buy policies", function () {
    before(async function () {
      const allSigners = await ethers.getSigners();
      owner = allSigners[0];
      liquidityProvider1 = allSigners[1];
      policyTaker1 = allSigners[100];

      await this.helpers.addNewProtocolPool("Test protocol 0");
      await this.helpers.addNewProtocolPool("Test protocol 1");
      await this.helpers.addNewProtocolPool("Test protocol 2");

      const USDT_amount1 = "730000";
      const ATEN_amount1 = "100000";
      await this.helpers.deposit(
        liquidityProvider1,
        USDT_amount1,
        ATEN_amount1,
        [0, 1, 2],
        1 * 24 * 60 * 60,
      );
    });

    describe("Should buy policies for policy taker 1 in pool 0, 1, 2", function () {
      const premium = "6000";
      const atensLocked = "0";

      it("Should prepare USDT balance", async function () {
        expect(
          await this.contracts.USDT.balanceOf(await policyTaker1.getAddress()),
        ).to.be.equal(0);

        await this.helpers.getUsdt(
          await policyTaker1.getAddress(),
          ethers.utils.parseUnits(premium, 6),
        );

        expect(
          await this.contracts.USDT.balanceOf(await policyTaker1.getAddress()),
        ).to.be.equal(ethers.utils.parseUnits(premium, 6));
      });

      it("Should success buy policies in protocol 0, 1, 2", async function () {
        const USDT_Approved = await this.helpers.maxApproveUsdt(
          policyTaker1,
          this.contracts.Athena.address,
        );

        expect(USDT_Approved).to.haveOwnProperty("transactionHash");

        await setNextBlockTimestamp(20 * 24 * 60 * 60);

        const tx = await this.contracts.Athena.connect(
          policyTaker1,
        ).buyPolicies(
          [109500, 219000, 438000],
          [1000, 2000, 4000],
          [atensLocked, atensLocked, atensLocked],
          [0, 1, 2],
        );
        expect(tx).to.haveOwnProperty("hash");
      });

      it("Should check policy info in pool 0", async function () {
        const protocolContract = await this.helpers.getProtocolPoolContract(
          policyTaker1,
          0,
        );
        const policyInfo = await protocolContract.premiumPositions(
          await this.helpers.getAccountCoverIdByIndex(policyTaker1, 0),
        );

        expect(policyInfo.beginPremiumRate).to.be.equal(
          "2000000000000000000000000000",
        );
        expect(policyInfo.coverIdIndex).to.be.equal("0");
        expect(policyInfo.lastTick).to.be.equal(333);
      });

      it("Should check policy info in pool 1", async function () {
        const protocolContract = await this.helpers.getProtocolPoolContract(
          policyTaker1,
          1,
        );
        const policyInfo = await protocolContract.premiumPositions(
          await this.helpers.getAccountCoverIdByIndex(policyTaker1, 1),
        );

        expect(policyInfo.beginPremiumRate).to.be.equal(
          "3000000000000000000000000000",
        );
        expect(policyInfo.coverIdIndex).to.be.equal("0");
        expect(policyInfo.lastTick).to.be.equal(333);
      });

      it("Should check policy info in pool 2", async function () {
        const protocolContract = await this.helpers.getProtocolPoolContract(
          policyTaker1,
          2,
        );
        const policyInfo = await protocolContract.premiumPositions(
          await this.helpers.getAccountCoverIdByIndex(policyTaker1, 2),
        );

        expect(policyInfo.beginPremiumRate).to.be.equal(
          "5000000000000000000000000000",
        );
        expect(policyInfo.coverIdIndex).to.be.equal("0");
        expect(policyInfo.lastTick).to.be.equal(333);
      });

      it("Should check NFT", async function () {
        const POLICY_MANAGER_CONTRACT = this.contracts.PolicyManager;

        const balance = await POLICY_MANAGER_CONTRACT.balanceOf(
          await policyTaker1.getAddress(),
        );
        expect(balance).to.equal(3);

        /////
        const tokenId0 = await POLICY_MANAGER_CONTRACT.tokenOfOwnerByIndex(
          await policyTaker1.getAddress(),
          0,
        );
        expect(tokenId0).to.equal(0);

        const policy0 = await POLICY_MANAGER_CONTRACT.policy(tokenId0);
        expect(policy0.amountCovered).to.equal(109500);
        expect(policy0.poolId).to.equal(BN(0));

        const poolContract0 = await this.helpers.getProtocolPoolContract(
          policyTaker1,
          0,
        );

        expect((await poolContract0.poolId()).toString() === "0").to.equal(
          true,
        );

        const balancePool0 = await this.contracts.USDT.balanceOf(
          poolContract0.address,
        );
        expect(balancePool0).to.equal(1000);

        /////
        const tokenId1 = await POLICY_MANAGER_CONTRACT.tokenOfOwnerByIndex(
          await policyTaker1.getAddress(),
          1,
        );
        expect(tokenId1).to.equal(1);

        const policy1 = await POLICY_MANAGER_CONTRACT.policy(tokenId1);
        expect(policy1.amountCovered).to.equal(219000);
        1;
        expect(policy1.poolId).to.equal(BN(1));
        1;

        const poolContract1 = await this.helpers.getProtocolPoolContract(
          policyTaker1,
          1,
        );

        expect((await poolContract1.poolId()).toString() === "1").to.equal(
          true,
        );

        const balancePool1 = await this.contracts.USDT.balanceOf(
          poolContract1.address,
        );
        expect(balancePool1).to.equal(2000);

        /////
        const tokenId2 = await POLICY_MANAGER_CONTRACT.tokenOfOwnerByIndex(
          await policyTaker1.getAddress(),
          2,
        );
        expect(tokenId2).to.equal(2);

        const policy2 = await POLICY_MANAGER_CONTRACT.policy(tokenId2);
        expect(policy2.amountCovered).to.equal(438000);

        expect(policy2.poolId).to.equal(BN(2));

        const poolContract2 = await this.helpers.getProtocolPoolContract(
          policyTaker1,
          2,
        );

        expect((await poolContract2.poolId()).toString() === "2").to.equal(
          true,
        );

        const balancePool2 = await this.contracts.USDT.balanceOf(
          poolContract2.address,
        );
        expect(balancePool2).to.equal(4000);
      });

      it("Should reverted for buying policies in protocol 0 cause of duration", async function () {
        const allSigners = await ethers.getSigners();
        const policyTaker2 = allSigners[101];

        await this.helpers.getUsdt(
          await policyTaker2.getAddress(),
          ethers.utils.parseUnits("1000", 6),
        );

        const USDT_Approved = await this.helpers.maxApproveUsdt(
          policyTaker2,
          this.contracts.Athena.address,
        );

        expect(USDT_Approved).to.haveOwnProperty("transactionHash");

        await setNextBlockTimestamp(20 * 24 * 60 * 60);

        expect(
          await this.contracts.Athena.connect(policyTaker2).buyPolicies(
            [109500],
            [1],
            [atensLocked],
            [0],
          ),
        ).to.be.revertedWith("Min duration");
      });
    });
  });
}
