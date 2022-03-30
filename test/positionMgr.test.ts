import chai, { expect } from "chai";
import hre, { ethers } from "hardhat";
import { BigNumber, ethers as originalEthers } from "ethers";
import { ethers as ethersOriginal, utils } from "ethers";
import weth_abi from "../abis/weth.json";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
const USDT_Wrong = "0xdac17f958d2ee523a2206206994597c13d831ec8"; //USDT
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const NULL_ADDRESS = "0x" + "0".repeat(40);
const STAKING_TOKEN = WETH;

const USDT_TOKEN_CONTRACT = new ethers.Contract(USDT, weth_abi);

const STAKING_TOKEN_CONTRACT = new ethers.Contract(
  STAKING_TOKEN,
  weth_abi
).connect(ethers.provider.getSigner());

let owner: originalEthers.Signer, user: originalEthers.Signer;
let ownerAddress: string;
let userAddress: string;
let ATHENA_CONTRACT: ethersOriginal.Contract;

describe("Position Manager", function () {
  const ETH_VALUE = "5000";
  let DATE_NOW: number;

  before(async () => {
    const allSigners = await ethers.getSigners();
    owner = allSigners[0];
    user = allSigners[1];
    userAddress = await user.getAddress();
    ownerAddress = await owner.getAddress();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.MAINNET_URL,
            blockNumber: 14307200,
          },
        },
      ],
    });
    DATE_NOW = Number.parseInt(((Date.now() + 1000) / 1000).toString());
    await hre.network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [DATE_NOW],
    });
  });

  /**
   *
   * CONTRACT DEPLOYMENT
   *
   */

  it("Should deploy contract", async function () {
    const factory = await ethers.getContractFactory("Athena");
    ATHENA_CONTRACT = await factory
      .connect(owner)
      .deploy(USDT, STAKING_TOKEN, ATEN_TOKEN);
    //await factory.deploy(STAKING_TOKEN, ATEN_TOKEN);
    await ATHENA_CONTRACT.deployed();

    expect(await ethers.provider.getCode("0x" + "0".repeat(40))).to.equal("0x");

    expect(await ethers.provider.getCode(ATHENA_CONTRACT.address)).to.not.equal(
      "0x"
    );
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
  });

  /**
   *
   * STAKING
   *
   */

  it("Should revert inactive protocol for depositing funds", async function () {
    expect(
      ATHENA_CONTRACT.connect(user).deposit(10000, USDT, [0])
    ).revertedWith("Protocol not active");
  });
  it("Should revert new active Protocol not owner", async function () {
    await expect(
      ATHENA_CONTRACT.connect(user).addNewProtocol("Test protocol", 0, WETH, [
        0,
      ])
    ).to.be.rejectedWith("Ownable: caller is not the owner");
  });
  it("Should set new active Protocol", async function () {
    const tx = await ATHENA_CONTRACT.addNewProtocol(
      "Test protocol",
      0,
      WETH,
      []
    );
    expect(tx).to.haveOwnProperty("hash");
    const prot = await ATHENA_CONTRACT.protocols(0);
    expect(prot.name).to.equal("Test protocol");
  });

  it("Should set new active Protocol 2 ", async function () {
    const tx = await ATHENA_CONTRACT.addNewProtocol(
      "Test protocol 2",
      0,
      NULL_ADDRESS,
      []
    );
    expect(tx).to.haveOwnProperty("hash");
    const prot = await ATHENA_CONTRACT.protocols(0);
    expect(prot.name).to.equal("Test protocol");
  });

  it("Should set new active Protocol 3 not compatible with 0", async function () {
    const tx = await ATHENA_CONTRACT.addNewProtocol(
      "Test protocol 3",
      0,
      NULL_ADDRESS,
      [0]
    );
    expect(tx).to.haveOwnProperty("hash");
    const prot = await ATHENA_CONTRACT.protocols(0);
    expect(prot.name).to.equal("Test protocol");
  });

  it("Should revert for wrong ERC20 for depositing funds", async function () {
    expect(
      ATHENA_CONTRACT.connect(user).deposit(10000, USDT_Wrong, [0])
    ).revertedWith("Wrong ERC20 used for deposit");
  });

  it("Should revert for wrong compatibility protocols for depositing funds", async function () {
    await expect(
      ATHENA_CONTRACT.connect(user).deposit(10000, USDT, [0, 2])
    ).revertedWith("Protocol not compatible");
    // await expect(
    //   ATHENA_CONTRACT.connect(user).deposit(10000, USDT, [0, 2])
    // ).revertedWith("Wrong ERC20 used for deposit");
  });

  it("Should get NFT for depositing funds", async function () {
    //Approve before sending !
    const approved = await new ethers.Contract(USDT, weth_abi, user).approve(
      ATHENA_CONTRACT.address,
      utils.parseEther("100000000000")
    );
    await approved.wait();
    const tx = await ATHENA_CONTRACT.connect(user).deposit(10000, USDT, [0, 1]);
    expect(tx).to.haveOwnProperty("hash");
    const bal = await USDT_TOKEN_CONTRACT.connect(user).balanceOf(
      ATHENA_CONTRACT.address
    );
    expect(bal).to.equal(10000);

    const balNFT = await ATHENA_CONTRACT.balanceOf(userAddress, 0);
    expect(balNFT).to.equal("1");
  });
  //await ATHENA_CONTRACT.balanceOf(signerAddress)).to.be.true;
});

describe("Policy Manager", function () {
  const ETH_VALUE = "5000";
  let DATE_NOW: number;

  before(async () => {
    const allSigners = await ethers.getSigners();
    owner = allSigners[0];
    user = allSigners[1];
    userAddress = await user.getAddress();
    ownerAddress = await owner.getAddress();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.MAINNET_URL,
            blockNumber: 14307200,
          },
        },
      ],
    });
    DATE_NOW = Number.parseInt(((Date.now() + 1000) / 1000).toString());
    await hre.network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [DATE_NOW],
    });
  });

  /**
   *
   * CONTRACT DEPLOYMENT
   *
   */

  it("Should deploy contract", async function () {
    const factory = await ethers.getContractFactory("Athena");
    ATHENA_CONTRACT = await factory.deploy(USDT, STAKING_TOKEN, ATEN_TOKEN);
    //await factory.deploy(STAKING_TOKEN, ATEN_TOKEN);
    await ATHENA_CONTRACT.deployed();

    expect(await ethers.provider.getCode("0x" + "0".repeat(40))).to.equal("0x");

    expect(await ethers.provider.getCode(ATHENA_CONTRACT.address)).to.not.equal(
      "0x"
    );
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
  });
});
