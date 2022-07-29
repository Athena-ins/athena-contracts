import chai, { expect } from "chai";
import hre, { ethers } from "hardhat";
import { BigNumber, ethers as originalEthers } from "ethers";
import { ethers as ethersOriginal, utils } from "ethers";
import weth_abi from "../abis/weth.json";
import atoken_abi from "../abis/AToken.json";
import chaiAsPromised from "chai-as-promised";
import { getATokenBalance, increaseTimeAndMine } from "./helpers";
import protocolPoolAbi from "../artifacts/contracts/ProtocolPool.sol/ProtocolPool.json";

chai.use(chaiAsPromised);

const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const ATEN_OWNER_ADDRESS = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
const USDT_AAVE_ATOKEN = "0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811";
const USDT_Wrong = "0xdac17f958d2ee523a2206206994597c13d831ec8"; //USDT
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const AAVE_LENDING_POOL = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
const AAVE_REGISTRY = "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5";
const NULL_ADDRESS = "0x" + "0".repeat(40);
const ARBITRATOR_ADDRESS = "0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069";
const STAKING_TOKEN = USDT;

const USDT_TOKEN_CONTRACT = new ethers.Contract(USDT, weth_abi);

const STAKING_TOKEN_CONTRACT = new ethers.Contract(
  ATEN_TOKEN,
  weth_abi
).connect(ethers.provider.getSigner());

let owner: originalEthers.Signer,
  user: originalEthers.Signer,
  user2: originalEthers.Signer,
  user3: originalEthers.Signer,
  ownerAddress: string,
  userAddress: string,
  ATHENA_CONTRACT: ethersOriginal.Contract,
  POS_CONTRACT: ethersOriginal.Contract,
  STAKED_ATENS_CONTRACT: ethersOriginal.Contract,
  FACTORY_PROTOCOL_CONTRACT: ethersOriginal.Contract,
  CLAIM_MANAGER_CONTRACT: ethersOriginal.Contract,
  // AAVELP_CONTRACT: ethersOriginal.Contract,
  ATEN_TOKEN_CONTRACT: ethersOriginal.Contract,
  POLICY_CONTRACT: ethersOriginal.Contract,
  allSigners: originalEthers.Signer[];

const BN = (num: string | number) => ethers.BigNumber.from(num);

const ETH_ARBITRATION_COST = ethers.utils.parseEther("0.075");

