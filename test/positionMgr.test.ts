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
const AAVE_LENDING_POOL = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
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
  ATHENA_CONTRACT: ethersOriginal.Contract,
  POS_CONTRACT: ethersOriginal.Contract,
  STAKED_ATENS_CONTRACT: ethersOriginal.Contract;

const BN = (num: string | number) => ethers.BigNumber.from(num);

describe("Position Manager", function () {
  const ETH_VALUE = "5000";
  let DATE_NOW: number;

  before(async () => {
    const allSigners = await ethers.getSigners();
    owner = allSigners[0];
    user = allSigners[1];
    user2 = allSigners[2];
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
      .deploy(USDT, ATEN_TOKEN, AAVE_LENDING_POOL);
    //await factory.deploy(STAKING_TOKEN, ATEN_TOKEN);
    await ATHENA_CONTRACT.deployed();

    expect(await ethers.provider.getCode("0x" + "0".repeat(40))).to.equal("0x");

    expect(await ethers.provider.getCode(ATHENA_CONTRACT.address)).to.not.equal(
      "0x"
    );
    /** Positions Manager */
    const factoryPos = await ethers.getContractFactory("PositionsManager");
    POS_CONTRACT = await factoryPos
      .connect(owner)
      .deploy(ATHENA_CONTRACT.address);
    await POS_CONTRACT.deployed();
    expect(await ethers.provider.getCode(POS_CONTRACT.address)).to.not.equal(
      "0x"
    );
    const factoryStakedAtens = await ethers.getContractFactory("StakedAten");
    STAKED_ATENS_CONTRACT = await factoryStakedAtens
      .connect(owner)
      .deploy(ATEN_TOKEN, ATHENA_CONTRACT.address);
    await STAKED_ATENS_CONTRACT.deployed();
    expect(
      await ethers.provider.getCode(STAKED_ATENS_CONTRACT.address)
    ).to.not.equal("0x");
    /**
     * Initialize protocol with required values
     */
    const init = await ATHENA_CONTRACT.initialize(
      POS_CONTRACT.address,
      STAKED_ATENS_CONTRACT.address
    );
    await init.wait();
    expect(init).to.haveOwnProperty("hash");
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

  /**
   *
   * STAKING
   *
   */

  it("Should revert inactive protocol for depositing funds", async function () {
    expect(
      ATHENA_CONTRACT.connect(user).deposit(10000, 0, [0], [1])
    ).revertedWith("Protocol not active");
  });
  it("Should revert new active Protocol not owner", async function () {
    await expect(
      ATHENA_CONTRACT.connect(user).addNewProtocol(
        "Test protocol",
        0,
        1,
        WETH,
        [0]
      )
    ).to.be.rejectedWith("Ownable: caller is not the owner");
  });
  it("Should set new active Protocol 0", async function () {
    const tx = await ATHENA_CONTRACT.addNewProtocol(
      "Test protocol 0",
      0,
      30,
      WETH,
      []
    );
    expect(tx).to.haveOwnProperty("hash");
    const prot = await ATHENA_CONTRACT.protocols(0);
    expect(prot.name).to.equal("Test protocol 0");
  });

  it("Should set new active Protocol 1 ", async function () {
    const tx = await ATHENA_CONTRACT.addNewProtocol(
      "Test protocol 1",
      0,
      30,
      NULL_ADDRESS,
      []
    );
    expect(tx).to.haveOwnProperty("hash");
    const prot = await ATHENA_CONTRACT.protocols(1);
    expect(prot.name).to.equal("Test protocol 1");
  });

  it("Should set new active Protocol 2 not compatible with 0", async function () {
    const tx = await ATHENA_CONTRACT.addNewProtocol(
      "Test protocol 2",
      0,
      30,
      NULL_ADDRESS,
      [0]
    );
    expect(tx).to.haveOwnProperty("hash");
    const prot = await ATHENA_CONTRACT.protocols(2);
    expect(prot.name).to.equal("Test protocol 2");
  });

  // Not used anymore, assuming token is checked and transferred
  // it("Should revert for wrong ERC20 for depositing funds", async function () {
  //   expect(
  //     ATHENA_CONTRACT.connect(user).deposit(10000, USDT_Wrong, [0])
  //   ).revertedWith("Wrong ERC20 used for deposit");
  // });

  it("Should set discounts with Aten", async function () {
    const tx = await ATHENA_CONTRACT.connect(owner).setDiscountWithAten([
      [1000, 10],
      [100000, 20],
      [1000000, 50],
    ]);
    expect(tx).to.haveOwnProperty("hash");
    const discountFirst = await ATHENA_CONTRACT.connect(
      owner
    ).premiumAtenDiscounts(0);
    expect(discountFirst.atenAmount).to.equal(BN(1000));
    expect(discountFirst.discount).to.equal(BN(10));
    const discountSnd = await ATHENA_CONTRACT.connect(
      owner
    ).premiumAtenDiscounts(1);
    expect(discountSnd.atenAmount).to.equal(BN(100000));
    expect(discountSnd.discount).to.equal(BN(20));
    const discountThird = await ATHENA_CONTRACT.connect(
      owner
    ).premiumAtenDiscounts(2);
    expect(discountThird.atenAmount).to.equal(BN(1000000));
    expect(discountThird.discount).to.equal(BN(50));

    await expect(
      ATHENA_CONTRACT.connect(owner).premiumAtenDiscounts(3)
    ).to.be.rejectedWith();
  });

  it("Should get discount amount with Aten", async function () {
    expect(
      await ATHENA_CONTRACT.connect(user).getDiscountWithAten(999)
    ).to.equal(0);
    expect(
      await ATHENA_CONTRACT.connect(user).getDiscountWithAten(1000)
    ).to.equal(10);
    expect(
      await ATHENA_CONTRACT.connect(user).getDiscountWithAten(10000000)
    ).to.equal(50);
  });

  it("Should set reward Rates ATEN with USD", async function () {
    const tx = await STAKED_ATENS_CONTRACT.connect(owner).setStakeRewards([
      [1, 100],
      [10000, 120],
      [100000, 160],
      [1000000, 200],
    ]);
    expect(tx).to.haveOwnProperty("hash");
    const discountFirst = await STAKED_ATENS_CONTRACT.connect(owner).getRate(0);
    expect(discountFirst).to.equal(BN(0));
    expect(await STAKED_ATENS_CONTRACT.connect(owner).getRate(1000)).to.equal(
      BN(100)
    );
  });

  describe("Deposit funds", () => {
    it("Should approve funds", async function () {
      //Approve before sending !
      const approved = await new ethers.Contract(USDT, weth_abi, user).approve(
        ATHENA_CONTRACT.address,
        utils.parseEther("100000000000")
      );
      await approved.wait();
      expect(approved).to.haveOwnProperty("hash");
    });
    it("Should revert for wrong length of args", async function () {
      await expect(
        ATHENA_CONTRACT.connect(user).deposit(10000, USDT, [0, 2], [1])
      ).revertedWith("Invalid deposit protocol length");
    });
    it("Should revert for wrong compatibility protocols for depositing funds", async function () {
      await expect(
        ATHENA_CONTRACT.connect(user).deposit(10000, USDT, [0, 2], [1, 1])
      ).revertedWith("Protocol not compatible");
    });
    it("Should revert for wrong compatibility protocols for depositing funds, inverted numbers", async function () {
      await expect(
        ATHENA_CONTRACT.connect(user).deposit(10000, USDT, [2, 0], [1, 1])
      ).revertedWith("Protocol not compatible");
    });
    it("Should success deposit funds user 1", async function () {
      const tx = await ATHENA_CONTRACT.connect(user).deposit(
        10000,
        10000,
        [0, 1],
        [10000, 10000]
      );
      expect(tx).to.haveOwnProperty("hash");
      const bal = await USDT_TOKEN_CONTRACT.connect(user).balanceOf(
        ATHENA_CONTRACT.address
      );
      expect(bal).to.equal(10000);
    });

    it("Should fail depositing funds for earlier position", async function () {
      await expect(
        ATHENA_CONTRACT.connect(user).deposit(1, 1, [0], [1])
      ).to.be.rejectedWith("Already have a position");
    });
    it("Should success deposit funds user 2", async function () {
      const approved2 = await new ethers.Contract(
        USDT,
        weth_abi,
        user2
      ).approve(ATHENA_CONTRACT.address, utils.parseEther("100000000000"));
      await approved2.wait();
      const tx2 = await ATHENA_CONTRACT.connect(user2).deposit(
        10001,
        10000,
        [0],
        [10000]
      );
      expect(tx2).to.haveOwnProperty("hash");
    });
    it("Should check funds and NFT", async function () {
      const bal2 = await USDT_TOKEN_CONTRACT.connect(user2).balanceOf(
        ATHENA_CONTRACT.address
      );
      expect(bal2).to.equal(20001);

      const balNFT = await POS_CONTRACT.balanceOf(userAddress);
      const userNFTindex = await POS_CONTRACT.tokenOfOwnerByIndex(
        userAddress,
        0
      );
      const userNFTindex2 = await POS_CONTRACT.tokenOfOwnerByIndex(
        user2.getAddress(),
        0
      );
      expect(balNFT).to.equal("1");
      expect(userNFTindex).to.equal("0"); // tokenid 0
      expect(userNFTindex2).to.equal("1"); // tokenid 1
      const position = await POS_CONTRACT.positions(0);
      expect(position.liquidity).to.equal(BN("10000"));
      expect(position.protocolsId).to.deep.equal([BN(0), BN(1)]); // deep equal because array is different, BN values are the same

      const position2 = await POS_CONTRACT.positions(1);
      expect(position2.liquidity).to.equal(BN("10001"));
      expect(position2.protocolsId).to.deep.equal([BN(0)]); // deep equal because array is different, BN values are the same
    });
  });

  //await ATHENA_CONTRACT.balanceOf(signerAddress)).to.be.true;
});
