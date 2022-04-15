import chai, { expect } from "chai";
import hre, { ethers } from "hardhat";
import { BigNumber, ethers as ethersOriginal } from "ethers";
import weth_abi from "../abis/weth.json";
import chaiAsPromised from "chai-as-promised";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(chaiAsPromised);

const DATE_NOW = Number.parseInt(((Date.now() + 1000) / 1000).toString());

const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const ATEN_OWNER_ADDRESS = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const ALLOWANCE = ethersOriginal.utils.parseEther("294000000");
const wei = ethersOriginal.BigNumber.from(10).pow(18);

let expectedATEN: BigNumber;

// const WETH_TOKEN_CONTRACT = new ethers.Contract(WETH, weth_abi).connect(
//   ethers.provider.getSigner()
// );

const USDT_TOKEN_CONTRACT = new ethers.Contract(USDT, weth_abi);
const USDC_TOKEN_CONTRACT = new ethers.Contract(USDC, weth_abi);
const ATEN_TOKEN_CONTRACT = new ethers.Contract(ATEN_TOKEN, weth_abi);

let owner: SignerWithAddress; // = ethers.provider.getSigner();
let ownerAddress: string;
let allSigners: SignerWithAddress[];
let signerATEN: SignerWithAddress; // = ethers.provider.getSigner();
let signerATENAddress: string;
let PRIVATE_SALE_CONTRACT: ethersOriginal.Contract;
let balUSDTownerBefore: ethersOriginal.BigNumber;

