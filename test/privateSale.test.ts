import chai, { expect } from "chai";
import { before } from "mocha";
import hre, { ethers } from "hardhat";
import { BigNumber, ethers as ethersOriginal } from "ethers";
import weth_abi from "../abis/weth.json";
import chaiAsPromised from "chai-as-promised";
import { distributeTokens } from "../scripts/distribute";
import path from "path";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(chaiAsPromised);

const DATE_NOW = Number.parseInt(((Date.now() + 1000) / 1000).toString());

const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const ATEN_OWNER_ADDRESS = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const ALLOWANCE = ethersOriginal.utils.parseEther("520000");
const wei = ethersOriginal.BigNumber.from(10).pow(18);

let expectedATEN: BigNumber;

// const WETH_TOKEN_CONTRACT = new ethers.Contract(WETH, weth_abi).connect(
//   ethers.provider.getSigner()
// );

const USDT_TOKEN_CONTRACT = new ethers.Contract(USDT, weth_abi);
const USDC_TOKEN_CONTRACT = new ethers.Contract(USDC, weth_abi);

let signer: SignerWithAddress; // = ethers.provider.getSigner();
let signerAddress: string;
let signerATEN: SignerWithAddress; // = ethers.provider.getSigner();
let signerATENAddress: string;
let PRIVATE_SALE_CONTRACT: ethersOriginal.Contract;
let balUSDTownerBefore: ethersOriginal.BigNumber;

