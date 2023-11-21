// import chai, { expect } from "chai";
// import hre, { ethers } from "hardhat";
// import { BigNumber, ethers as originalEthers } from "ethers";
// import { ethers as ethersOriginal, utils } from "ethers";
// import weth_abi from "../abis/weth.json";
// import chaiAsPromised from "chai-as-promised";
// import HardhatHelper from "./helpers/HardhatHelper";
// import protocolPoolAbi from "../artifacts/contracts/ProtocolPool.sol/ProtocolPool.json";

// chai.use(chaiAsPromised);

// const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
// const ATEN_OWNER_ADDRESS = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";
// const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
// const USDT_Wrong = "0xdac17f958d2ee523a2206206994597c13d831ec8"; //USDT
// const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
// const AAVE_LENDING_POOL = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
// const AAVE_REGISTRY = "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5";
// const NULL_ADDRESS = "0x" + "0".repeat(40);
// const STAKING_TOKEN = USDT;

// const USDT_TOKEN_CONTRACT = new ethers.Contract(USDT, weth_abi);

// const STAKING_TOKEN_CONTRACT = new ethers.Contract(
//   ATEN_TOKEN,
//   weth_abi
// ).connect(ethers.provider.getSigner());

// let owner: originalEthers.Signer,
//   user: originalEthers.Signer,
//   user2: originalEthers.Signer,
//   ownerAddress: string,
//   userAddress: string,
//   POLICY_COVER_CONTRACT: ethersOriginal.Contract,
//   INS_TX_CONTRACT: ethersOriginal.Contract,
//   POS_CONTRACT: ethersOriginal.Contract,
//   STAKED_ATENS_CONTRACT: ethersOriginal.Contract,
//   ATEN_TOKEN_CONTRACT: ethersOriginal.Contract,
//   POLICY_CONTRACT: ethersOriginal.Contract,
//   allSigners: originalEthers.Signer[];

// const BN = (num: string | number) => ethers.BigNumber.from(num);

