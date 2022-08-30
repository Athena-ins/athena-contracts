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

  it("Should add a claim in protocol2 and check claim info in protocol0", async () => {
    await ProtocolHelper.claim(owner, 2, "182500", 1 * 24 * 60 * 60);

    let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(owner, 0);

    const claim = await protocolPool0.claims(0);

    expect(claim.fromProtocolId).to.be.equal(2);
    expect(claim.ratio).to.be.equal("500000000000000000000000000");
    expect(claim.liquidityIndexBeforeClaim).to.not.be.equal(0);
    expect(claim.liquidityIndexBeforeClaim).to.be.equal(
      "131506849315068493150684"
    );
  });

  it("Should call takeInterest for LP1 after 1 day of added claim", async () => {
    const protocolContract = await ProtocolHelper.getProtocolPoolContract(
      liquidityProvider1,
      0
    );

    const lpInfoBefore = await protocolContract.LPsInfo(
      liquidityProvider1.getAddress()
    );

    const days = 1;

    await HardhatHelper.setNextBlockTimestamp(days * 24 * 60 * 60);

    const tx = await ProtocolHelper.getAthenaContract()
      .connect(liquidityProvider1)
      .takeInterest(0);

    const result = await tx.wait();

    const event = result.events[0];

    const decodedData = protocolContract.interface.decodeEventLog(
      event.topics[0],
      event.data
    );

    expect(decodedData.account).to.be.equal(
      await liquidityProvider1.getAddress()
    );
    expect(decodedData.userCapital).to.be.equal(182500);
    expect(decodedData.rewardsGross).to.be.equal(63);
    expect(decodedData.rewardsNet).to.be.equal(53);
    expect(decodedData.fee).to.be.equal(10);

    const lpInfoAfter = await protocolContract.LPsInfo(
      liquidityProvider1.getAddress()
    );

    expect(
      lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
    ).to.be.equal(true);
    expect(
      lpInfoAfter.beginClaimIndex.gt(lpInfoBefore.beginClaimIndex)
    ).to.be.equal(true);
    expect(lpInfoAfter.beginClaimIndex).to.be.equal(1);
  });

  it("Should call takeInterest for LP2 after 2 day of added claim", async () => {
    const protocolContract = await ProtocolHelper.getProtocolPoolContract(
      liquidityProvider2,
      0
    );

    const lpInfoBefore = await protocolContract.LPsInfo(
      liquidityProvider2.getAddress()
    );

    const days = 1;

    await HardhatHelper.setNextBlockTimestamp(days * 24 * 60 * 60);

    const tx = await ProtocolHelper.getAthenaContract()
      .connect(liquidityProvider2)
      .takeInterest(0);

    const result = await tx.wait();

    const event = result.events[0];

    const decodedData = protocolContract.interface.decodeEventLog(
      event.topics[0],
      event.data
    );

    expect(decodedData.account).to.be.equal(
      await liquidityProvider2.getAddress()
    );
    expect(decodedData.userCapital).to.be.equal(365000);
    expect(decodedData.rewardsGross).to.be.equal(78 + 30);
    expect(decodedData.rewardsNet).to.be.equal(102);
    expect(decodedData.fee).to.be.equal(6);

    const lpInfoAfter = await protocolContract.LPsInfo(
      liquidityProvider2.getAddress()
    );

    expect(
      lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
    ).to.be.equal(true);
    expect(
      lpInfoAfter.beginClaimIndex.gt(lpInfoBefore.beginClaimIndex)
    ).to.be.equal(true);
    expect(lpInfoAfter.beginClaimIndex).to.be.equal(1);
  });

  it("Should call takeInterest for LP1 after 2 day of his last redeem", async () => {
    const protocolContract = await ProtocolHelper.getProtocolPoolContract(
      liquidityProvider1,
      0
    );

    const lpInfoBefore = await protocolContract.LPsInfo(
      liquidityProvider1.getAddress()
    );

    const days = 1;

    await HardhatHelper.setNextBlockTimestamp(days * 24 * 60 * 60);

    const tx = await ProtocolHelper.getAthenaContract()
      .connect(liquidityProvider1)
      .takeInterest(0);

    const result = await tx.wait();

    const event = result.events[0];

    const decodedData = protocolContract.interface.decodeEventLog(
      event.topics[0],
      event.data
    );

    expect(decodedData.account).to.be.equal(
      await liquidityProvider1.getAddress()
    );
    expect(decodedData.userCapital).to.be.equal(182500);
    expect(decodedData.rewardsGross).to.be.equal(30);
    expect(decodedData.rewardsNet).to.be.equal(25);
    expect(decodedData.fee).to.be.equal(5);

    const lpInfoAfter = await protocolContract.LPsInfo(
      liquidityProvider1.getAddress()
    );

    expect(
      lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
    ).to.be.equal(true);
    expect(
      lpInfoAfter.beginClaimIndex.eq(lpInfoBefore.beginClaimIndex)
    ).to.be.equal(true);
    expect(lpInfoAfter.beginClaimIndex).to.be.equal(1);
  });

  it("Should call takeInterest for LP2 after 2 day of his last redeem", async () => {
    const protocolContract = await ProtocolHelper.getProtocolPoolContract(
      liquidityProvider2,
      0
    );

    const lpInfoBefore = await protocolContract.LPsInfo(
      liquidityProvider2.getAddress()
    );

    const days = 1;

    await HardhatHelper.setNextBlockTimestamp(days * 24 * 60 * 60);

    const tx = await ProtocolHelper.getAthenaContract()
      .connect(liquidityProvider2)
      .takeInterest(0);

    const result = await tx.wait();

    const event = result.events[0];

    const decodedData = protocolContract.interface.decodeEventLog(
      event.topics[0],
      event.data
    );

    expect(decodedData.account).to.be.equal(
      await liquidityProvider2.getAddress()
    );
    expect(decodedData.userCapital).to.be.equal(365000);
    expect(decodedData.rewardsGross).to.be.equal(60);
    expect(decodedData.rewardsNet).to.be.equal(57);
    expect(decodedData.fee).to.be.equal(3);

    const lpInfoAfter = await protocolContract.LPsInfo(
      liquidityProvider2.getAddress()
    );

    expect(
      lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
    ).to.be.equal(true);
    expect(
      lpInfoAfter.beginClaimIndex.eq(lpInfoBefore.beginClaimIndex)
    ).to.be.equal(true);
    expect(lpInfoAfter.beginClaimIndex).to.be.equal(1);
  });

  it("Should add a 2 claims into protocol1 and check claim info in protocol0", async () => {
    await ProtocolHelper.claim(owner, 1, "500", 1 * 24 * 60 * 60);
    await ProtocolHelper.claim(owner, 1, "1000", 1 * 24 * 60 * 60);

    let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(owner, 0);

    const claim1 = await protocolPool0.claims(1);

    expect(claim1.fromProtocolId).to.be.equal(1);
    expect(claim1.liquidityIndexBeforeClaim).to.not.be.equal(0);

    const claim2 = await protocolPool0.claims(2);

    expect(claim2.fromProtocolId).to.be.equal(1);
    expect(claim2.liquidityIndexBeforeClaim).to.not.be.equal(0);

    expect(
      claim2.liquidityIndexBeforeClaim.gt(claim1.liquidityIndexBeforeClaim)
    ).to.be.equal(true);
  });

  it("Should call takeInterest for LP1 in protocol0 after 1 day of adding 2 claims into protocol1 then check ClaimIndex and userCapital", async () => {
    const protocolContract = await ProtocolHelper.getProtocolPoolContract(
      liquidityProvider1,
      0
    );

    const lpInfoBefore = await protocolContract.LPsInfo(
      liquidityProvider1.getAddress()
    );

    const days = 1;

    await HardhatHelper.setNextBlockTimestamp(days * 24 * 60 * 60);

    const tx = await ProtocolHelper.getAthenaContract()
      .connect(liquidityProvider1)
      .takeInterest(0);

    const result = await tx.wait();

    const event = result.events[0];

    const decodedData = protocolContract.interface.decodeEventLog(
      event.topics[0],
      event.data
    );

    expect(decodedData.account).to.be.equal(
      await liquidityProvider1.getAddress()
    );
    expect(decodedData.userCapital).to.be.equal(182500);
    // expect(decodedData.rewardsGross).to.be.equal(63);
    // expect(decodedData.rewardsNet).to.be.equal(53);
    // expect(decodedData.fee).to.be.equal(10);

    const lpInfoAfter = await protocolContract.LPsInfo(
      liquidityProvider1.getAddress()
    );

    expect(
      lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
    ).to.be.equal(true);
    expect(
      lpInfoAfter.beginClaimIndex.gt(lpInfoBefore.beginClaimIndex)
    ).to.be.equal(true);
    expect(lpInfoAfter.beginClaimIndex).to.be.equal(3);
  });

  it("Should call takeInterest for LP2 in protocol0 after 2 day of adding 2 claims into protocol1 then check ClaimIndex and userCapital", async () => {
    const protocolContract = await ProtocolHelper.getProtocolPoolContract(
      liquidityProvider2,
      0
    );

    const lpInfoBefore = await protocolContract.LPsInfo(
      liquidityProvider2.getAddress()
    );

    const days = 1;

    await HardhatHelper.setNextBlockTimestamp(days * 24 * 60 * 60);

    const tx = await ProtocolHelper.getAthenaContract()
      .connect(liquidityProvider2)
      .takeInterest(0);

    const result = await tx.wait();

    const event = result.events[0];

    const decodedData = protocolContract.interface.decodeEventLog(
      event.topics[0],
      event.data
    );

    expect(decodedData.account).to.be.equal(
      await liquidityProvider2.getAddress()
    );
    expect(decodedData.userCapital.lt(365000)).to.be.equal(true);
    expect(decodedData.userCapital.eq(365000 - 500 - 1000)).to.be.equal(true);

    const lpInfoAfter = await protocolContract.LPsInfo(
      liquidityProvider2.getAddress()
    );

    expect(
      lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
    ).to.be.equal(true);
    expect(
      lpInfoAfter.beginClaimIndex.gt(lpInfoBefore.beginClaimIndex)
    ).to.be.equal(true);
    expect(lpInfoAfter.beginClaimIndex).to.be.equal(3);
  });
});
