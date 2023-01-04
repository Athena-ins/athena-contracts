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
let policyTaker4: ethers.Signer;
let provider1tokenId: ethers.BigNumberish;
let provider2tokenId: ethers.BigNumberish;
let protocolPool0: ethers.Contract;

describe("Liquidity provider takeInterest", () => {
  before(async () => {
    await HardhatHelper.reset();
    const allSigners = await HardhatHelper.allSigners();
    owner = allSigners[0];
    liquidityProvider1 = allSigners[1];
    liquidityProvider2 = allSigners[2];
    policyTaker1 = allSigners[100];
    policyTaker2 = allSigners[101];
    policyTaker3 = allSigners[102];
    policyTaker4 = allSigners[103];

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
      1 * 24 * 60 * 60
    );

    const provider1tokenIds = await ProtocolHelper.getPositionManagerContract()
      .connect(liquidityProvider1)
      .allPositionTokensOfOwner(liquidityProvider1.getAddress());
    provider1tokenId = provider1tokenIds[0];

    const USDT_amount2 = "365000";
    const ATEN_amount2 = "9000000";
    await ProtocolHelper.deposit(
      liquidityProvider2,
      USDT_amount2,
      ATEN_amount2,
      [0, 1],
      1 * 24 * 60 * 60
    );

    const provider2tokenIds = await ProtocolHelper.getPositionManagerContract()
      .connect(liquidityProvider2)
      .allPositionTokensOfOwner(liquidityProvider2.getAddress());
    provider2tokenId = provider2tokenIds[0];

    // ================= Policy Buyers ================= //

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

    await HardhatHelper.USDT_maxApprove(
      policyTaker3,
      ProtocolHelper.getAthenaContract().address
    );

    const capital3 = "219000";
    const premium3 = "8760";
    const atensLocked3 = "0";
    await ProtocolHelper.buyPolicy(
      policyTaker3,
      capital3,
      premium3,
      atensLocked3,
      2,
      10 * 24 * 60 * 60
    );

    await HardhatHelper.USDT_maxApprove(
      policyTaker4,
      ProtocolHelper.getAthenaContract().address
    );

    await ProtocolHelper.buyPolicy(
      policyTaker4,
      capital3,
      premium3,
      atensLocked3,
      1,
      10 * 24 * 60 * 60
    );
  });

  it("Should add a claim in protocol2 and check claim info in protocol0", async () => {
    await ProtocolHelper.createClaim(policyTaker3, 2, "182500");

    await ProtocolHelper.resolveClaimWithoutDispute(
      policyTaker3,
      2,
      14 * 24 * 60 * 60 + 10 // 14 days + 10 seconds
    );

    const claim = await protocolPool0.processedClaims(0);

    expect(claim.fromPoolId).to.be.equal(2);
    expect(claim.ratio).to.be.equal("500000000000000000000000000");
    expect(claim.liquidityIndexBeforeClaim).to.not.be.equal(0);
    expect(claim.liquidityIndexBeforeClaim).to.be.equal(
      "1758909817351598173515981"
    );
  });

  it("Should call takeInterest for LP1 after 1 day of added claim", async () => {
    const protocolContract = await ProtocolHelper.getProtocolPoolContract(
      liquidityProvider1,
      0
    );

    const lpInfoBefore = await protocolContract.LPsInfo(provider1tokenId);

    const decodedData = await ProtocolHelper.takeInterest(
      liquidityProvider1,
      provider1tokenId,
      0,
      1 * 24 * 60 * 60,
      2
    );

    const lpInfoAfter = await protocolContract.LPsInfo(provider1tokenId);

    expect(decodedData.tokenId).to.be.equal(provider1tokenId);
    expect(decodedData.userCapital).to.be.equal(182500);
    expect(decodedData.rewardsGross).to.be.equal(657);
    expect(decodedData.rewardsNet).to.be.equal(558);
    expect(decodedData.fee).to.be.equal(99);

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

    const lpInfoBefore = await protocolContract.LPsInfo(provider2tokenId);

    const decodedData = await ProtocolHelper.takeInterest(
      liquidityProvider2,
      provider2tokenId,
      0,
      1 * 24 * 60 * 60,
      2
    );

    const lpInfoAfter = await protocolContract.LPsInfo(provider2tokenId);

    expect(decodedData.tokenId).to.be.equal(provider2tokenId);
    expect(decodedData.userCapital).to.be.equal(365000);
    expect(decodedData.rewardsGross).to.be.equal(702);
    expect(decodedData.rewardsNet).to.be.equal(666);
    expect(decodedData.fee).to.be.equal(36);

    expect(
      lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
    ).to.be.equal(true);
    expect(
      lpInfoAfter.beginClaimIndex.gt(lpInfoBefore.beginClaimIndex)
    ).to.be.equal(true);
    expect(lpInfoAfter.beginClaimIndex).to.be.equal(1);
  });

  it("Should call takeInterest for LP1 after 2 day of his last takeInterest", async () => {
    const protocolContract = await ProtocolHelper.getProtocolPoolContract(
      liquidityProvider1,
      0
    );

    const lpInfoBefore = await protocolContract.LPsInfo(provider1tokenId);

    const decodedData = await ProtocolHelper.takeInterest(
      liquidityProvider1,
      provider1tokenId,
      0,
      1 * 24 * 60 * 60,
      2
    );

    const lpInfoAfter = await protocolContract.LPsInfo(provider1tokenId);

    expect(decodedData.tokenId).to.be.equal(provider1tokenId);
    expect(decodedData.userCapital).to.be.equal(182500);
    expect(decodedData.rewardsGross).to.be.equal(30);
    expect(decodedData.rewardsNet).to.be.equal(25);
    expect(decodedData.fee).to.be.equal(5);

    expect(
      lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
    ).to.be.equal(true);
    expect(
      lpInfoAfter.beginClaimIndex.eq(lpInfoBefore.beginClaimIndex)
    ).to.be.equal(true);
    expect(lpInfoAfter.beginClaimIndex).to.be.equal(1);
  });

  it("Should call takeInterest for LP2 after 2 day of his last takeInterest", async () => {
    const protocolContract = await ProtocolHelper.getProtocolPoolContract(
      liquidityProvider2,
      0
    );

    const lpInfoBefore = await protocolContract.LPsInfo(provider2tokenId);

    const decodedData = await ProtocolHelper.takeInterest(
      liquidityProvider2,
      provider2tokenId,
      0,
      1 * 24 * 60 * 60,
      2
    );

    const lpInfoAfter = await protocolContract.LPsInfo(provider2tokenId);

    expect(decodedData.tokenId).to.be.equal(provider2tokenId);
    expect(decodedData.userCapital).to.be.equal(365000);
    expect(decodedData.rewardsGross).to.be.equal(60);
    expect(decodedData.rewardsNet).to.be.equal(57);
    expect(decodedData.fee).to.be.equal(3);

    expect(
      lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
    ).to.be.equal(true);
    expect(
      lpInfoAfter.beginClaimIndex.eq(lpInfoBefore.beginClaimIndex)
    ).to.be.equal(true);
    expect(lpInfoAfter.beginClaimIndex).to.be.equal(1);
  });

  it("Should add a 3 claims into protocol1 and check claim info in protocol0", async () => {
    await ProtocolHelper.createClaim(policyTaker4, 3, "500");
    await ProtocolHelper.resolveClaimWithoutDispute(
      policyTaker4,
      3,
      14 * 24 * 60 * 60 + 10 // 14 days + 10 seconds
    );

    await ProtocolHelper.createClaim(policyTaker4, 3, "1000");
    await ProtocolHelper.resolveClaimWithoutDispute(
      policyTaker4,
      3,
      14 * 24 * 60 * 60 + 10 // 14 days + 10 seconds
    );

    await ProtocolHelper.createClaim(policyTaker4, 3, "1000");
    await ProtocolHelper.resolveClaimWithoutDispute(
      policyTaker4,
      3,
      14 * 24 * 60 * 60 + 10 // 14 days + 10 seconds
    );

    const claim1 = await protocolPool0.processedClaims(1);

    expect(claim1.fromPoolId).to.be.equal(1);
    expect(claim1.liquidityIndexBeforeClaim).to.not.be.equal(0);

    const claim2 = await protocolPool0.processedClaims(2);

    expect(claim2.fromPoolId).to.be.equal(1);
    expect(claim2.liquidityIndexBeforeClaim).to.not.be.equal(0);

    const claim3 = await protocolPool0.processedClaims(3);

    expect(claim3.fromPoolId).to.be.equal(1);
    expect(claim3.liquidityIndexBeforeClaim).to.not.be.equal(0);

    expect(
      claim2.liquidityIndexBeforeClaim.gt(claim1.liquidityIndexBeforeClaim)
    ).to.be.equal(true);
    expect(
      claim3.liquidityIndexBeforeClaim.gt(claim2.liquidityIndexBeforeClaim)
    ).to.be.equal(true);
  });

  it("Should call takeInterest for LP1 in protocol0 after 1 day of adding 3 claims into protocol1 then check ClaimIndex and userCapital", async () => {
    const protocolContract = await ProtocolHelper.getProtocolPoolContract(
      liquidityProvider1,
      0
    );

    const lpInfoBefore = await protocolContract.LPsInfo(provider1tokenId);

    expect(lpInfoBefore.beginClaimIndex).to.be.equal(1);

    const decodedData = await ProtocolHelper.takeInterest(
      liquidityProvider1,
      provider1tokenId,
      0,
      1 * 24 * 60 * 60,
      2
    );

    const lpInfoAfter = await protocolContract.LPsInfo(provider1tokenId);

    expect(decodedData.tokenId).to.be.equal(provider1tokenId);
    expect(decodedData.userCapital).to.be.equal(182500);
    // expect(decodedData.rewardsGross).to.be.equal(63);
    // expect(decodedData.rewardsNet).to.be.equal(53);
    // expect(decodedData.fee).to.be.equal(10);

    expect(
      lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
    ).to.be.equal(true);
    expect(
      lpInfoAfter.beginClaimIndex.gt(lpInfoBefore.beginClaimIndex)
    ).to.be.equal(true);
    expect(lpInfoAfter.beginClaimIndex).to.be.equal(4);
  });

  it("Should call takeInterest for LP2 in protocol0 after 2 day of adding 3 claims into protocol1 then check ClaimIndex and userCapital", async () => {
    const protocolContract = await ProtocolHelper.getProtocolPoolContract(
      liquidityProvider2,
      0
    );

    const lpInfoBefore = await protocolContract.LPsInfo(provider2tokenId);

    expect(lpInfoBefore.beginClaimIndex).to.be.equal(1);

    const decodedData = await ProtocolHelper.takeInterest(
      liquidityProvider2,
      provider2tokenId,
      0,
      1 * 24 * 60 * 60,
      2
    );

    const lpInfoAfter = await protocolContract.LPsInfo(provider2tokenId);

    expect(decodedData.tokenId).to.be.equal(provider2tokenId);
    expect(decodedData.userCapital.lt(365000)).to.be.equal(true);
    expect(decodedData.userCapital.eq(365000 - 500 - 1000 - 1000)).to.be.equal(
      true
    );

    expect(
      lpInfoAfter.beginLiquidityIndex.gt(lpInfoBefore.beginLiquidityIndex)
    ).to.be.equal(true);
    expect(
      lpInfoAfter.beginClaimIndex.gt(lpInfoBefore.beginClaimIndex)
    ).to.be.equal(true);
    expect(lpInfoAfter.beginClaimIndex).to.be.equal(4);
  });
});