describe("Smart Contract Private sale whitelist", function () {
  const ETH_VALUE = "1";
  before(async () => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ATEN_OWNER_ADDRESS],
    });
    signerATEN = await ethers.getSigner(ATEN_OWNER_ADDRESS);
    signerATENAddress = await signerATEN.getAddress();
    [signer] = await ethers.getSigners();
    signerAddress = await signer.getAddress();
  });

  /**
   *
   * CONTRACT DEPLOYMENT
   *
   */

  it("Should deploy contract", async function () {
    const factory = await ethers.getContractFactory("PrivateSale");
    PRIVATE_SALE_CONTRACT = await factory
      .connect(signer)
      .deploy(ATEN_TOKEN, signerATENAddress, ALLOWANCE, [USDT, USDC]);
    await PRIVATE_SALE_CONTRACT.deployed();

    // console.log("Deployed ICO Contract : ", PRIVATE_SALE_CONTRACT.address);

    expect(
      await ethers.provider.getCode(PRIVATE_SALE_CONTRACT.address)
    ).to.not.equal("0x");
    expect((await PRIVATE_SALE_CONTRACT.maxTokensSale()).toString()).to.equal(
      ALLOWANCE
    );
    expect((await PRIVATE_SALE_CONTRACT.tokenSold()).toString()).to.equal("0");
    // expect(await PRIVATE_SALE_CONTRACT.authTokens(1)).to.equal(WETH);
  });

  it("Should allow ATEN spent", async () => {
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(signerATEN);
    const allowContract = await ATEN_TOKEN_CONTRACT.transfer(
      PRIVATE_SALE_CONTRACT.address,
      ALLOWANCE
    );
    await allowContract.wait();
    // await hre.network.provider.request({
    //   method: "hardhat_stopImpersonatingAccount",
    //   params: [ATEN_OWNER_ADDRESS],
    // });
    const balance = await ATEN_TOKEN_CONTRACT.balanceOf(
      PRIVATE_SALE_CONTRACT.address
    );
    expect(balance.toString()).to.equal(ALLOWANCE);
  });

  /**
   *
   * Mint
   *
   */

  it("Should Fail to Mint some ICO cause paused", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.buy(
        ethers.utils.parseEther(ETH_VALUE),
        USDT,
        signerAddress
      )
    ).to.be.rejectedWith("Sale is not active");
  });

  it("Should activate preSale", async function () {
    const startSale = await PRIVATE_SALE_CONTRACT.startSale(true);
    expect(startSale).to.haveOwnProperty("hash");
  });

  it("Should fail to Mint some ICO with ETH", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.buy(
        ethers.utils.parseEther(ETH_VALUE),
        ETH,
        signerAddress
      )
    ).to.be.rejectedWith("Token not approved for this ICO");
  });

  it("Should Mint some ICO with USDT", async function () {
    const mint = await PRIVATE_SALE_CONTRACT.buy(
      ethers.utils.parseUnits("10000", 6),
      USDT,
      signerAddress
    );
    await mint.wait();

    expect(mint).to.have.property("hash");
    const balance = await USDT_TOKEN_CONTRACT.balanceOf(
      PRIVATE_SALE_CONTRACT.address
    );
    expect(balance.toString()).to.equal(ethers.utils.parseUnits("10000", 6));
    const mapping = await PRIVATE_SALE_CONTRACT.presales(signerAddress);
    expect(mapping.toString()).to.equal(
      (await PRIVATE_SALE_CONTRACT.tokenSold()).toString()
    );
  });

  it("Should activate preSale", async function () {
    const startSale = await PRIVATE_SALE_CONTRACT.startSale(false);
    expect(startSale).to.haveOwnProperty("hash");
  });

  it("Should fail to Mint some ICO cause not active", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.buy(
        ethers.utils.parseEther(ETH_VALUE),
        USDT,
        signerAddress
      )
    ).to.be.rejectedWith("Sale is not active");
  });

  it("Should activate preSale", async function () {
    const startSale = await PRIVATE_SALE_CONTRACT.startSale(true);
    expect(startSale).to.haveOwnProperty("hash");
  });

  it("Should Mint some more ICO with USDT", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.buy(
        ethers.utils.parseUnits("13000", 6),
        USDT,
        signerAddress
      )
    ).to.be.rejectedWith("SafeERC20: low-level call failed");
    await expect(
      PRIVATE_SALE_CONTRACT.buy(
        ethers.utils.parseUnits("13000", 6),
        USDC,
        signerAddress
      )
    ).to.be.rejectedWith("ERC20: transfer amount exceeds allowance");
  });

  it("Should get ATEN amount from 1 WETH", async () => {
    // Fixed block for ETH @3011 USDT
    // ATEN @0.035 = 86041 ATEN for 1 ETH
    // price from oracle = 332064878882758
    const ethPrice = await PRIVATE_SALE_CONTRACT.getLatestPrice();
    expectedATEN = ethers.BigNumber.from(parseInt((1 * 100000).toString()))
      .mul(wei)
      .div(100000)
      .mul(wei)
      .div(ethPrice)
      .mul(1000)
      .div(35)
      .div(4)
      .mul(4);

    const mapping = await PRIVATE_SALE_CONTRACT.presales(signerAddress);
    expect(mapping.toString()).to.equal(expectedATEN);
  });

  it("Should transfer USDT from Binance to Signers", async () => {
    //BINANCE WALLET 1Md2 USDT 0xF977814e90dA44bFA03b6295A0616a897441aceC
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xf977814e90da44bfa03b6295a0616a897441acec"],
    });
    const binanceSigner = await ethers.getSigner(
      "0xF977814e90dA44bFA03b6295A0616a897441aceC"
    );
    const balbefore = await USDT_TOKEN_CONTRACT.connect(
      binanceSigner
    ).balanceOf(signerAddress);

    const transfer = await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
      signerAddress,
      ethers.utils.parseUnits("220000", 6)
    );
    await transfer.wait();
    const transferUSDC = await USDC_TOKEN_CONTRACT.connect(
      binanceSigner
    ).transfer(signerAddress, ethers.utils.parseUnits("220000", 6));
    await transferUSDC.wait();

    const accounts = await ethers.getSigners();
    const newSigner = accounts[1];
    const transfer2 = await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
      newSigner.address,
      ethers.utils.parseUnits("201", 6)
    );
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: ["0xf977814e90da44bfa03b6295a0616a897441acec"],
    });
    balUSDTownerBefore = await USDT_TOKEN_CONTRACT.connect(signer).balanceOf(
      signerAddress
    );

    expect(balUSDTownerBefore.sub(balbefore).toString()).to.equal(
      ethers.utils.parseUnits("220000", 6).toString()
    );
  });

  it("Should Mint some more ICO with USDT", async function () {
    const approve = await USDT_TOKEN_CONTRACT.connect(signer).approve(
      PRIVATE_SALE_CONTRACT.address,
      ethersOriginal.utils.parseUnits("213000", 6)
    );
    await approve.wait();
    const mint = await PRIVATE_SALE_CONTRACT.buy(
      ethers.utils.parseUnits("13000", 6),
      USDT,
      signerAddress
    );
    await mint.wait();

    expect(mint).to.have.property("hash");
    const balance = await USDT_TOKEN_CONTRACT.connect(signer).balanceOf(
      PRIVATE_SALE_CONTRACT.address
    );
    expect(balance.toString()).to.equal(ethers.utils.parseUnits("13000", 6));
  });
  it("Should Mint some more ICO with USDC", async function () {
    const approve = await USDC_TOKEN_CONTRACT.connect(signer).approve(
      PRIVATE_SALE_CONTRACT.address,
      ethersOriginal.utils.parseUnits("214000", 6)
    );
    await approve.wait();
    const mint = await PRIVATE_SALE_CONTRACT.buy(
      ethers.utils.parseUnits("1111", 6),
      USDC,
      signerAddress
    );
    await mint.wait();

    expect(mint).to.have.property("hash");
    const balance = await USDC_TOKEN_CONTRACT.connect(signer).balanceOf(
      PRIVATE_SALE_CONTRACT.address
    );
    expect(balance.toString()).to.equal(ethers.utils.parseUnits("1111", 6));
  });

  it("Should Mint some New ICO with USDT", async function () {
    const accounts = await ethers.getSigners();
    const newSigner = accounts[1];
    const approve = await USDT_TOKEN_CONTRACT.connect(newSigner).approve(
      PRIVATE_SALE_CONTRACT.address,
      ethersOriginal.utils.parseUnits("201", 6)
    );
    await approve.wait();
    const mint = await PRIVATE_SALE_CONTRACT.connect(newSigner).buy(
      ethers.utils.parseUnits("201", 6),
      USDT,
      newSigner.address
    );
    await mint.wait();

    expect(mint).to.have.property("hash");
    const balance = await USDT_TOKEN_CONTRACT.connect(newSigner).balanceOf(
      PRIVATE_SALE_CONTRACT.address
    );
    expect(balance.toString()).to.equal(ethers.utils.parseUnits("13201", 6));
    const presaleUnits = await PRIVATE_SALE_CONTRACT.connect(
      newSigner
    ).presales(newSigner.address);
    expect(presaleUnits.toString()).to.not.equal("0");
  });

  it("Should fail to Mint some ICO with USDT cause max Sold", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.buy(
        ethers.utils.parseUnits("14000", 6),
        USDT,
        signerAddress
      )
    ).to.be.rejectedWith("Too many tokens sold");
  });

  it("Should fail to Mint some ICO with USDT cause max Amount & min Amount", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.buy(
        ethers.utils.parseUnits("20000", 6),
        USDT,
        signerAddress
      )
    ).to.be.rejectedWith("Amount requirements not met");
    await expect(
      PRIVATE_SALE_CONTRACT.buy(
        ethers.utils.parseUnits("190", 6),
        USDT,
        signerAddress
      )
    ).to.be.rejectedWith("Amount requirements not met");
  });

  /**
   * WE WITHDRAW ALL BALANCES TO CLEAN CONTRACT
   */

  it("Should withdraw ETH and USDT from Contract", async () => {
    const balETHBefore = await ethers.provider.getBalance(ATEN_OWNER_ADDRESS);
    const balUSDTBefore = await USDT_TOKEN_CONTRACT.connect(signer).balanceOf(
      ATEN_OWNER_ADDRESS
    );
    const balUSDTContractBefore = await USDT_TOKEN_CONTRACT.connect(
      signer
    ).balanceOf(PRIVATE_SALE_CONTRACT.address);
    const withdraw = await PRIVATE_SALE_CONTRACT.withdraw(
      [ETH, USDT, ATEN_TOKEN],
      ATEN_OWNER_ADDRESS
    );
    const newBalUSDTowner = await USDT_TOKEN_CONTRACT.connect(signer).balanceOf(
      ATEN_OWNER_ADDRESS
    );
    const isGreater = (
      await ethers.provider.getBalance(ATEN_OWNER_ADDRESS)
    ).gte(balETHBefore.add(ethers.utils.parseEther(ETH_VALUE)).mul(9).div(10));
    expect(isGreater).to.be.true;
    expect(balUSDTContractBefore).to.equal(newBalUSDTowner.sub(balUSDTBefore));
  });
});