describe("Smart Contract Private sale whitelist", function () {
  const ETH_VALUE = "1";
  before(async () => {
    await hre.network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [DATE_NOW],
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ATEN_OWNER_ADDRESS],
    });
    signerATEN = await ethers.getSigner(ATEN_OWNER_ADDRESS);
    signerATENAddress = await signerATEN.getAddress();
    allSigners = await ethers.getSigners();
    owner = allSigners[0];

    ownerAddress = await owner.getAddress();
  });

  /**
   *
   * CONTRACT DEPLOYMENT
   *
   */

  it("Should deploy contract", async function () {
    const factory = await ethers.getContractFactory("PrivateSale");
    PRIVATE_SALE_CONTRACT = await factory
      .connect(owner)
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

  it("Should send ATEN to Contract", async () => {
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

  it("Should transfer USDT & USDC from Binance to Signers", async () => {
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
    ).balanceOf(ownerAddress);

    const transfer = await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
      ownerAddress,
      ethers.utils.parseUnits("220000", 6)
    );
    await transfer.wait();
    const transferUSDC = await USDC_TOKEN_CONTRACT.connect(
      binanceSigner
    ).transfer(allSigners[3].address, ethers.utils.parseUnits("220000", 6));
    await transferUSDC.wait();
    await USDC_TOKEN_CONTRACT.connect(allSigners[3]).approve(
      PRIVATE_SALE_CONTRACT.address,
      ethers.utils.parseUnits("220000", 6)
    );

    for (let index = 1; index < 15; index++) {
      const tx = await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
        allSigners[index].address,
        ethers.utils.parseUnits((20000 + index * 1000).toString(), 6)
      );
      await tx.wait();
      const approve = await USDT_TOKEN_CONTRACT.connect(
        allSigners[index]
      ).approve(
        PRIVATE_SALE_CONTRACT.address,
        ethersOriginal.utils.parseUnits("900000000", 6)
      );
      await approve.wait();
    }
    const tx = await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
      allSigners[5].address,
      ethers.utils.parseUnits((2000000).toString(), 6)
    );
    await tx.wait();

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: ["0xf977814e90da44bfa03b6295a0616a897441acec"],
    });
    balUSDTownerBefore = await USDT_TOKEN_CONTRACT.connect(owner).balanceOf(
      ownerAddress
    );

    expect(balUSDTownerBefore.sub(balbefore).toString()).to.equal(
      ethers.utils.parseUnits("220000", 6).toString()
    );
  });

  /**
   *
   * Mint
   *
   */

  it("Should Fail to Mint some ICO cause paused", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.connect(allSigners[1]).buy(
        ethers.utils.parseEther(ETH_VALUE),
        USDT
      )
    ).to.be.rejectedWith("Sale is not active");
  });

  it("Should activate preSale", async function () {
    const startSale = await PRIVATE_SALE_CONTRACT.startSale(true);
    expect(startSale).to.haveOwnProperty("hash");
  });

  it("Should fail to Mint some ICO with ETH", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.connect(allSigners[1]).buy(
        ethers.utils.parseEther(ETH_VALUE),
        ETH
      )
    ).to.be.rejectedWith("Token not approved for this ICO");
  });
  it("Should fail to Mint some ICO with USDT cause not whitelisted", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.connect(allSigners[1]).buy(
        ethers.utils.parseUnits("600", 6),
        USDT
      )
    ).to.be.rejectedWith("Not enough whitelisted tokens");
  });

  it("Should add whitelist", async function () {
    const startSale = await PRIVATE_SALE_CONTRACT.whitelistAddresses(
      allSigners.slice(1, 11).map((s) => s.address),
      [
        ethers.utils.parseUnits(
          BigNumber.from(10000).mul(10000).div(50).toString(),
          18
        ),
        ethers.utils.parseUnits(
          BigNumber.from(11000).mul(10000).div(50).toString(),
          18
        ),
        ethers.utils.parseUnits(
          BigNumber.from(12000).mul(10000).div(50).toString(),
          18
        ),
        ethers.utils.parseUnits(
          BigNumber.from(13000).mul(10000).div(50).toString(),
          18
        ),
        ethers.utils.parseUnits(
          BigNumber.from(200000000).mul(10000).div(50).toString(),
          18
        ),
        ethers.utils.parseUnits(
          BigNumber.from(15000).mul(10000).div(50).toString(),
          18
        ),
        ethers.utils.parseUnits(
          BigNumber.from(16000).mul(10000).div(50).toString(),
          18
        ),
        ethers.utils.parseUnits(
          BigNumber.from(17000).mul(10000).div(50).toString(),
          18
        ),
        ethers.utils.parseUnits(
          BigNumber.from(18000).mul(10000).div(50).toString(),
          18
        ),
        ethers.utils.parseUnits(
          BigNumber.from(19000).mul(10000).div(50).toString(),
          18
        ),
      ]
    );
    expect(startSale).to.haveOwnProperty("hash");
  });

  it("Should have enough allowance to buy ", async () => {
    const allowance = await USDT_TOKEN_CONTRACT.connect(
      allSigners[1]
    ).allowance(allSigners[1].address, PRIVATE_SALE_CONTRACT.address);
    expect(allowance.gte(ethers.utils.parseUnits("213000", 6))).to.be.true;
  });
  it("Should have enough balance to buy ", async () => {
    const allowance = await USDT_TOKEN_CONTRACT.connect(
      allSigners[1]
    ).balanceOf(allSigners[1].address);
    expect(allowance.toString()).to.equal(
      ethers.utils.parseUnits("21000", 6).toString()
    );
  });

  it("Should Mint some ICO with USDT", async function () {
    const mappingBefore = await PRIVATE_SALE_CONTRACT.presales(
      allSigners[1].address
    );
    const mint = await PRIVATE_SALE_CONTRACT.connect(allSigners[1]).buy(
      ethers.utils.parseUnits("10000", 6),
      USDT
    );
    await mint.wait();

    expect(mint).to.have.property("hash");
    const balance = await USDT_TOKEN_CONTRACT.connect(allSigners[1]).balanceOf(
      PRIVATE_SALE_CONTRACT.address
    );
    expect(balance.toString()).to.equal(ethers.utils.parseUnits("10000", 6));
    const mapping = await PRIVATE_SALE_CONTRACT.presales(allSigners[1].address);
    expect(mapping.toString()).to.equal(
      (await PRIVATE_SALE_CONTRACT.tokenSold()).toString()
    );
  });

  it("Should get ATEN amount from 1000 USDT", async () => {
    // Fixed block for ETH @3011 USDT
    // ATEN @0.035 = 86041 ATEN for 1 ETH
    // price from oracle = 332064878882758
    expectedATEN = ethers.BigNumber.from(
      ethers.utils.parseEther("10000").toString()
    )
      .mul(wei)
      .div(100000)
      .mul(wei)
      .mul(10000)
      .div(50)
      .div(12)
      .mul(12);

    const mapping = await PRIVATE_SALE_CONTRACT.presales(allSigners[1].address);
    expect(mapping.toString()).to.equal(expectedATEN);
  });

  it("Should activate preSale", async function () {
    const startSale = await PRIVATE_SALE_CONTRACT.startSale(false);
    expect(startSale).to.haveOwnProperty("hash");
  });

  it("Should fail to Mint some ICO cause not active", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.connect(allSigners[1]).buy(
        ethers.utils.parseEther(ETH_VALUE),
        USDT
      )
    ).to.be.rejectedWith("Sale is not active");
  });

  it("Should activate preSale", async function () {
    const startSale = await PRIVATE_SALE_CONTRACT.startSale(true);
    expect(startSale).to.haveOwnProperty("hash");
  });

  it("Should fail to Mint some more cause whitelisted max", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.connect(allSigners[1]).buy(
        ethers.utils.parseUnits("10000", 6),
        USDT
      )
    ).to.be.rejectedWith("Not enough whitelisted tokens");
  });

    it("Should Mint some more ICO with USDT", async function () {
      const mint = await PRIVATE_SALE_CONTRACT.connect(allSigners[2]).buy(
        ethers.utils.parseUnits("11000", 6),
        USDT
      );
      await mint.wait();

      expect(mint).to.have.property("hash");
      const balance = await USDT_TOKEN_CONTRACT.connect(
        allSigners[2]
      ).balanceOf(PRIVATE_SALE_CONTRACT.address);
      expect(balance.toString()).to.equal(ethers.utils.parseUnits("21000", 6));
    });
    it("Should Mint some more ICO with USDC", async function () {
      const mint = await PRIVATE_SALE_CONTRACT.connect(allSigners[3]).buy(
        ethers.utils.parseUnits("1111", 6),
        USDC
      );
      await mint.wait();

      expect(mint).to.have.property("hash");
      const balance = await USDC_TOKEN_CONTRACT.connect(
        allSigners[3]
      ).balanceOf(PRIVATE_SALE_CONTRACT.address);
      expect(balance.toString()).to.equal(ethers.utils.parseUnits("1111", 6));
    });

  it("Should Mint some New ICO with USDT", async function () {
    const newSigner = allSigners[4];
    const balanceBefore = await USDT_TOKEN_CONTRACT.connect(
      newSigner
    ).balanceOf(PRIVATE_SALE_CONTRACT.address);
    const mint = await PRIVATE_SALE_CONTRACT.connect(newSigner).buy(
      ethers.utils.parseUnits("501", 6),
      USDT
    );
    await mint.wait();
    expect(mint).to.have.property("hash");
    const mint2 = await PRIVATE_SALE_CONTRACT.connect(newSigner).buy(
      ethers.utils.parseUnits("505", 6),
      USDT
    );
    await mint2.wait();
    expect(mint2).to.have.property("hash");
    const balanceAfter = await USDT_TOKEN_CONTRACT.connect(newSigner).balanceOf(
      PRIVATE_SALE_CONTRACT.address
    );
    expect(balanceAfter.sub(balanceBefore)).to.equal(
      ethers.utils.parseUnits("1006", 6)
    );
    const presaleUnits = await PRIVATE_SALE_CONTRACT.connect(
      newSigner
    ).presales(newSigner.address);
    expect(presaleUnits.toString()).to.not.equal("0");
  });

  it("Should fail to Mint some ICO with USDT cause max Amount & min Amount", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.connect(allSigners[5]).buy(
        ethers.utils.parseUnits("499", 6),
        USDT
      )
    ).to.be.rejectedWith("Amount requirements not met");
    await expect(
      PRIVATE_SALE_CONTRACT.connect(allSigners[5]).buy(
        ethers.utils.parseUnits("1900000", 6),
        USDT
      )
    ).to.be.rejectedWith("Amount requirements not met");
  });

  it("Should fail to claim tokens cause not active", async function () {
    await expect(
      PRIVATE_SALE_CONTRACT.connect(owner).claim()
    ).to.be.rejectedWith("Claim not active");
  });

  it("Should active claim tokens ", async function () {
    const activeClaim = await PRIVATE_SALE_CONTRACT.startClaim(true, true);
    expect(activeClaim).to.haveOwnProperty("hash");
  });

  it("Should change dest address for tokens", async () => {
    const accounts = await ethers.getSigners();
    const signerLocal = accounts[1];
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(signerLocal);
    const changeAddress = await PRIVATE_SALE_CONTRACT.connect(
      signerLocal
    ).changeAddress("0x" + "0".repeat(40));
    const receipt = await changeAddress.wait();
    expect(receipt).to.haveOwnProperty("transactionHash");
    const amount = await PRIVATE_SALE_CONTRACT.presales(signerLocal.address);
    expect(amount.toString()).to.equal("0");
    await expect(
      PRIVATE_SALE_CONTRACT.connect(signerLocal).claim()
    ).to.be.rejectedWith("Transfer amount must be greater than zero");
    const balShouldBeZero = await ATEN_TOKEN_CONTRACT.balanceOf(
      signerLocal.address
    );
    expect(balShouldBeZero.toString()).to.equal("0");
    const mappingZero = await PRIVATE_SALE_CONTRACT.presales(
      "0x" + "0".repeat(40)
    );
    expect(mappingZero.toString()).to.not.equal("0");
  });

  /**
   * WE WITHDRAW ALL BALANCES TO CLEAN CONTRACT
   */

  it("Should withdraw ETH and USDT from Contract", async () => {
    const balUSDTBefore = await USDT_TOKEN_CONTRACT.connect(
      allSigners[1]
    ).balanceOf(ATEN_OWNER_ADDRESS);
    const balUSDTContractBefore = await USDT_TOKEN_CONTRACT.connect(
      allSigners[1]
    ).balanceOf(PRIVATE_SALE_CONTRACT.address);
    const withdraw = await PRIVATE_SALE_CONTRACT.withdraw(
      [USDC, USDT, ATEN_TOKEN],
      ATEN_OWNER_ADDRESS
    );
    const newBalUSDTowner = await USDT_TOKEN_CONTRACT.connect(
      allSigners[1]
    ).balanceOf(ATEN_OWNER_ADDRESS);
    expect(balUSDTContractBefore).to.equal(newBalUSDTowner.sub(balUSDTBefore));
    const balATEN = await ATEN_TOKEN_CONTRACT.connect(owner).balanceOf(
      PRIVATE_SALE_CONTRACT.address
    );
    expect(balATEN.toString()).to.not.equal("0");
  });
  it("Should token mapping prebuy is /4 round", async function () {
    this.timeout(120000);
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(owner);
    const accounts = await ethers.getSigners();
    // Careful, -1 to avoid last user changed address test above
    const signerLocal = accounts[0];
    const amount = await PRIVATE_SALE_CONTRACT.connect(signerLocal).presales(
      signerLocal.address
    );
    expect(amount.toString()).to.equal(expectedATEN.div(12).mul(12).toString());
  });

  it("Should users claim and get tokens 1 / 4 ", async function () {
    this.timeout(120000);
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(owner);
    const accounts = await ethers.getSigners();
    // Careful, -2 to avoid last user changed address test above
    for (let index = 0; index < 11 - 2; index++) {
      const signerLocal = accounts[index];
      const claim = await PRIVATE_SALE_CONTRACT.connect(signerLocal).claim();
      await claim.wait();
      expect(claim).to.have.property("hash");
      const balance = await ATEN_TOKEN_CONTRACT.balanceOf(signerLocal.address);
      expect(balance.toString()).to.equal(expectedATEN.div(4).toString());
    }
  });

  it("Should user claim again and get NO token again", async function () {
    this.timeout(120000);
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(owner);
    const accounts = await ethers.getSigners();
    const signerLocal = accounts[1];
    await expect(
      PRIVATE_SALE_CONTRACT.connect(signerLocal).claim()
    ).to.be.revertedWith("Already claimed batch");
    const balance = await ATEN_TOKEN_CONTRACT.balanceOf(signerLocal.address);
    expect(balance.toString()).to.equal(expectedATEN.div(4).toString());
  });

  it("Should users claim and get tokens 2 / 4 ", async function () {
    await hre.network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [DATE_NOW + 60 * 60 * 24 * 31],
    });
    this.timeout(120000);
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(owner);
    const accounts = await ethers.getSigners();
    // Careful, -1 to avoid last user changed address test above
    for (let index = 1; index < 10 - 3; index++) {
      const signerLocal = accounts[index];
      const claim = await PRIVATE_SALE_CONTRACT.connect(signerLocal).claim();
      await claim.wait();
      expect(claim).to.have.property("hash");
      const balance = await ATEN_TOKEN_CONTRACT.balanceOf(signerLocal.address);
      expect(balance.toString()).to.equal(
        expectedATEN.mul(2).div(4).toString()
      );
    }
  });

  it("Should now have empty ATEN balance on Contract", async () => {
    const balATEN = await ATEN_TOKEN_CONTRACT.connect(owner).balanceOf(
      PRIVATE_SALE_CONTRACT.address
    );
    expect(balATEN.toString()).to.equal("0");
  });
});