export function testPremiumRewards() {
  // describe("Premium Rewards Generic Contract", function () {
  //   const ETH_VALUE = "5000";
  //   let DATE_NOW: number;
  //   before(async function () {
  //     allSigners = await ethers.getSigners();
  //     owner = allSigners[0];
  //     user = allSigners[1];
  //     user2 = allSigners[2];
  //     userAddress = await user.getAddress();
  //     ownerAddress = await owner.getAddress();
  //     ATEN_TOKEN_CONTRACT = new ethers.Contract(ATEN_TOKEN, weth_abi);
  //   });
  //   it("Should prepare balances ", async function () {
  //     //BINANCE WALLET 1Md2 USDT 0xF977814e90dA44bFA03b6295A0616a897441aceC
  //     await hre.network.provider.request({
  //       method: "hardhat_impersonateAccount",
  //       params: ["0xf977814e90da44bfa03b6295a0616a897441acec"],
  //     });
  //     const binanceSigner = await ethers.getSigner(
  //       "0xF977814e90dA44bFA03b6295A0616a897441aceC"
  //     );
  //     const transfer = await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
  //       userAddress,
  //       ethers.utils.parseUnits("100000", 6)
  //     );
  //     expect(
  //       await USDT_TOKEN_CONTRACT.connect(user).balanceOf(userAddress)
  //     ).to.be.not.equal(BigNumber.from("0"));
  //     const transfer2 = await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
  //       await user2.getAddress(),
  //       ethers.utils.parseUnits("100000", 6)
  //     );
  //     expect(
  //       await USDT_TOKEN_CONTRACT.connect(user2).balanceOf(
  //         await user2.getAddress()
  //       )
  //     ).to.be.equal(ethers.utils.parseUnits("100000", 6));
  //   });
  //   /**
  //    *
  //    * CONTRACT DEPLOYMENT
  //    *
  //    */
  //   it("Should deploy contract", async function () {
  //     const factory = await ethers.getContractFactory("PolicyCover");
  //     POLICY_COVER_CONTRACT = await factory.connect(owner).deploy(USDT);
  //     //await factory.deploy(STAKING_TOKEN, ATEN_TOKEN);
  //     await POLICY_COVER_CONTRACT.deployed();
  //     expect(await ethers.provider.getCode("0x" + "0".repeat(40))).to.equal("0x");
  //     expect(
  //       await ethers.provider.getCode(POLICY_COVER_CONTRACT.address)
  //     ).to.not.equal("0x");
  //   });
  //   it("Should initialize slot0 in constructor", async function () {
  //     const slot0 = await POLICY_COVER_CONTRACT.slot0();
  //     expect(slot0.tick).to.be.equal(BigNumber.from("0"));
  //     expect(slot0.useRate).to.be.equal(BN("1").mul(BN(10000)));
  //     expect(slot0.emissionRate).to.be.equal(BigNumber.from("0"));
  //     expect(slot0.hoursPerTick).to.be.equal(BigNumber.from("24"));
  //     expect(slot0.numerator).to.be.equal(BigNumber.from("1"));
  //     expect(slot0.denumerator).to.be.equal(BigNumber.from("1"));
  //     expect(slot0.lastUpdateTimestamp);
  //   });
  //   it("Should have rate ratio calculations", async function () {
  //     const precision = await POLICY_COVER_CONTRACT.precision();
  //     expect(
  //       await POLICY_COVER_CONTRACT.getUseRateRatio(20000, 30000)
  //     ).to.be.equal(
  //       BigNumber.from(30000).mul(precision).div(BigNumber.from(20000))
  //     );
  //     expect(
  //       await POLICY_COVER_CONTRACT.getUseRateRatio(30000, 10000)
  //     ).to.be.equal(
  //       BigNumber.from(10000).mul(precision).div(BigNumber.from(30000))
  //     );
  //     // console.log(
  //     //   BigNumber.from(30000).mul(precision).div(BigNumber.from(20000)).toString()
  //     // );
  //   });
  //   it("Should have rate calculations", async function () {
  //     await expect(
  //       POLICY_COVER_CONTRACT.getStakingRewardRate(0, true)
  //     ).to.eventually.equal(BN("1").mul(BN(10000))); // 10% = 0.1 => 10 / 100 / 10000
  //     // 1000$ on 100000$ Pool => 1% utilisation rate = 10.33%
  //     // await expect(POLICY_COVER_CONTRACT.getStakingRewardRate(1000, true)).to.eventually.equal(
  //     //   BN("116").mul(BN(10000)).div(100)
  //     // );
  //     // 90000$ on 100000$ Pool => 90% utilisation rate = 40%
  //     // await expect(
  //     //   POLICY_COVER_CONTRACT.getStakingRewardRate(90000, true)
  //     // ).to.eventually.equal(BN("40").mul(BN(10000)));
  //   });
  //   it("Should have Duration by day unit for premium and capital", async function () {
  //     const duration_01 = await POLICY_COVER_CONTRACT.duration(365, 36500, 10000); // 1% (1/100 * 10.000)
  //     expect(duration_01.div(BigNumber.from(24))).to.be.equal(
  //       BigNumber.from(365)
  //     );
  //     const duration_02 = await POLICY_COVER_CONTRACT.duration(1, 36500, 10000); // 1%
  //     expect(duration_02.div(BigNumber.from(24))).to.be.equal(BigNumber.from(1));
  //     const duration_03 = await POLICY_COVER_CONTRACT.duration(1, 36501, 10000); // 1%
  //     expect(duration_03.div(BigNumber.from(24))).to.be.equal(BigNumber.from(0));
  //     const duration_04 = await POLICY_COVER_CONTRACT.duration(2, 36501, 10000); // 1%
  //     expect(duration_04.div(BigNumber.from(24))).to.be.equal(BigNumber.from(1));
  //   });
  //   it("Should buy premium and check values", async function () {
  //     await HardhatHelper.setNextBlockTimestamp(3600 * 48);
  //     await USDT_TOKEN_CONTRACT.connect(user).approve(
  //       POLICY_COVER_CONTRACT.address,
  //       ethers.utils.parseEther(ETH_VALUE)
  //     );
  //     await POLICY_COVER_CONTRACT.connect(user).buyPolicy(10, 10000);
  //     await expect(
  //       USDT_TOKEN_CONTRACT.connect(user).balanceOf(POLICY_COVER_CONTRACT.address)
  //     ).to.eventually.equal(BN(10));
  //     await expect(POLICY_COVER_CONTRACT.totalInsured()).to.eventually.equal(
  //       BN(10000)
  //     );
  //     await expect(POLICY_COVER_CONTRACT.premiumSupply()).to.eventually.equal(
  //       BN(10)
  //     );
  //     const slot0 = await POLICY_COVER_CONTRACT.slot0();
  //     console.log("tick " + slot0.tick);
  //     console.log(slot0.useRate);
  //     console.log(slot0.emissionRate);
  //     console.log(slot0.hoursPerTick);
  //     console.log(slot0.numerator);
  //     console.log(slot0.denumerator);
  //     console.log(slot0.lastUpdateTimestamp);
  //   });
  // });
}
