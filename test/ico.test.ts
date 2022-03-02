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

const WETH_TOKEN_CONTRACT = new ethers.Contract(WETH, weth_abi).connect(
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

  it("Should deposit ETH", async function () {
    const deposit = await WETH_TOKEN_CONTRACT.deposit({
      value: ethers.utils.parseEther(ETH_VALUE),
    });
    await deposit.wait();
    expect(
      (await WETH_TOKEN_CONTRACT.balanceOf(signerAddress)).toString()
    ).to.equal(ethers.utils.parseEther(ETH_VALUE));
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

  it("Should Mint some ICO", async function () {
    const approve = await WETH_TOKEN_CONTRACT.approve(
      ATHENA_CONTRACT.address,
      ethers.utils.parseEther("1000000")
    );
    await approve.wait();

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

  /**
   *
   * PROTOCOLS Handlers
   * POSITION MANAGER ERC721
   *
   */

  it("Should distribute tokens to addresses", async function () {
    // NEED ATEN ON FROM OR CANT SEND THEM !!
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
    expect(bal.toString()).to.equal("86041705667753779780085");
  });
});
