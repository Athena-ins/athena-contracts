import chai, { expect } from "chai";
import hre, { ethers } from "hardhat";
import { BigNumber, ethers as originalEthers } from "ethers";
import { ethers as ethersOriginal, utils } from "ethers";
import weth_abi from "../abis/weth.json";
import chaiAsPromised from "chai-as-promised";
import { getATokenBalance, increaseTimeAndMine } from "./helpers";
import protocolPoolAbi from "../artifacts/contracts/ProtocolPool.sol/ProtocolPool.json";

chai.use(chaiAsPromised);

const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const ATEN_OWNER_ADDRESS = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
const USDT_Wrong = "0xdac17f958d2ee523a2206206994597c13d831ec8"; //USDT
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const AAVE_LENDING_POOL = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
const AAVE_REGISTRY = "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5";
const NULL_ADDRESS = "0x" + "0".repeat(40);
const STAKING_TOKEN = USDT;

const USDT_TOKEN_CONTRACT = new ethers.Contract(USDT, weth_abi);

const STAKING_TOKEN_CONTRACT = new ethers.Contract(
  ATEN_TOKEN,
  weth_abi
).connect(ethers.provider.getSigner());

let owner: originalEthers.Signer,
  user: originalEthers.Signer,
  user2: originalEthers.Signer,
  ownerAddress: string,
  userAddress: string,
  POLICY_COVER_CONTRACT: ethersOriginal.Contract,
  INS_TX_CONTRACT: ethersOriginal.Contract,
  POS_CONTRACT: ethersOriginal.Contract,
  STAKED_ATENS_CONTRACT: ethersOriginal.Contract,
  ATEN_TOKEN_CONTRACT: ethersOriginal.Contract,
  POLICY_CONTRACT: ethersOriginal.Contract,
  allSigners: originalEthers.Signer[];

const BN = (num: string | number) => ethers.BigNumber.from(num);

describe("Premium Rewards Generic Contract", function () {
  const ETH_VALUE = "5000";
  let DATE_NOW: number;

  before(async () => {
    allSigners = await ethers.getSigners();
    owner = allSigners[0];
    user = allSigners[1];
    user2 = allSigners[2];
    userAddress = await user.getAddress();
    ownerAddress = await owner.getAddress();
    ATEN_TOKEN_CONTRACT = new ethers.Contract(ATEN_TOKEN, weth_abi);
  });

  /**
   *
   * CONTRACT DEPLOYMENT
   *
   */

  it("Should deploy contract", async function () {
    const factory = await ethers.getContractFactory("PolicyCover");
    POLICY_COVER_CONTRACT = await factory.connect(owner).deploy(USDT);
    //await factory.deploy(STAKING_TOKEN, ATEN_TOKEN);
    await POLICY_COVER_CONTRACT.deployed();

    expect(await ethers.provider.getCode("0x" + "0".repeat(40))).to.equal("0x");

    expect(
      await ethers.provider.getCode(POLICY_COVER_CONTRACT.address)
    ).to.not.equal("0x");
  });

  it("Should prepare balances ", async () => {
    //BINANCE WALLET 1Md2 USDT 0xF977814e90dA44bFA03b6295A0616a897441aceC
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xf977814e90da44bfa03b6295a0616a897441acec"],
    });
    const binanceSigner = await ethers.getSigner(
      "0xF977814e90dA44bFA03b6295A0616a897441aceC"
    );

    const transfer = await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
      userAddress,
      ethers.utils.parseUnits("100000", 6)
    );
    expect(
      await USDT_TOKEN_CONTRACT.connect(user).balanceOf(userAddress)
    ).to.be.not.equal(BigNumber.from("0"));

    const transfer2 = await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
      await user2.getAddress(),
      ethers.utils.parseUnits("100000", 6)
    );
    expect(
      await USDT_TOKEN_CONTRACT.connect(user2).balanceOf(
        await user2.getAddress()
      )
    ).to.equal(ethers.utils.parseUnits("100000", 6));
  });

  it("Should have round down", async () => {
    await expect(POLICY_COVER_CONTRACT.roundDown(4, 3)).to.eventually.equal(1);
  });

  it("Should have ray Mul", async () => {
    await expect(
      POLICY_COVER_CONTRACT.rayMul(
        BN("4").mul(BN(10).pow(BN(27))),
        BN("3").mul(BN(10).pow(BN(27)))
      )
    ).to.eventually.equal(BN("12").mul(BN(10).pow(BN(27))));
  });

  it("Should have rate calculations", async () => {
    await expect(POLICY_COVER_CONTRACT.getRate(0)).to.eventually.equal(
      BN("1").mul(BN(10000))
    ); // 10% = 0.1 => 10 / 100 / 10000
    // 1000$ on 100000$ Pool => 1% utilisation rate = 10.33%
    await expect(POLICY_COVER_CONTRACT.getRate(1000)).to.eventually.equal(
      BN("116").mul(BN(10000)).div(100)
    );
    // 90000$ on 100000$ Pool => 90% utilisation rate = 40%
    await expect(POLICY_COVER_CONTRACT.getRate(90000)).to.eventually.equal(
      BN("40").mul(BN(10000))
    );
  });

  it("Should have Duration for premium and capital", async () => {
    await expect(
      POLICY_COVER_CONTRACT.duration(365, 36500, 10000) // 1% (1/100 * 10.000)
    ).to.eventually.equal(365);
    await expect(
      POLICY_COVER_CONTRACT.duration(1, 36500, 10000) // 1%
    ).to.eventually.equal(1);
    await expect(
      POLICY_COVER_CONTRACT.duration(1, 36501, 10000) // 1%
    ).to.eventually.equal(0);
    await expect(
      POLICY_COVER_CONTRACT.duration(2, 36501, 10000) // 1%
    ).to.eventually.equal(1);
  });
  it("Should buy premium and check values", async () => {
    await USDT_TOKEN_CONTRACT.connect(user).approve(
      POLICY_COVER_CONTRACT.address,
      ethers.utils.parseEther(ETH_VALUE)
    );
    await POLICY_COVER_CONTRACT.connect(user).buyPolicy(10, 10000);

    await expect(
      USDT_TOKEN_CONTRACT.connect(user).balanceOf(POLICY_COVER_CONTRACT.address)
    ).to.eventually.equal(BN(10));
    await expect(POLICY_COVER_CONTRACT.totalInsured()).to.eventually.equal(
      BN(10000)
    );
    await expect(POLICY_COVER_CONTRACT.premiumSupply()).to.eventually.equal(
      BN(10)
    );
    const timeTicker0 = await POLICY_COVER_CONTRACT.initializedTickers(0);
    console.log(
      "Ticker 0 ",
      await POLICY_COVER_CONTRACT.premiumEmissionTickers(timeTicker0)
    );
    console.log("Actual Ticker ", await POLICY_COVER_CONTRACT.actualTicker());
  });
});
