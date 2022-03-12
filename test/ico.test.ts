import chai, { expect } from "chai";
import { before } from "mocha";
import hre, { ethers } from "hardhat";
import { ethers as ethersOriginal } from "ethers";
import weth_abi from "../abis/weth.json";
import chaiAsPromised from "chai-as-promised";
import { distributeTokens } from "../scripts/distribute";
import path from "path";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { formatUnits } from "ethers/lib/utils";

chai.use(chaiAsPromised);

const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const ATEN_OWNER_ADDRESS = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const ALLOWANCE = ethersOriginal.utils.parseEther("3000000000");
const wei = ethersOriginal.BigNumber.from(10).pow(18);

// const WETH_TOKEN_CONTRACT = new ethers.Contract(WETH, weth_abi).connect(
//   ethers.provider.getSigner()
// );

const USDT_TOKEN_CONTRACT = new ethers.Contract(USDT, weth_abi);
const USDC_TOKEN_CONTRACT = new ethers.Contract(USDC, weth_abi);

let signer: SignerWithAddress; // = ethers.provider.getSigner();
let signerAddress: string;
let ATHENA_CONTRACT: ethersOriginal.Contract;
let balUSDTownerBefore: ethersOriginal.BigNumber;

describe("ICO Pre sale", function () {
  const ETH_VALUE = "1";
  before(async () => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ATEN_OWNER_ADDRESS],
    });
    signer = await ethers.getSigner(ATEN_OWNER_ADDRESS);
    signerAddress = await signer.getAddress();
  });

  /**
   *
   * CONTRACT DEPLOYMENT
   *
   */

  it("Should deploy contract", async function () {
    const factory = await ethers.getContractFactory("AthenaICO");
    ATHENA_CONTRACT = await factory.connect(signer).deploy(
      ATEN_TOKEN,
      ethers.utils.parseEther("520000"),
      [ETH, USDT, USDC],
      "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46" // Chainlink MAINNET USDT/ETH
    );
    await ATHENA_CONTRACT.deployed();

    // console.log("Deployed ICO Contract : ", ATHENA_CONTRACT.address);

    expect(await ethers.provider.getCode(ATHENA_CONTRACT.address)).to.not.equal(
      "0x00"
    );
    expect((await ATHENA_CONTRACT.maxTokensSale()).toString()).to.equal(
      ethers.utils.parseEther("520000")
    );
    expect((await ATHENA_CONTRACT.tokenSold()).toString()).to.equal("0");
    // expect(await ATHENA_CONTRACT.authTokens(1)).to.equal(WETH);
  });

  it("Should allow ATEN spent", async () => {
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(signer);
    const allowContract = await ATEN_TOKEN_CONTRACT.approve(
      ATHENA_CONTRACT.address,
      ALLOWANCE
    );
    await allowContract.wait();
    // await hre.network.provider.request({
    //   method: "hardhat_stopImpersonatingAccount",
    //   params: [ATEN_OWNER_ADDRESS],
    // });
    const allowed = await ATEN_TOKEN_CONTRACT.allowance(
      ATEN_OWNER_ADDRESS,
      ATHENA_CONTRACT.address
    );
    expect(allowed.toString()).to.equal(ALLOWANCE);
  });

  /**
   *
   * Mint
   *
   */

  it("Should get ETH price", async function () {
    const price = await ATHENA_CONTRACT.getLatestPrice();
    expect(price.toString()).to.equal("332064878882758");
    expect(price.toNumber()).to.be.greaterThan(wei.div(4900).toNumber());
  });

  it("Should Fail to Mint some ICO with ETH cause paused", async function () {
    await expect(
      ATHENA_CONTRACT.prebuy(
        ethers.utils.parseEther(ETH_VALUE),
        ETH,
        signerAddress,
        {
          value: ethers.utils.parseEther(ETH_VALUE),
        }
      )
    ).to.be.rejectedWith("Sale is not yet active");
  });

  it("Should activate preSale", async function () {
    const startSale = await ATHENA_CONTRACT.startSale(true);
    expect(startSale).to.haveOwnProperty("hash");
  });

  it("Should Mint some ICO with ETH", async function () {
    const mint = await ATHENA_CONTRACT.prebuy(
      ethers.utils.parseEther(ETH_VALUE),
      ETH,
      signerAddress,
      {
        value: ethers.utils.parseEther(ETH_VALUE),
      }
    );
    await mint.wait();

    expect(mint).to.have.property("hash");
    const balance = await ethers.provider.getBalance(ATHENA_CONTRACT.address);
    expect(balance.toString()).to.equal(ethers.utils.parseEther("1"));
    const mapping = await ATHENA_CONTRACT.presales(signerAddress);
    expect(mapping.toString()).to.equal(
      (await ATHENA_CONTRACT.tokenSold()).toString()
    );
  });

  it("Should get ATEN amount from 1 WETH", async () => {
    // Fixed block for ETH @3011 USDT
    // ATEN @0.035 = 86041 ATEN for 1 ETH
    // price from oracle = 332064878882758
    const ethPrice = await ATHENA_CONTRACT.getLatestPrice();
    const expectedAten = ethers.BigNumber.from(
      parseInt((1 * 100000).toString())
    )
      .mul(wei)
      .div(100000)
      .mul(wei)
      .div(ethPrice)
      .mul(1000)
      .div(35);

    const mapping = await ATHENA_CONTRACT.presales(signerAddress);
    expect(mapping.toString()).to.equal(expectedAten);
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
      ATHENA_CONTRACT.address,
      ethersOriginal.utils.parseUnits("213000", 6)
    );
    await approve.wait();
    const mint = await ATHENA_CONTRACT.prebuy(
      ethers.utils.parseUnits("13000", 6),
      USDT,
      signerAddress
    );
    await mint.wait();

    expect(mint).to.have.property("hash");
    const balance = await USDT_TOKEN_CONTRACT.connect(signer).balanceOf(
      ATHENA_CONTRACT.address
    );
    expect(balance.toString()).to.equal(ethers.utils.parseUnits("13000", 6));
  });
  it("Should Mint some more ICO with USDC", async function () {
    const approve = await USDC_TOKEN_CONTRACT.connect(signer).approve(
      ATHENA_CONTRACT.address,
      ethersOriginal.utils.parseUnits("214000", 6)
    );
    await approve.wait();
    const mint = await ATHENA_CONTRACT.prebuy(
      ethers.utils.parseUnits("1111", 6),
      USDC,
      signerAddress
    );
    await mint.wait();

    expect(mint).to.have.property("hash");
    const balance = await USDC_TOKEN_CONTRACT.connect(signer).balanceOf(
      ATHENA_CONTRACT.address
    );
    expect(balance.toString()).to.equal(ethers.utils.parseUnits("1111", 6));
  });

  it("Should Mint some New ICO with USDT", async function () {
    const accounts = await ethers.getSigners();
    const newSigner = accounts[1];
    const approve = await USDT_TOKEN_CONTRACT.connect(newSigner).approve(
      ATHENA_CONTRACT.address,
      ethersOriginal.utils.parseUnits("201", 6)
    );
    await approve.wait();
    const mint = await ATHENA_CONTRACT.connect(newSigner).prebuy(
      ethers.utils.parseUnits("201", 6),
      USDT,
      newSigner.address
    );
    await mint.wait();

    expect(mint).to.have.property("hash");
    const balance = await USDT_TOKEN_CONTRACT.connect(newSigner).balanceOf(
      ATHENA_CONTRACT.address
    );
    expect(balance.toString()).to.equal(ethers.utils.parseUnits("13201", 6));
    const presaleUnits = await ATHENA_CONTRACT.connect(newSigner).presales(
      newSigner.address
    );
    expect(presaleUnits.toString()).to.not.equal("0");
  });

  it("Should fail to Mint some ICO with USDT cause max Sold", async function () {
    await expect(
      ATHENA_CONTRACT.prebuy(
        ethers.utils.parseUnits("14000", 6),
        USDT,
        signerAddress
      )
    ).to.be.rejectedWith("Too many tokens sold");
  });

  it("Should fail to Mint some ICO with USDT cause max Amount & min Amount", async function () {
    await expect(
      ATHENA_CONTRACT.prebuy(
        ethers.utils.parseUnits("20000", 6),
        USDT,
        signerAddress
      )
    ).to.be.rejectedWith("Amount requirements not met");
    await expect(
      ATHENA_CONTRACT.prebuy(
        ethers.utils.parseUnits("190", 6),
        USDT,
        signerAddress
      )
    ).to.be.rejectedWith("Amount requirements not met");
  });

  // it("Should user claim and get tokens", async function () {
  //    this.timeout(120000);
  //    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
  //      ATEN_TOKEN,
  //      weth_abi
  //    ).connect(signer);
  //    const accounts = await ethers.getSigners();
  //    for (let index = 0; index < accounts.length; index++) {
  //      const signerLocal = accounts[index];
  //      const claim = await ATHENA_CONTRACT.connect(signerLocal).claim();
  //      await claim.wait();
  //      expect(claim).to.have.property("hash");
  //      const balance = await ATEN_TOKEN_CONTRACT.balanceOf(signer.getAddress());
  //      expect(balance.toString()).to.equal("86041705667753779780085");
  //    }
  //  });

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
    ).balanceOf(ATHENA_CONTRACT.address);
    const withdraw = await ATHENA_CONTRACT.withdraw(
      [ETH, USDT],
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

  /**
   *
   * Deploy new contract for 300 addresses
   */

  it("Should deploy new contract for 300 addresses", async function () {
    const factory = await ethers.getContractFactory("AthenaICO");
    ATHENA_CONTRACT = await factory.connect(signer).deploy(
      ATEN_TOKEN,
      ethers.utils.parseEther("30000000"),
      [ETH, USDT],
      "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46" // Chainlink MAINNET USDT/ETH
    );
    await ATHENA_CONTRACT.deployed();

    // console.log("Deployed ICO Contract : ", ATHENA_CONTRACT.address);

    expect(await ethers.provider.getCode(ATHENA_CONTRACT.address)).to.not.equal(
      "0x00"
    );
    expect((await ATHENA_CONTRACT.maxTokensSale()).toString()).to.equal(
      ethers.utils.parseEther("30000000")
    );
    expect((await ATHENA_CONTRACT.tokenSold()).toString()).to.equal("0");
    // expect(await ATHENA_CONTRACT.authTokens(1)).to.equal(WETH);
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(signer);
    const allowContract = await ATEN_TOKEN_CONTRACT.approve(
      ATHENA_CONTRACT.address,
      ALLOWANCE
    );
    await allowContract.wait();
    // await hre.network.provider.request({
    //   method: "hardhat_stopImpersonatingAccount",
    //   params: [ATEN_OWNER_ADDRESS],
    // });
    const allowed = await ATEN_TOKEN_CONTRACT.allowance(
      ATEN_OWNER_ADDRESS,
      ATHENA_CONTRACT.address
    );
    expect(allowed.toString()).to.equal(ALLOWANCE);
    const startSale = await ATHENA_CONTRACT.startSale(true);
    expect(startSale).to.haveOwnProperty("hash");
  });
  /**
   * NOW WE MINT lot of ADDRESSES AND DISTRIBUTE
   */
  it("Should mint all Hardhat (300?) addresses", async function () {
    this.timeout(120000);
    const accounts = await ethers.getSigners();
    for (let index = 0; index < accounts.length; index++) {
      const mint = await ATHENA_CONTRACT.connect(accounts[index]).prebuy(
        ethers.utils.parseEther(ETH_VALUE),
        ETH,
        accounts[index].address,
        {
          value: ethers.utils.parseEther(ETH_VALUE),
        }
      );
      await mint.wait();
      expect(mint).to.have.property("hash");
    }
    const balance = await ethers.provider.getBalance(ATHENA_CONTRACT.address);
    expect(balance.toString()).to.equal(
      ethers.utils.parseEther(accounts.length.toString())
    );
  });

  it("Should fail to claim tokens cause not active", async function () {
    const accounts = await ethers.getSigners();
    const signerLocal = accounts[0];
    await expect(
      ATHENA_CONTRACT.connect(signerLocal).claim()
    ).to.be.rejectedWith("Claim not yet active");
  });

  it("Should active claim tokens ", async function () {
    const activeClaim = await ATHENA_CONTRACT.startClaim(true);
    expect(activeClaim).to.haveOwnProperty("hash");
  });

  it("Should change dest address for tokens", async () => {
    const accounts = await ethers.getSigners();
    const signerLocal = accounts[accounts.length - 1];
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(signerLocal);
    const changeAddress = await ATHENA_CONTRACT.connect(
      signerLocal
    ).changeAddress("0x" + "0".repeat(40));
    const receipt = await changeAddress.wait();
    expect(receipt).to.haveOwnProperty("transactionHash");
    const amount = await ATHENA_CONTRACT.presales(signerLocal.address);
    expect(amount.toString()).to.equal("0");
    await expect(
      ATHENA_CONTRACT.connect(signerLocal).claim()
    ).to.be.rejectedWith("Transfer amount must be greater than zero");
    const balShouldBeZero = await ATEN_TOKEN_CONTRACT.balanceOf(
      signerLocal.address
    );
    expect(balShouldBeZero.toString()).to.equal("0");
    const mappingZero = await ATHENA_CONTRACT.presales("0x" + "0".repeat(40));
    expect(mappingZero.toString()).to.not.equal("0");
  });

  it("Should user claim and get tokens", async function () {
    this.timeout(120000);
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(signer);
    const accounts = await ethers.getSigners();
    // Careful, -1 to avoid last user changed address test above
    for (let index = 0; index < accounts.length - 1; index++) {
      const signerLocal = accounts[index];
      const claim = await ATHENA_CONTRACT.connect(signerLocal).claim();
      await claim.wait();
      expect(claim).to.have.property("hash");
      const balance = await ATEN_TOKEN_CONTRACT.balanceOf(signerLocal.address);
      expect(balance.toString()).to.equal("86041705667753779780085");
    }
  });

  it("Should distribute CSV tokens to addresses", async function () {
    // const allowContract = await ATEN_TOKEN_CONTRACT.approve(
    //   ATHENA_CONTRACT.address,
    //   ALLOWANCE
    // );
    // await allowContract.wait();
    this.timeout(120000);
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(signer);
    const allowed = await ATEN_TOKEN_CONTRACT.allowance(
      ATEN_OWNER_ADDRESS,
      ATHENA_CONTRACT.address
    );
    const isAllowed = allowed.gte(ALLOWANCE.div(2));
    expect(isAllowed).to.be.true;

    const arrToSend = await distributeTokens(
      path.join(__dirname, "./test_distribute_tokens.csv")
    );
    expect(arrToSend[1][1]).to.equal(ethers.utils.parseUnits("13000.45", 18));
    const distribute = await ATHENA_CONTRACT.distribute(
      arrToSend[0],
      arrToSend[1]
    );
    const receipt = await distribute.wait();
    expect(receipt).to.have.property("transactionHash");
    // Check ATEN tokens on buyer
    for (let index = 0; index < arrToSend.length; index++) {
      const bal = await ATEN_TOKEN_CONTRACT.balanceOf(arrToSend[0][index]);
      expect(bal.toString()).to.equal(arrToSend[1][index]);
    }
  });
});
