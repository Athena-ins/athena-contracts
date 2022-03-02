import { expect } from "chai";
import { before } from "mocha";
import hre, { ethers } from "hardhat";
import { ethers as ethersOriginal } from "ethers";
import weth_abi from "../abis/weth.json";
const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const ATEN_OWNER_ADDRESS = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const ALLOWANCE = ethersOriginal.utils.parseEther("3000000000");
const wei = ethersOriginal.BigNumber.from(10).pow(18);

// const WETH_TOKEN_CONTRACT = new ethers.Contract(WETH, weth_abi).connect(
//   ethers.provider.getSigner()
// );

const USDT_TOKEN_CONTRACT = new ethers.Contract(USDT, weth_abi).connect(
  ethers.provider.getSigner()
);

const signer = ethers.provider.getSigner();
let signerAddress: string;
let ATHENA_CONTRACT: ethersOriginal.Contract;

describe("ICO Pre sale", function () {
  const ETH_VALUE = "1";
  before(async () => {
    signerAddress = await signer.getAddress();
  });

  /**
   *
   * CONTRACT DEPLOYMENT
   *
   */

  it("Should deploy contract", async function () {
    const factory = await ethers.getContractFactory("AthenaICO");
    ATHENA_CONTRACT = await factory.deploy(
      [ETH, USDT],
      "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46" // Chainlink MAINNET USDT/ETH
    );
    await ATHENA_CONTRACT.deployed();

    // console.log("Deployed ICO Contract : ", ATHENA_CONTRACT.address);

    expect(await ethers.provider.getCode(ATHENA_CONTRACT.address)).to.not.equal(
      "0x00"
    );
    // expect(await ATHENA_CONTRACT.authTokens(1)).to.equal(WETH);
  });

  it("Should impersonate and allow ATEN spent", async () => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ATEN_OWNER_ADDRESS],
    });
    const signer = await ethers.getSigner(ATEN_OWNER_ADDRESS);
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(signer);
    const allowContract = await ATEN_TOKEN_CONTRACT.approve(
      ATHENA_CONTRACT.address,
      ALLOWANCE
    );
    await allowContract.wait();
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [ATEN_OWNER_ADDRESS],
    });
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
  });

  it("Should get ATEN amount from 1 WETH", async () => {
    // Fixed block for ETH @3011 USDT
    // ATEN @0.035 = 86041 ATEN for 1 ETH
    const mapping = await ATHENA_CONTRACT.presales(signerAddress);
    expect(mapping.toString()).to.equal("86041705667753779780085");
  });

  it("Should transfer USDT from Binance to Signer ", async () => {
    //BINANCE WALLET 1Md2 USDT 0xF977814e90dA44bFA03b6295A0616a897441aceC
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xf977814e90da44bfa03b6295a0616a897441acec"],
    });
    const signer = await ethers.getSigner(
      "0xF977814e90dA44bFA03b6295A0616a897441aceC"
    );
    const transfer = await USDT_TOKEN_CONTRACT.connect(signer).transfer(
      signerAddress,
      ethers.utils.parseUnits("20000", 6)
    );
    await transfer.wait();
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: ["0xf977814e90da44bfa03b6295a0616a897441acec"],
    });
    const balUSDT = await USDT_TOKEN_CONTRACT.balanceOf(signerAddress);
    expect(balUSDT.toString()).to.equal(ethers.utils.parseUnits("20000", 6));
  });

  it("Should Mint some ICO with USDT", async function () {
    const approve = await USDT_TOKEN_CONTRACT.approve(
      ATHENA_CONTRACT.address,
      ethersOriginal.utils.parseUnits("20000", 6)
    );
    await approve.wait();
    const mint = await ATHENA_CONTRACT.prebuy(
      ethers.utils.parseUnits("20000", 6),
      USDT,
      signerAddress
    );
    await mint.wait();

    expect(mint).to.have.property("hash");
    const balance = await USDT_TOKEN_CONTRACT.balanceOf(
      ATHENA_CONTRACT.address
    );
    expect(balance.toString()).to.equal(ethers.utils.parseUnits("20000", 6));
  });

  /**
   *
   * PROTOCOLS Handlers
   * POSITION MANAGER ERC721
   *
   */

  it("Should distribute tokens to addresses", async function () {
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(signer);
    const allowed = await ATEN_TOKEN_CONTRACT.allowance(
      ATEN_OWNER_ADDRESS,
      ATHENA_CONTRACT.address
    );
    expect(allowed.toString()).to.equal(ALLOWANCE.toString());
    const distribute = await ATHENA_CONTRACT.distribute(ATEN_OWNER_ADDRESS);
    const receipt = await distribute.wait();
    expect(receipt).to.have.property("transactionHash");
    // Check ATEN tokens on buyer
    const bal = await ATEN_TOKEN_CONTRACT.balanceOf(signerAddress);
    // expect(bal.toString()).to.equal("86041705667753779780085"); //WETH ONLY
    expect(bal.toString()).to.equal("657470277096325208351513"); //With USDT
  });

  /**
   * WE WITHDRAW ALL BALANCES TO CLEAN CONTRACT
   */

  it("Should withdraw ETH and USDT from Contract", async () => {
    const balETHBefore = await ethers.provider.getBalance(ATEN_OWNER_ADDRESS);
    const balUSDTBefore = await USDT_TOKEN_CONTRACT.balanceOf(
      ATEN_OWNER_ADDRESS
    );
    const withdraw = await ATHENA_CONTRACT.withdraw(
      [ETH, USDT],
      ATEN_OWNER_ADDRESS
    );
    expect(await ethers.provider.getBalance(ATEN_OWNER_ADDRESS)).to.equal(
      balETHBefore.add(ethers.utils.parseEther(ETH_VALUE))
    );
    expect(await USDT_TOKEN_CONTRACT.balanceOf(ATEN_OWNER_ADDRESS)).to.equal(
      balUSDTBefore.add(ethers.utils.parseUnits("20000", 6))
    );
  });

  /**
   * NOW WE MINT 10k ADDRESSES AND DISTRIBUTE
   */
  it("Should mint 10k addresses", async function () {
    this.timeout(120000);
    const accounts = await ethers.getSigners();
    for (let index = 0; index < accounts.length; index++) {
      const signer = accounts[index];
      const mint = await ATHENA_CONTRACT.connect(signer).prebuy(
        ethers.utils.parseEther(ETH_VALUE),
        ETH,
        signer.address,
        {
          value: ethers.utils.parseEther(ETH_VALUE),
        }
      );
      await mint.wait();
      expect(mint).to.have.property("hash");
    //   const balance = await ethers.provider.getBalance(ATHENA_CONTRACT.address);
    //   expect(balance.toString()).to.equal(
    //     ethers.utils.parseEther((index + 1).toString())
    //   );
    }
    const balance = await ethers.provider.getBalance(ATHENA_CONTRACT.address);
    expect(balance.toString()).to.equal(
      ethers.utils.parseEther((accounts.length).toString())
    );
  });
  it("Should distribute tokens to 10k addresses", async function () {
    this.timeout(120000);
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi
    ).connect(signer);
    const distribute = await ATHENA_CONTRACT.distribute(ATEN_OWNER_ADDRESS);
    const receipt = await distribute.wait();
    expect(receipt).to.have.property("transactionHash");
    // Check ATEN tokens on buyer

    const accounts = await ethers.getSigners();
    for (let index = 1; index < accounts.length; index++) {
      const signer = accounts[index];
      const bal = await ATEN_TOKEN_CONTRACT.balanceOf(signer.address);
      // expect(bal.toString()).to.equal("86041705667753779780085"); //WETH ONLY
      expect(bal.toString()).to.equal("86041705667753779780085"); //With USDT
    }
  });
});
