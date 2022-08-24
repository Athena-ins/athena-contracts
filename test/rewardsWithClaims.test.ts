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

describe("Liquidity provider rewards", () => {
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

    const USDT_amount1 = "365000";
    const ATEN_amount1 = "100000";
    await ProtocolHelper.deposit(
      liquidityProvider1,
      USDT_amount1,
      ATEN_amount1,
      [0, 2],
      1 * 24 * 60 * 60
    );

    const USDT_amount2 = "365000";
    const ATEN_amount2 = "9000000";
    await ProtocolHelper.deposit(
      liquidityProvider2,
      USDT_amount2,
      ATEN_amount2,
      [0, 1],
      1 * 24 * 60 * 60
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

  describe("LP1", async () => {
    it("Should check LPInfo", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let lpInfo = await protocolPool0.LPsInfo(liquidityProvider1.getAddress());
      expect(lpInfo.beginLiquidityIndex).to.be.equal(0);
      expect(lpInfo.beginClaimIndex).to.be.equal(0);
    });

    it("Should call _rewardsOf and check data", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + 1 * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(48);
    });
  });

  describe("LP2", async () => {
    it("Should check LPInfo", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let lpInfo = await protocolPool0.LPsInfo(liquidityProvider2.getAddress());
      expect(lpInfo.beginLiquidityIndex).to.be.equal(0);
      expect(lpInfo.beginClaimIndex).to.be.equal(0);
    });

    it("Should call _rewardsOf and check data", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let result = await protocolPool0._rewardsOf(
        await liquidityProvider2.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + 2 * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(66);
    });
  });

  describe("Claim", async () => {
    it("Should add a claim in protocol2 and check claim info in protocol0", async () => {
      await ProtocolHelper.claim(owner, 2, "182500", 1 * 24 * 60 * 60);

      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const claim = await protocolPool0.claims(0);

      expect(claim.fromProtocolId).to.be.equal(2);
      expect(claim.ratio).to.be.equal("500000000000000000000000000");
      expect(claim.liquidityIndexBeforeClaim).to.not.be.equal(0);
      expect(claim.liquidityIndexBeforeClaim).to.be.equal(
        "131506849315068493150684"
      );
    });

    it("Should call _rewardsOf for LP1 after 1 day of added claim and check result", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const result = await protocolPool0._rewardsOf(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + 1 * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(182500);
      expect(result.__totalRewards).to.be.equal(63);
    });

    it("Should call _rewardsOf for LP2 after 1 day of added claim and check result", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const result = await protocolPool0._rewardsOf(
        await liquidityProvider2.getAddress(),
        365000,
        [0, 1],
        HardhatHelper.getCurrentTime() + 1 * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(78);
    });

    it("Should call _rewardsOf for LP1 after 2 day of added claim and check result", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const result = await protocolPool0._rewardsOf(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + 2 * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(182500);
      expect(result.__totalRewards).to.be.equal(63 + 15);
    });

    it("Should call _rewardsOf for LP2 after 2 day of added claim and check result", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const result = await protocolPool0._rewardsOf(
        await liquidityProvider2.getAddress(),
        365000,
        [0, 1],
        HardhatHelper.getCurrentTime() + 2 * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(78 + 30);
    });

    it("Should call _rewardsOf for LP1 after 10 day of added claim and check result", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const result = await protocolPool0._rewardsOf(
        await liquidityProvider1.getAddress(),
        365000,
        [0, 2],
        HardhatHelper.getCurrentTime() + 10 * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(182500);
      expect(result.__totalRewards).to.be.equal(63 - 15 + 150);
    });

    it("Should call _rewardsOf for LP2 after 10 day of added claim and check result", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      const result = await protocolPool0._rewardsOf(
        await liquidityProvider2.getAddress(),
        365000,
        [0, 1],
        HardhatHelper.getCurrentTime() + 10 * 24 * 60 * 60
      );

      expect(result.__finalUserCapital).to.be.equal(365000);
      expect(result.__totalRewards).to.be.equal(78 - 30 + 300);
    });
  });
});
