import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { ethers as ethersOriginal } from "ethers";
import weth_abi from "../abis/weth.json";
const ATEN_TOKEN = process.env.ATEN_TOKEN || "0x";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const WETH_TOKEN_CONTRACT = new ethers.Contract(WETH, weth_abi).connect(
  ethers.provider.getSigner()
);

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
    ATHENA_CONTRACT = await factory.deploy([WETH, USDT]);
    await ATHENA_CONTRACT.deployed();

    console.log("Deployed ICO Contract : ", ATHENA_CONTRACT.address);

    expect(await ethers.provider.getCode(ATHENA_CONTRACT.address)).to.not.equal(
      "0x00"
    );
    // expect(await ATHENA_CONTRACT.authTokens(1)).to.equal(WETH);
  });

  /**
   *
   * Mint
   *
   */

  it("Should Mint some ICO", async function () {
    const approve = await WETH_TOKEN_CONTRACT.approve(
      ATHENA_CONTRACT.address,
      ethers.utils.parseEther("1000000")
    );
    // const approve2 = await USDT_TOKEN_CONTRACT.approve(
    //   ATHENA_CONTRACT.address,
    //   ethers.utils.parseEther("1000000")
    // );
    await approve.wait();

    const mint = await ATHENA_CONTRACT.mint(
      ethers.utils.parseEther(ETH_VALUE),
      WETH,
      signerAddress
    );
    await mint.wait();

    expect(mint).to.have.property("hash");
  });

  /**
   *
   * PROTOCOLS Handlers
   * POSITION MANAGER ERC721
   *
   */

  it("Should distribute tokens to addresses", async function () {
    expect(() => ATHENA_CONTRACT.distribute(signerAddress)).to.have.property(
      "hash"
    );

    // revertedWith(
    //   "Protocol not active"
    // );
  });
});
