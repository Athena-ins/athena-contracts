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
  ATHENA_CONTRACT: ethersOriginal.Contract,
  POS_CONTRACT: ethersOriginal.Contract,
  STAKED_ATENS_CONTRACT: ethersOriginal.Contract,
  ATEN_TOKEN_CONTRACT: ethersOriginal.Contract,
  POLICY_CONTRACT: ethersOriginal.Contract,
  allSigners: originalEthers.Signer[];

const BN = (num: string | number) => ethers.BigNumber.from(num);

describe("Position Manager", function () {
  const ETH_VALUE = "5000";
  let DATE_NOW: number;

  before(async () => {
    allSigners = await ethers.getSigners();
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
    ATEN_TOKEN_CONTRACT = new ethers.Contract(ATEN_TOKEN, weth_abi);
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
      .deploy(USDT, ATEN_TOKEN, AAVE_REGISTRY);
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

    /** Policy Manager */
    const factoryPolicy = await ethers.getContractFactory("PolicyManager");
    POLICY_CONTRACT = await factoryPolicy
      .connect(owner)
      .deploy(ATHENA_CONTRACT.address);
    await POLICY_CONTRACT.deployed();
    expect(await ethers.provider.getCode(POLICY_CONTRACT.address)).to.not.equal(
      "0x"
    );
  });

  it("Should initialize Protocol", async () => {
    /**
     * Initialize protocol with required values
     */
    const init = await ATHENA_CONTRACT.initialize(
      POS_CONTRACT.address,
      STAKED_ATENS_CONTRACT.address,
      POLICY_CONTRACT.address
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

    /** ATEN TOKENS  */
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ATEN_OWNER_ADDRESS],
    });
    const atenOwnerSigner = await ethers.getSigner(ATEN_OWNER_ADDRESS);
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi,
      atenOwnerSigner
    );
    await ATEN_TOKEN_CONTRACT.transfer(
      userAddress,
      ethers.utils.parseEther("10000000")
    );
    await ATEN_TOKEN_CONTRACT.transfer(
      await user2.getAddress(),
      ethers.utils.parseEther("10000000")
    );
    await ATEN_TOKEN_CONTRACT.connect(user).approve(
      STAKED_ATENS_CONTRACT.address,
      ethers.utils.parseEther("10000000")
    );
    await ATEN_TOKEN_CONTRACT.connect(user2).approve(
      STAKED_ATENS_CONTRACT.address,
      ethers.utils.parseEther("10000000")
    );
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
    const prot = await ATHENA_CONTRACT.protocolsMapping(0);
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
    const prot = await ATHENA_CONTRACT.protocolsMapping(1);
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
    const prot = await ATHENA_CONTRACT.protocolsMapping(2);
    expect(prot.name).to.equal("Test protocol 2");
  });

  // Not used anymore, assuming token is checked and transferred
  // it("Should revert for wrong ERC20 for depositing funds", async function () {
  //   expect(
  //     ATHENA_CONTRACT.connect(user).deposit(10000, USDT_Wrong, [0])
  //   ).revertedWith("Wrong ERC20 used for deposit");
  // });

  it("Should set discounts with Aten", async function () {
    const tx = await ATHENA_CONTRACT.connect(owner).setFeesWithAten([
      [1000, 200],
      [100000, 150],
      [1000000, 50],
    ]);
    expect(tx).to.haveOwnProperty("hash");
    const discountFirst = await ATHENA_CONTRACT.connect(owner).premiumAtenFees(
      0
    );
    expect(discountFirst.atenAmount).to.equal(BN(1000));
    expect(discountFirst.discount).to.equal(BN(200));
    const discountSnd = await ATHENA_CONTRACT.connect(owner).premiumAtenFees(1);
    expect(discountSnd.atenAmount).to.equal(BN(100000));
    expect(discountSnd.discount).to.equal(BN(150));
    const discountThird = await ATHENA_CONTRACT.connect(owner).premiumAtenFees(
      2
    );
    expect(discountThird.atenAmount).to.equal(BN(1000000));
    expect(discountThird.discount).to.equal(BN(50));

    await expect(
      ATHENA_CONTRACT.connect(owner).premiumAtenFees(3)
    ).to.be.rejectedWith();
  });

  it("Should get discount amount with Aten", async function () {
    expect(await ATHENA_CONTRACT.connect(user).getFeesWithAten(999)).to.equal(
      0
    );
    expect(await ATHENA_CONTRACT.connect(user).getFeesWithAten(1000)).to.equal(
      200
    );
    expect(
      await ATHENA_CONTRACT.connect(user).getFeesWithAten(10000000)
    ).to.equal(50);
  });

  it("Should set reward Rates ATEN with USD", async function () {
    await expect(
      STAKED_ATENS_CONTRACT.connect(owner).setStakeRewards([
        [1000, 1000],
        [10, 1200],
      ])
    ).to.be.rejectedWith("Rate must be in ascending order");
    const tx = await STAKED_ATENS_CONTRACT.connect(owner).setStakeRewards([
      ["1", "1000"],
      ["10000", "1200"],
      ["100000", "1600"],
      ["1000000", "2000"],
    ]);
    expect(tx).to.haveOwnProperty("hash");
    const discountFirst = await STAKED_ATENS_CONTRACT.connect(owner).getRate(0);
    expect(discountFirst).to.equal(BN(0));
    expect(await STAKED_ATENS_CONTRACT.connect(owner).getRate(10)).to.equal(
      BN(1000)
    );
    expect(
      await STAKED_ATENS_CONTRACT.connect(owner).getRate("10000")
    ).to.equal(BN(1200));
    expect(
      await STAKED_ATENS_CONTRACT.connect(owner).getRate("100001")
    ).to.equal(BN(1600));
    expect(
      await STAKED_ATENS_CONTRACT.connect(owner).getRate(1000000)
    ).to.equal(BN(2000));
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
        100000,
        [0, 1],
        [10000, 10000]
      );
      expect(tx).to.haveOwnProperty("hash");

      // we check AAVE aToken balance
      expect(
        await getATokenBalance(AAVE_LENDING_POOL, ATHENA_CONTRACT, USDT, user)
      ).to.equal(10000);
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
        1001,
        9000000,
        [0],
        [10000]
      );
      expect(tx2).to.haveOwnProperty("hash");
    });
    it("Should check funds and NFT", async function () {
      // Now its not USDT on contract anymore but AAVE LP !
      expect(
        (
          await getATokenBalance(AAVE_LENDING_POOL, ATHENA_CONTRACT, USDT, user)
        ).toNumber()
      ).to.be.greaterThanOrEqual(11001);

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
      expect(position2.liquidity).to.equal(BN("1001"));
      expect(position2.protocolsId).to.deep.equal([BN(0)]); // deep equal because array is different, BN values are the same
    });
  });
  /**
   *
   * NOW we go further in time to check datas
   *
   */
  describe("ATEN LP & Staking amounts ", () => {
    it("Should get LP amount", async function () {
      const lp = await STAKED_ATENS_CONTRACT.connect(user).balanceOf(
        await user.getAddress()
      );
      expect(lp).to.equal(BN(100000));
      const lp2 = await STAKED_ATENS_CONTRACT.connect(user2).balanceOf(
        await user2.getAddress()
      );
      expect(lp2).to.equal(BN(9000000));
    });
    it("Should view rewards amount", async function () {
      increaseTimeAndMine(3600 * 24 * 365);
      const rewards = await STAKED_ATENS_CONTRACT.connect(user).rewardsOf(
        userAddress
      );
      const rewards2 = await STAKED_ATENS_CONTRACT.connect(user2).rewardsOf(
        await user2.getAddress()
      );
      // user1 deposited 10000 USD so reward is 1200 rate & deposited 100000 ATENS
      expect(rewards[0]).to.equal(
        BN(parseInt(((100000 * 12) / 100).toString()))
      );

      expect(rewards[1].toString()).to.equal("1200");
      expect(rewards2[0]).to.equal(
        BN(parseInt(((9000000 * 10) / 100).toString()))
      );
      expect(rewards2[1].toString()).to.equal("1000"); // user2 deposited 1001 USD so reward is 1000
    });
    it("Should withdraw ATEN with rewards", async () => {
      const balanceBefore = await ATEN_TOKEN_CONTRACT.connect(user).balanceOf(
        userAddress
      );
      await expect(
        ATHENA_CONTRACT.connect(user).withdrawAtens(1000001)
      ).to.be.rejectedWith("Invalid amount");
      const tx = await ATHENA_CONTRACT.connect(user).withdrawAtens(100000);
      expect(tx).to.haveOwnProperty("hash");
      const balance = await ATEN_TOKEN_CONTRACT.connect(user).balanceOf(
        userAddress
      );
      expect(balance.sub(balanceBefore).toNumber()).to.be.greaterThan(
        ((100000 * 12) / 100 + 100000) * 0.99
      );
      expect(balance.sub(balanceBefore).toNumber()).to.be.lessThan(
        ((100000 * 12) / 100 + 100000) * 1.01
      );
    });
  });

  describe("USD Premium rewards", () => {
    it("Should get 0 premium rewards", async function () {});
    it("Should Take Premium on 1 year protocol 0", async function () {
      //user already approved Contract to provide funds
      const PROTOCOL_ID = 1;
      const tx = await ATHENA_CONTRACT.connect(user).buyPolicy(
        10000,
        0,
        PROTOCOL_ID
      );
      expect(tx).to.haveOwnProperty("hash");
      const balance = await POLICY_CONTRACT.balanceOf(userAddress);
      expect(balance).to.equal(BN(1));
      const tokenId = await POLICY_CONTRACT.tokenOfOwnerByIndex(userAddress, 0);
      expect(tokenId).to.equal(BN(0));
      const policy = await POLICY_CONTRACT.policies(tokenId);
      expect(policy.amountGuaranteed).to.equal(BN(10000));
      expect(policy.protocolId).to.equal(BN(PROTOCOL_ID));
      const protocol = await ATHENA_CONTRACT.connect(user).protocolsMapping(
        PROTOCOL_ID
      );
      const protocolContract = new ethers.Contract(
        protocol.deployed,
        protocolPoolAbi.abi,
        user
      );
      expect(await protocolContract.balanceOf(userAddress)).to.not.equal(BN(0));
      expect(await protocolContract.symbol()).to.equal("APP_" + PROTOCOL_ID);
      const balanceProtocol = await USDT_TOKEN_CONTRACT.connect(user).balanceOf(
        protocol.deployed
      );
      expect(balanceProtocol).to.equal(BN(10000));
    });
    it.skip("Should get X premium rewards now with protocol 0", async function () {});
    it("Should withdraw everything and get AAVE rewards", async function () {
      await ATHENA_CONTRACT.withdrawAll();
    });
  });

  //await ATHENA_CONTRACT.balanceOf(signerAddress)).to.be.true;
});
