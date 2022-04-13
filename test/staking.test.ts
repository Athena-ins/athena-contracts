import chai, { expect } from "chai";
import hre, { ethers } from "hardhat";
import { ethers as ethersOriginal } from "ethers";
import weth_abi from "../abis/weth.json";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const STAKING_TOKEN = WETH;

const STAKING_TOKEN_CONTRACT = new ethers.Contract(
  STAKING_TOKEN,
  weth_abi
).connect(ethers.provider.getSigner());

const signer = ethers.provider.getSigner();
let signerAddress: string;
let ATHENA_CONTRACT: ethersOriginal.Contract;

describe("Staking Rewards", function () {
  const ETH_VALUE = "5000";
  let DATE_NOW: number;

  before(async () => {
    signerAddress = await signer.getAddress();
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

  it("Should deposit ETH", async function () {
    const [owner] = await ethers.getSigners();
    console.log("Signer : ", signerAddress);
    console.log("Owner : ", owner.address);

    const deposit = await STAKING_TOKEN_CONTRACT.deposit({
      value: ethers.utils.parseEther(ETH_VALUE),
    });
    await deposit.wait();
    expect(
      (await STAKING_TOKEN_CONTRACT.balanceOf(owner.address)).toString()
    ).to.equal(ethers.utils.parseEther(ETH_VALUE));
  });

  /**
   *
   * CONTRACT DEPLOYMENT
   *
   */

  it("Should deploy contract", async function () {
    const factory = await ethers.getContractFactory("Athena");
    ATHENA_CONTRACT = await factory.deploy(STAKING_TOKEN, ATEN_TOKEN, USDT);
    //await factory.deploy(STAKING_TOKEN, ATEN_TOKEN);
    await ATHENA_CONTRACT.deployed();

    expect(await ethers.provider.getCode(ATHENA_CONTRACT.address)).to.not.equal(
      "0x"
    );
  });

  /**
   *
   * STAKING
   *
   */

  it.skip("Should stake & return the staking amount", async function () {
    const approve = await STAKING_TOKEN_CONTRACT.approve(
      ATHENA_CONTRACT.address,
      ethers.utils.parseEther("1000000")
    );
    await approve.wait();
    const multi = await ATHENA_CONTRACT.multicall([
      ATHENA_CONTRACT.interface.encodeFunctionData("stake", [
        ethers.utils.parseEther("2000"),
      ]),
      ATHENA_CONTRACT.interface.encodeFunctionData("stake", [
        ethers.utils.parseEther("3000"),
      ]),
    ]);
    // const oneMore = await ATHENA_CONTRACT.stake(ethers.utils.parseEther("1000"));
    // await hre.network.provider.request({
    //   method: "evm_increaseTime",
    //   params: [Number.parseInt(((1000 * 60 * 60 * 24) / 1000).toString())],
    // });
    await hre.network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [DATE_NOW + 60 * 60 * 24],
    });
    await hre.network.provider.send("evm_mine");

    expect(await ethers.provider.getBlock("latest")).to.contain({
      timestamp: Number.parseInt((DATE_NOW + 60 * 60 * 24).toString()),
    });

    // await ATHENA_CONTRACT.stake(ethers.utils.parseEther("5"));
    // await ATHENA_CONTRACT.stake(ethers.utils.parseEther("5"));
    expect(
      (await ATHENA_CONTRACT.balanceOf(signerAddress)).toString()
    ).to.equal(ethers.utils.parseEther(ETH_VALUE));
    expect(await ATHENA_CONTRACT.earned(signerAddress)).to.equal(
      ethers.utils.parseEther("85000") // should be 86400 ?? See google doc sheet
    );
  });
  it.skip("Should get reward per token", async function () {
    expect(await ethers.provider.getBlock("latest")).to.contain({
      timestamp: Number.parseInt((DATE_NOW + 60 * 60 * 24).toString()),
    });
    expect((await ATHENA_CONTRACT.rewardPerToken()).toString()).to.equal(
      "17" // Should be 17.28 ?? => INT FOR EVM
    );
    expect(
      Number(
        ethers.utils.formatEther(await ATHENA_CONTRACT.earned(signerAddress))
      )
    ).to.be.greaterThan(0);
  });

});