describe("Claim Manager", function () {
  const ETH_VALUE = "5000";
  let DATE_NOW: number;

  before(async () => {
    allSigners = await ethers.getSigners();
    owner = allSigners[0];
    user = allSigners[1];
    user2 = allSigners[2];
    user3 = allSigners[3];
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

    const factoryProtocol = await ethers.getContractFactory("ProtocolFactory");
    FACTORY_PROTOCOL_CONTRACT = await factoryProtocol
      .connect(owner)
      .deploy(ATHENA_CONTRACT.address, 14 * 24 * 60 * 60);
    await FACTORY_PROTOCOL_CONTRACT.deployed();
    expect(
      await ethers.provider.getCode(FACTORY_PROTOCOL_CONTRACT.address)
    ).to.not.equal("0x");

    // const wrappedAAVE = await ethers.getContractFactory("AAVELPToken");
    // //AAVE USDT ATOKEN ?
    // AAVELP_CONTRACT = await wrappedAAVE
    //   .connect(owner)
    //   .deploy(AUSDT_TOKEN, ATHENA_CONTRACT.address);
    // await AAVELP_CONTRACT.deployed();
    // expect(await ethers.provider.getCode(AAVELP_CONTRACT.address)).to.not.equal(
    //   "0x"
    // );

    /** Policy Manager */
    const factoryPolicy = await ethers.getContractFactory("PolicyManager");
    POLICY_CONTRACT = await factoryPolicy
      .connect(owner)
      .deploy(ATHENA_CONTRACT.address);
    await POLICY_CONTRACT.deployed();
    expect(await ethers.provider.getCode(POLICY_CONTRACT.address)).to.not.equal(
      "0x"
    );

    /** Claim Manager */

    const claimManager = await ethers.getContractFactory("ClaimManager");
    CLAIM_MANAGER_CONTRACT = await claimManager
      .connect(owner)
      .deploy(ATHENA_CONTRACT.address, ARBITRATOR_ADDRESS);
    await CLAIM_MANAGER_CONTRACT.deployed();
    expect(
      await ethers.provider.getCode(CLAIM_MANAGER_CONTRACT.address)
    ).to.not.equal("0x");
  });

  it("Should initialize Protocol", async () => {
    /**
     * Initialize protocol with required values
     */
    const init = await ATHENA_CONTRACT.initialize(
      POS_CONTRACT.address,
      STAKED_ATENS_CONTRACT.address,
      POLICY_CONTRACT.address,
      USDT_AAVE_ATOKEN,
      FACTORY_PROTOCOL_CONTRACT.address,
      ARBITRATOR_ADDRESS,
      CLAIM_MANAGER_CONTRACT.address
      // AAVELP_CONTRACT.address
    );
    await init.wait();
    expect(init).to.haveOwnProperty("hash");
  });

  it("Should prepare balances ", async () => {
    //BINANCE WALLET 1Md2 USDT 0xF977814e90dA44bFA03b6295A0616a897441aceC
    const BINANCE_SIGNER = "0xf977814e90da44bfa03b6295a0616a897441acec";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [BINANCE_SIGNER],
    });
    const binanceSigner = await ethers.getSigner(BINANCE_SIGNER);

    for (let index = 0; index < 5; index++) {
      const userLocal = allSigners[index];
      await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
        userLocal.getAddress(),
        ethers.utils.parseUnits("100000", 6)
      );
      expect(
        await USDT_TOKEN_CONTRACT.connect(user).balanceOf(
          userLocal.getAddress()
        )
      ).to.be.not.equal(BigNumber.from("0"));
    }

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

    for (let index = 0; index < 5; index++) {
      const userLocal = allSigners[index];
      await ATEN_TOKEN_CONTRACT.transfer(
        userLocal.getAddress(),
        ethers.utils.parseEther("10000000")
      );
      await ATEN_TOKEN_CONTRACT.connect(userLocal).approve(
        STAKED_ATENS_CONTRACT.address,
        ethers.utils.parseEther("10000000")
      );
      await USDT_TOKEN_CONTRACT.connect(userLocal).approve(
        ATHENA_CONTRACT.address,
        ethers.utils.parseEther("10000000")
      );
    }
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

  it("Should success deposit funds user 1", async function () {
    const tx = await ATHENA_CONTRACT.connect(allSigners[1]).deposit(
      10000,
      0,
      [0],
      [10000]
    );
    expect(tx).to.haveOwnProperty("hash");
  });

  it("Fail to claim because no Policy", async function () {
    await expect(
      ATHENA_CONTRACT.connect(allSigners[2]).startClaim(0, 0, 1000, {
        value: ETH_ARBITRATION_COST,
      })
    ).to.eventually.be.rejectedWith("No Active Policy");
  });

  it("Should buy Policy", async function () {
    const PROTOCOL_ID = 0;
    const tx = await ATHENA_CONTRACT.connect(allSigners[2]).buyPolicy(
      10000,
      1000,
      0,
      PROTOCOL_ID
    );
    expect(tx).to.haveOwnProperty("hash");
  });
  it("Fail to claim because wrong Policy Id", async function () {
    await expect(
      ATHENA_CONTRACT.connect(allSigners[2]).startClaim(1, 0, 1000, {
        value: ETH_ARBITRATION_COST,
      })
    ).to.eventually.be.rejectedWith("Wrong Token Id for Policy");
  });
  it("Should get Arbitration Fee", async function () {
    await expect(
      CLAIM_MANAGER_CONTRACT.connect(user).arbitrationCost()
    ).to.eventually.equal(ETH_ARBITRATION_COST);
  });

  // should test claim not possible after policy is expired
  it.skip("Should fail to claim expired Policy", async function () {
    const PROTOCOL_ID = 0;
    const tx = await ATHENA_CONTRACT.connect(allSigners[2]).buyPolicy(
      10000,
      1000,
      0,
      PROTOCOL_ID
    );
    expect(tx).to.haveOwnProperty("hash");
  });

  it.skip("Should buy Policy again", async function () {
    const PROTOCOL_ID = 0;
    const tx = await ATHENA_CONTRACT.connect(allSigners[2]).buyPolicy(
      10000,
      1000,
      0,
      PROTOCOL_ID
    );
    expect(tx).to.haveOwnProperty("hash");
  });

  // should test claim possible
  it("Succeed to claim", async function () {
    await expect(
      ATHENA_CONTRACT.connect(allSigners[2]).startClaim(0, 0, 1000, {
        value: ETH_ARBITRATION_COST,
      })
    ).to.eventually.haveOwnProperty("hash");
    await expect(
      CLAIM_MANAGER_CONTRACT.ownerClaims(allSigners[2].getAddress(), 0)
    ).to.eventually.equal("1");

    expect((await CLAIM_MANAGER_CONTRACT.claims(1)).amount).to.equal("1000");
    await expect(
      CLAIM_MANAGER_CONTRACT.remainingTimeToReclaim(1)
    ).to.eventually.not.equal(0);
  });
  // should test claim again not possible
  it("Fail to claim again", async function () {
    await expect(
      ATHENA_CONTRACT.connect(allSigners[2]).startClaim(0, 0, 1000, {
        value: ETH_ARBITRATION_COST,
      })
    ).to.eventually.be.rejectedWith("Already claiming");
  });

  it("Fail to release funds before delay", async function () {
    await expect(
      CLAIM_MANAGER_CONTRACT.connect(allSigners[2]).releaseFunds(1)
    ).to.eventually.be.rejectedWith("Delay is not over");
  });
  // should test lock funds in protocol
  it("Should fail to withdraw funds on Protocol", async function () {
    await expect(
      ATHENA_CONTRACT.connect(allSigners[1]).withdrawAll()
    ).to.eventually.be.rejectedWith("Protocol locked");
  });

  // should try challenge but too late
  it("Should fail to challenge", async function () {
    await expect(
      CLAIM_MANAGER_CONTRACT.connect(allSigners[1]).challenge(1)
    ).to.eventually.be.rejectedWith("Not enough ETH for challenge");

    increaseTimeAndMine(60 * 60 * 24 * 21);
    await expect(
      CLAIM_MANAGER_CONTRACT.connect(allSigners[1]).challenge(1, {
        value: ETH_ARBITRATION_COST.mul(3),
      })
    ).to.eventually.be.rejectedWith("Challenge delay passed");
  });

  // should test no challenge, after period, claim funds
  it("Should resolve claim after no challenge period", async function () {
    await expect(
      CLAIM_MANAGER_CONTRACT.remainingTimeToReclaim(1)
    ).to.eventually.equal(0);
    const balBefore = await USDT_TOKEN_CONTRACT.connect(user).balanceOf(
      allSigners[2].getAddress()
    );
    console.log("Account to receive : ", await allSigners[2].getAddress());
    console.log("Balance before : ", balBefore.toString());

    await expect(
      ATHENA_CONTRACT.connect(user).resolveClaim(1, 1, USDT)
    ).to.eventually.be.rejectedWith("Only Claim Manager can resolve claims");
    await CLAIM_MANAGER_CONTRACT.connect(allSigners[2]).releaseFunds(1);
    const balAfter = await USDT_TOKEN_CONTRACT.connect(user).balanceOf(
      allSigners[2].getAddress()
    );
    console.log("Balance after : ", balAfter.toString());
    expect(balAfter.sub(balBefore)).to.equal("1000");
  });
  // should test claim possible

  // should test challenge, dispute resolution Kleros is refused, cancel policy ?

  // should test challenge, dispute resolution Kleros is accepted, refund Cover ?

  // should test challenge, refuse to arbitrate, WHAT SHOULD BE DONE ?

  // Appeal ??

  /// ATEN TESTS
  // should get repayed with Atens after 1 year at 100% APY
});
