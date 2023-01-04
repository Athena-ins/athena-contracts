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
let policyTaker1: ethers.Signer;

describe("Buy policies", () => {
  before(async () => {
    await HardhatHelper.reset();
    const allSigners = await HardhatHelper.allSigners();
    owner = allSigners[0];
    liquidityProvider1 = allSigners[1];
    policyTaker1 = allSigners[100];

    await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
    await ProtocolHelper.addNewProtocolPool("Test protocol 0");
    await ProtocolHelper.addNewProtocolPool("Test protocol 1");
    await ProtocolHelper.addNewProtocolPool("Test protocol 2");

    const USDT_amount1 = "730000";
    const ATEN_amount1 = "100000";
    await ProtocolHelper.deposit(
      liquidityProvider1,
      USDT_amount1,
      ATEN_amount1,
      [0, 1, 2],
      1 * 24 * 60 * 60
    );
  });

  describe("Should buy policies for policy taker 1 in pool 0, 1, 2", () => {
    const premium = "6000";
    const atensLocked = "0";

    it("Should prepare USDT balance", async () => {
      expect(
        await HardhatHelper.USDT_balanceOf(await policyTaker1.getAddress())
      ).to.be.equal(0);

      await HardhatHelper.USDT_transfer(
        await policyTaker1.getAddress(),
        hre_ethers.utils.parseUnits(premium, 6)
      );

      expect(
        await HardhatHelper.USDT_balanceOf(await policyTaker1.getAddress())
      ).to.be.equal(hre_ethers.utils.parseUnits(premium, 6));
    });

    it("Should success buy policies in protocol 0, 1, 2", async () => {
      const USDT_Approved = await HardhatHelper.USDT_maxApprove(
        policyTaker1,
        ProtocolHelper.getAthenaContract().address
      );

      expect(USDT_Approved).to.haveOwnProperty("hash");

      await HardhatHelper.setNextBlockTimestamp(20 * 24 * 60 * 60);

      const tx = await ProtocolHelper.getAthenaContract()
        .connect(policyTaker1)
        .buyPolicies(
          [109500, 219000, 438000],
          [1000, 2000, 4000],
          [atensLocked, atensLocked, atensLocked],
          [0, 1, 2]
        );
      expect(tx).to.haveOwnProperty("hash");
    });

    it("Should check policy info in pool 0", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker1,
        0
      );
      const policyInfo = await protocolContract.premiumPositions(
        await policyTaker1.getAddress()
      );

      expect(policyInfo.beginPremiumRate).to.be.equal(
        "2000000000000000000000000000"
      );
      expect(policyInfo.ownerIndex).to.be.equal("0");
      expect(policyInfo.lastTick).to.be.equal(333);
    });

    it("Should check policy info in pool 1", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker1,
        1
      );
      const policyInfo = await protocolContract.premiumPositions(
        await policyTaker1.getAddress()
      );

      expect(policyInfo.beginPremiumRate).to.be.equal(
        "3000000000000000000000000000"
      );
      expect(policyInfo.ownerIndex).to.be.equal("0");
      expect(policyInfo.lastTick).to.be.equal(333);
    });

    it("Should check policy info in pool 2", async () => {
      const protocolContract = await ProtocolHelper.getProtocolPoolContract(
        policyTaker1,
        2
      );
      const policyInfo = await protocolContract.premiumPositions(
        await policyTaker1.getAddress()
      );

      expect(policyInfo.beginPremiumRate).to.be.equal(
        "5000000000000000000000000000"
      );
      expect(policyInfo.ownerIndex).to.be.equal("0");
      expect(policyInfo.lastTick).to.be.equal(333);
    });

    it("Should check NFT", async () => {
      const POLICY_MANAGER_CONTRACT = ProtocolHelper.getPolicyManagerContract();

      const balance = await POLICY_MANAGER_CONTRACT.balanceOf(
        await policyTaker1.getAddress()
      );
      expect(balance).to.equal(3);

      /////
      const tokenId0 = await POLICY_MANAGER_CONTRACT.tokenOfOwnerByIndex(
        await policyTaker1.getAddress(),
        0
      );
      expect(tokenId0).to.equal(0);

      const policy0 = await POLICY_MANAGER_CONTRACT.policy(tokenId0);
      expect(policy0.amountCovered).to.equal(109500);
      expect(policy0.poolId).to.equal(BN(0));

      const poolContract0 = await ProtocolHelper.getProtocolPoolContract(
        policyTaker1,
        0
      );

      expect((await poolContract0.id()).toString() === "0").to.equal(true);

      const balancePool0 = await HardhatHelper.USDT_balanceOf(
        poolContract0.address
      );
      expect(balancePool0).to.equal(1000);

      /////
      const tokenId1 = await POLICY_MANAGER_CONTRACT.tokenOfOwnerByIndex(
        await policyTaker1.getAddress(),
        1
      );
      expect(tokenId1).to.equal(1);

      const policy1 = await POLICY_MANAGER_CONTRACT.policy(tokenId1);
      expect(policy1.amountCovered).to.equal(219000);
      1;
      expect(policy1.poolId).to.equal(BN(1));
      1;

      const poolContract1 = await ProtocolHelper.getProtocolPoolContract(
        policyTaker1,
        1
      );

      expect((await poolContract1.id()).toString() === "1").to.equal(true);

      const balancePool1 = await HardhatHelper.USDT_balanceOf(
        poolContract1.address
      );
      expect(balancePool1).to.equal(2000);

      /////
      const tokenId2 = await POLICY_MANAGER_CONTRACT.tokenOfOwnerByIndex(
        await policyTaker1.getAddress(),
        2
      );
      expect(tokenId2).to.equal(2);

      const policy2 = await POLICY_MANAGER_CONTRACT.policy(tokenId2);
      expect(policy2.amountCovered).to.equal(438000);

      expect(policy2.poolId).to.equal(BN(2));

      const poolContract2 = await ProtocolHelper.getProtocolPoolContract(
        policyTaker1,
        2
      );

      expect((await poolContract2.id()).toString() === "2").to.equal(true);

      const balancePool2 = await HardhatHelper.USDT_balanceOf(
        poolContract2.address
      );
      expect(balancePool2).to.equal(4000);
    });

    it("Should reverted for buying policies in protocol 0 cause of duration", async () => {
      const allSigners = await HardhatHelper.allSigners();
      const policyTaker2 = allSigners[101];

      await HardhatHelper.USDT_transfer(
        await policyTaker2.getAddress(),
        hre_ethers.utils.parseUnits("1000", 6)
      );

      const USDT_Approved = await HardhatHelper.USDT_maxApprove(
        policyTaker2,
        ProtocolHelper.getAthenaContract().address
      );

      expect(USDT_Approved).to.haveOwnProperty("hash");

      await HardhatHelper.setNextBlockTimestamp(20 * 24 * 60 * 60);

      await expect(
        ProtocolHelper.getAthenaContract()
          .connect(policyTaker2)
          .buyPolicies([109500], [1], [atensLocked], [0])
      ).to.be.revertedWith("Min duration");
    });
  });
});
