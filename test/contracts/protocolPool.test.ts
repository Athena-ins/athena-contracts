import chai, { expect } from "chai";
import hre, { ethers } from "hardhat";
import { BigNumber, ethers as originalEthers } from "ethers";
import { ethers as ethersOriginal, utils } from "ethers";
import weth_abi from "../../abis/weth.json";
import atoken_abi from "../../abis/AToken.json";
import chaiAsPromised from "chai-as-promised";
import HardhatHelper from "../helpers/hardhat";
import protocolPoolAbi from "../../artifacts/contracts/ProtocolPool.sol/ProtocolPool.json";
import ProtocolHelper from "../helpers/protocol";

chai.use(chaiAsPromised);

const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const ATEN_OWNER_ADDRESS = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
const USDT_AAVE_ATOKEN = "0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const AAVE_LENDING_POOL = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
const AAVE_REGISTRY = "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5";
const NULL_ADDRESS = "0x" + "0".repeat(40);
const ARBITRATOR_ADDRESS = "0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069";

const USDT_TOKEN_CONTRACT = new ethers.Contract(USDT, weth_abi);

let owner: originalEthers.Signer,
  user1: originalEthers.Signer,
  user2: originalEthers.Signer,
  user3: originalEthers.Signer,
  ATHENA_CONTRACT: ethersOriginal.Contract,
  POS_CONTRACT: ethersOriginal.Contract,
  STAKED_ATENS_CONTRACT: ethersOriginal.Contract,
  FACTORY_PROTOCOL_CONTRACT: ethersOriginal.Contract,
  ATEN_TOKEN_CONTRACT: ethersOriginal.Contract,
  POLICY_CONTRACT: ethersOriginal.Contract,
  allSigners: originalEthers.Signer[];

const BN = (num: string | number) => ethers.BigNumber.from(num);

export function testProtocolPool() {
  describe("Protocol Pool", function () {
    let DATE_NOW: number;

    before(async function () {
      allSigners = await ethers.getSigners();
      owner = allSigners[0];
      user1 = allSigners[1];
      user2 = allSigners[2];
      user3 = allSigners[3];

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

    describe("Should deploy contracts", async function () {
      it("Should deploy Athena contract", async function () {
        const factory = await ethers.getContractFactory("Athena");
        ATHENA_CONTRACT = await factory
          .connect(owner)
          .deploy(ATEN_TOKEN, AAVE_REGISTRY);

        await ATHENA_CONTRACT.deployed();

        expect(await ethers.provider.getCode("0x" + "0".repeat(40))).to.equal(
          "0x",
        );

        expect(
          await ethers.provider.getCode(ATHENA_CONTRACT.address),
        ).to.not.equal("0x");
      });

      it("Should deploy ProtocolFactory contract", async function () {
        const factoryProtocol =
          await ethers.getContractFactory("ProtocolFactory");
        FACTORY_PROTOCOL_CONTRACT = await factoryProtocol
          .connect(owner)
          .deploy(ATHENA_CONTRACT.address);
        await FACTORY_PROTOCOL_CONTRACT.deployed();
        expect(
          await ethers.provider.getCode(FACTORY_PROTOCOL_CONTRACT.address),
        ).to.not.equal("0x");
      });

      it("Should deploy PositionsManager contract", async function () {
        const factoryPos = await ethers.getContractFactory("PositionsManager");
        POS_CONTRACT = await factoryPos
          .connect(owner)
          .deploy(ATHENA_CONTRACT.address, FACTORY_PROTOCOL_CONTRACT.address);
        await POS_CONTRACT.deployed();
        expect(
          await ethers.provider.getCode(POS_CONTRACT.address),
        ).to.not.equal("0x");
      });

      it("Should deploy StakingGeneralPool contract", async function () {
        const factoryStakedAtens =
          await ethers.getContractFactory("StakingGeneralPool");
        STAKED_ATENS_CONTRACT = await factoryStakedAtens
          .connect(owner)
          .deploy(ATEN_TOKEN, ATHENA_CONTRACT.address, POS_CONTRACT.address);
        await STAKED_ATENS_CONTRACT.deployed();
        expect(
          await ethers.provider.getCode(STAKED_ATENS_CONTRACT.address),
        ).to.not.equal("0x");
      });

      it("Should deploy PolicyManager contract", async function () {
        const factoryPolicy = await ethers.getContractFactory("PolicyManager");
        POLICY_CONTRACT = await factoryPolicy
          .connect(owner)
          .deploy(ATHENA_CONTRACT.address, FACTORY_PROTOCOL_CONTRACT.address);
        await POLICY_CONTRACT.deployed();
        expect(
          await ethers.provider.getCode(POLICY_CONTRACT.address),
        ).to.not.equal("0x");
      });
    });

    describe("Initialize Protocol", async function () {
      it("Should initialize protocol with required values", async function () {
        const init = await ATHENA_CONTRACT.initialize(
          // @bw bad ordering
          POS_CONTRACT.address,
          POLICY_CONTRACT.address,
          STAKED_ATENS_CONTRACT.address,
          USDT_AAVE_ATOKEN,
          FACTORY_PROTOCOL_CONTRACT.address,
          ARBITRATOR_ADDRESS,
          NULL_ADDRESS,
        );

        await init.wait();
        expect(init).to.haveOwnProperty("hash");
      });
    });

    describe("Set new active protocol", async function () {
      it("Should set new active Protocol 0", async function () {
        const tx = await ATHENA_CONTRACT.addNewProtocol(
          USDT,
          "Test protocol 0",
          30,
          [],
          "bafybeiafebm3zdtzmn5mcquacgd47enhsjnebvegnzfunbbbbbbbbbbbbb",
        );
        expect(tx).to.haveOwnProperty("hash");

        const prot = await ATHENA_CONTRACT.protocolsMapping(0);
        expect(prot.name).to.equal("Test protocol 0");
      });

      it("Should set new active Protocol 1", async function () {
        const tx = await ATHENA_CONTRACT.addNewProtocol(
          "Test protocol 1",
          30,
          [],
          "bafybeiafebm3zdtzmn5mcquacgd47enhsjnebvegnzfunbbbbbbbbbbbbb",
        );
        expect(tx).to.haveOwnProperty("hash");

        const prot = await ATHENA_CONTRACT.protocolsMapping(1);
        expect(prot.name).to.equal("Test protocol 1");

        expect(await ATHENA_CONTRACT.incompatibilityProtocols(1, 0)).to.be
          .false;
        expect(await ATHENA_CONTRACT.incompatibilityProtocols(0, 1)).to.be
          .false;
      });

      it("Should set new active Protocol 2 not compatible with 0", async function () {
        const tx = await ATHENA_CONTRACT.addNewProtocol(
          "Test protocol 2",
          30,
          [0],
          "bafybeiafebm3zdtzmn5mcquacgd47enhsjnebvegnzfunbbbbbbbbbbbbb",
        );
        expect(tx).to.haveOwnProperty("hash");

        const prot = await ATHENA_CONTRACT.protocolsMapping(2);
        expect(prot.name).to.equal("Test protocol 2");

        expect(await ATHENA_CONTRACT.incompatibilityProtocols(2, 0)).to.be.true;
        // expect(await ATHENA_CONTRACT.incompatibilityProtocols(0, 2)).to.be.true;
      });
    });

    describe("Set discounts with Aten", async function () {
      it("Should set discounts with Aten", async function () {
        const tx = await ATHENA_CONTRACT.connect(owner).setFeeLevelsWithAten([
          [0, 250],
          [1_000, 200],
          [100_000, 150],
          [1_000_000, 50],
        ]);
        expect(tx).to.haveOwnProperty("hash");

        const discountZero =
          await ATHENA_CONTRACT.connect(owner).supplyFeeLevels(0);
        expect(discountZero.atenAmount).to.equal(BN(0));
        expect(discountZero.feeRate).to.equal(BN(250));

        const discountFirst =
          await ATHENA_CONTRACT.connect(owner).supplyFeeLevels(1);
        expect(discountFirst.atenAmount).to.equal(BN(1_000));
        expect(discountFirst.feeRate).to.equal(BN(200));

        const discountSnd =
          await ATHENA_CONTRACT.connect(owner).supplyFeeLevels(2);
        expect(discountSnd.atenAmount).to.equal(BN(100_000));
        expect(discountSnd.feeRate).to.equal(BN(150));

        const discountThird =
          await ATHENA_CONTRACT.connect(owner).supplyFeeLevels(3);
        expect(discountThird.atenAmount).to.equal(BN(1_000_000));
        expect(discountThird.feeRate).to.equal(BN(50));

        await expect(
          ATHENA_CONTRACT.connect(owner).supplyFeeLevels(4),
        ).to.be.rejectedWith();
      });

      it("Should get discount amount with Aten", async function () {
        expect(
          await ATHENA_CONTRACT.connect(user1).getFeeRateWithAten(999),
        ).to.equal(0);
        expect(
          await ATHENA_CONTRACT.connect(user1).getFeeRateWithAten(1000),
        ).to.equal(200);
        expect(
          await ATHENA_CONTRACT.connect(user1).getFeeRateWithAten(10000000),
        ).to.equal(50);
      });

      it("Should set reward Rates ATEN with USD", async function () {
        await expect(
          ATHENA_CONTRACT.connect(owner).setStakingRewardRates([
            [0, 1_000],
            [10_000, 1_200],
            [1_000_000, 2_000],
            [100_000, 1_600],
          ]),
        ).to.be.rejectedWith("SA: Sort in ascending order");
        const tx = await ATHENA_CONTRACT.connect(owner).setStakingRewardRates([
          [0, 1_000],
          [10_000, 1_200],
          [100_000, 1_600],
          [1_000_000, 2_000],
        ]);
        expect(tx).to.haveOwnProperty("hash");
        const discountFirst =
          await STAKED_ATENS_CONTRACT.connect(owner).getStakingRewardRate(0);
        expect(discountFirst).to.equal(BN(0));
        expect(
          await STAKED_ATENS_CONTRACT.connect(owner).getStakingRewardRate(10),
        ).to.equal(BN(1000));
        expect(
          await STAKED_ATENS_CONTRACT.connect(owner).getStakingRewardRate(
            "10000",
          ),
        ).to.equal(BN(1200));
        expect(
          await STAKED_ATENS_CONTRACT.connect(owner).getStakingRewardRate(
            "100001",
          ),
        ).to.equal(BN(1600));
        expect(
          await STAKED_ATENS_CONTRACT.connect(owner).getStakingRewardRate(
            1000000,
          ),
        ).to.equal(BN(2000));
      });
    });

    describe("Prepare balances ", async function () {
      it("Should prepare balances for USDT", async function () {
        //BINANCE WALLET 1Md2 USDT 0xF977814e90dA44bFA03b6295A0616a897441aceC
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: ["0xf977814e90da44bfa03b6295a0616a897441acec"],
        });

        const binanceSigner = await ethers.getSigner(
          "0xF977814e90dA44bFA03b6295A0616a897441aceC",
        );

        await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
          await user1.getAddress(),
          ethers.utils.parseUnits("100000", 6),
        );

        expect(
          await USDT_TOKEN_CONTRACT.connect(user1).balanceOf(
            await user1.getAddress(),
          ),
        ).to.be.not.equal(BigNumber.from("0"));

        await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
          await user2.getAddress(),
          ethers.utils.parseUnits("100000", 6),
        );

        expect(
          await USDT_TOKEN_CONTRACT.connect(user2).balanceOf(
            await user2.getAddress(),
          ),
        ).to.equal(ethers.utils.parseUnits("100000", 6));

        await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
          await user3.getAddress(),
          ethers.utils.parseUnits("100000", 6),
        );

        expect(
          await USDT_TOKEN_CONTRACT.connect(user3).balanceOf(
            await user3.getAddress(),
          ),
        ).to.equal(ethers.utils.parseUnits("100000", 6));
      });

      it("Should prepare balances for ATEN", async function () {
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [ATEN_OWNER_ADDRESS],
        });

        const atenOwnerSigner = await ethers.getSigner(ATEN_OWNER_ADDRESS);
        const ATEN_TOKEN_CONTRACT = new ethers.Contract(
          ATEN_TOKEN,
          weth_abi,
          atenOwnerSigner,
        );

        await ATEN_TOKEN_CONTRACT.transfer(
          await user1.getAddress(),
          ethers.utils.parseEther("10000000"),
        );

        await ATEN_TOKEN_CONTRACT.transfer(
          await user2.getAddress(),
          ethers.utils.parseEther("10000000"),
        );

        await ATEN_TOKEN_CONTRACT.transfer(
          await user3.getAddress(),
          ethers.utils.parseEther("10000000"),
        );

        await ATEN_TOKEN_CONTRACT.connect(user1).approve(
          STAKED_ATENS_CONTRACT.address,
          ethers.utils.parseEther("10000000"),
        );

        await ATEN_TOKEN_CONTRACT.connect(user2).approve(
          STAKED_ATENS_CONTRACT.address,
          ethers.utils.parseEther("10000000"),
        );

        await ATEN_TOKEN_CONTRACT.connect(user3).approve(
          STAKED_ATENS_CONTRACT.address,
          ethers.utils.parseEther("10000000"),
        );
      });
    });

    describe("Deposit funds", function () {
      it("Should approve funds", async function () {
        //Approve before sending !
        const approved = await new ethers.Contract(
          USDT,
          weth_abi,
          user1,
        ).approve(ATHENA_CONTRACT.address, utils.parseEther("100000000000"));
        await approved.wait();
        expect(approved).to.haveOwnProperty("hash");
      });

      it("Should success deposit funds user1", async function () {
        const tx = await ATHENA_CONTRACT.connect(user1).deposit(
          10000,
          100000,
          [0, 1],
          [10000, 10000],
        );
        expect(tx).to.haveOwnProperty("hash");

        // we check AAVE aToken balance
        expect(
          (await HardhatHelper.getATokenBalance(user1)).toNumber(),
        ).to.be.greaterThanOrEqual(9999);
      });

      it("Should success deposit funds user2", async function () {
        const approved2 = await new ethers.Contract(
          USDT,
          weth_abi,
          user2,
        ).approve(ATHENA_CONTRACT.address, utils.parseEther("100000000000"));
        await approved2.wait();
        const tx2 = await ATHENA_CONTRACT.connect(user2).deposit(
          1001,
          9000000,
          [0],
          [1001],
        );
        expect(tx2).to.haveOwnProperty("hash");
      });

      it("Should check funds and NFT", async function () {
        // Now its not USDT on contract anymore but AAVE LP !
        const balAtoken = (
          await HardhatHelper.getATokenBalance(user1)
        ).toNumber();

        expect(balAtoken).to.be.greaterThanOrEqual(11000);
        expect(balAtoken).to.be.lessThanOrEqual(11002);

        const balNFT = await POS_CONTRACT.balanceOf(await user1.getAddress());
        const userNFTindex = await POS_CONTRACT.tokenOfOwnerByIndex(
          await user1.getAddress(),
          0,
        );
        const userNFTindex2 = await POS_CONTRACT.tokenOfOwnerByIndex(
          user2.getAddress(),
          0,
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

    describe("USD Premium rewards", function () {
      it("Should buy Policy on 1 year protocol 0", async function () {
        //user already approved Contract to provide funds
        const PROTOCOL_ID = 0;

        const protocol =
          await ATHENA_CONTRACT.connect(user1).protocolsMapping(PROTOCOL_ID);

        const protocolContract = new ethers.Contract(
          protocol.deployed,
          protocolPoolAbi.abi,
          user1,
        );

        let __slot0 = await protocolContract.actualizingUntilGivenDate(
          Number.parseInt(((Date.now() + 1000) / 1000).toString()) + 10000,
        );
        console.log(
          "Should buy Policy on 1 year protocol 0 >>> __slot0:",
          __slot0,
        );

        const tx = await ATHENA_CONTRACT.connect(user1).buyPolicy(
          10000,
          1000,
          0,
          PROTOCOL_ID,
        );

        __slot0 = await protocolContract.actualizingUntilGivenDate(
          Number.parseInt(((Date.now() + 1000) / 1000).toString()) + 10000,
        );
        console.log(
          "Should buy Policy on 1 year protocol 0 >>> __slot0:",
          __slot0,
        );

        expect(tx).to.haveOwnProperty("hash");

        const balance = await POLICY_CONTRACT.balanceOf(
          await user1.getAddress(),
        );
        expect(balance).to.equal(BN(1));

        const tokenId = await POLICY_CONTRACT.tokenOfOwnerByIndex(
          await user1.getAddress(),
          0,
        );
        expect(tokenId).to.equal(BN(0));

        const policy = await POLICY_CONTRACT.policies(tokenId);
        expect(policy.liquidity).to.equal(BN(10000));
        expect(policy.poolId).to.equal(BN(PROTOCOL_ID));

        expect(
          await protocolContract.balanceOf(await user1.getAddress()),
        ).to.not.equal(BN(0));
        expect(
          (await protocolContract.id()).toString() === PROTOCOL_ID.toString(),
        ).to.equal(true);

        const balanceProtocol = await USDT_TOKEN_CONTRACT.connect(
          user1,
        ).balanceOf(protocol.deployed);
        expect(balanceProtocol).to.equal(BN(1000));

        const coverId = await ProtocolHelper.getAccountCoverIdByIndex(user1, 0);
        const userInfo = await protocolContract.getInfo(coverId);

        console.log(
          "Should buy Policy on 1 year protocol 0 >>> user1_Info0:",
          userInfo,
        );
      });

      it("Should withdraw everything and get AAVE rewards", async function () {
        const PROTOCOL_ID = 0;

        const protocol =
          await ATHENA_CONTRACT.connect(user1).protocolsMapping(PROTOCOL_ID);

        const protocolContract = new ethers.Contract(
          protocol.deployed,
          protocolPoolAbi.abi,
          user1,
        );

        const AtokenContract = new ethers.Contract(
          USDT_AAVE_ATOKEN,
          atoken_abi,
          user2,
        );

        /**
         * deposit from new user to get rewards but not as much as user1
         */

        await USDT_TOKEN_CONTRACT.connect(user3).approve(
          ATHENA_CONTRACT.address,
          1000000,
        );

        const capitalDeposit = 1000;

        const tx3 = await ATHENA_CONTRACT.connect(user3).deposit(
          capitalDeposit,
          9000000,
          [PROTOCOL_ID],
          [capitalDeposit],
        );
        await tx3.wait();
        expect(tx3).to.haveOwnProperty("hash");

        let __slot0 = await protocolContract.actualizingUntilGivenDate(
          Number.parseInt(((Date.now() + 1000) / 1000).toString()) + 10000,
        );
        console.log(
          "Should withdraw everything and get AAVE rewards >>> __slot0:",
          __slot0,
        );

        const coverId = await ProtocolHelper.getAccountCoverIdByIndex(user1, 0);
        const userInfo = await protocolContract.getInfo(coverId);

        console.log(
          "Should withdraw everything and get AAVE rewards >>> user1_Info1:",
          userInfo,
        );
        // We already went 1 year into future, so user 3 should get half rewards 1 year from now
        await HardhatHelper.setNextBlockTimestamp(365 * 24 * 60 * 60);

        const userInfoAfter = await protocolContract.getInfo(coverId);

        console.log(
          "Should withdraw everything and get AAVE rewards >>> user1_Info2:",
          userInfoAfter,
        );

        expect(
          await protocolContract.balanceOf(user3.getAddress()),
        ).to.not.equal(BN(0));
        expect(
          (await protocolContract.id()).toString() === PROTOCOL_ID.toString(),
        ).to.equal(true);

        const rewardsUser3 = await protocolContract
          .connect(user3)
          .rewardsOf(user3.getAddress(), capitalDeposit, 0);

        console.log(
          "Should withdraw everything and get AAVE rewards >>> rewardsUser3:",
          rewardsUser3.toString(),
        );

        expect(rewardsUser3.gte(0)).to.be.true;

        await ATHENA_CONTRACT.connect(user3).committingWithdrawAll();
        await expect(
          ATHENA_CONTRACT.connect(user3).withdrawAll(),
        ).to.eventually.rejectedWith("withdraw reserve");

        await ATHENA_CONTRACT.connect(user1).committingWithdrawAll();
        await ATHENA_CONTRACT.connect(user2).committingWithdrawAll();

        await HardhatHelper.setNextBlockTimestamp(20 * 24 * 60 * 60);

        const balBefore3 = await USDT_TOKEN_CONTRACT.connect(user1).balanceOf(
          user3.getAddress(),
        );
        await ATHENA_CONTRACT.connect(user3).withdrawAll();
        const balAfter3 = await USDT_TOKEN_CONTRACT.connect(user1).balanceOf(
          user3.getAddress(),
        );
        console.log(
          "Should withdraw everything and get AAVE rewards >>> Diff Balance withdraw end user 3: ",
          balAfter3.sub(balBefore3).toNumber(),
        );

        expect(balAfter3.sub(balBefore3).toNumber()).to.be.greaterThanOrEqual(
          capitalDeposit,
        );

        /**
         * User 2 view rewards then withdraw
         */

        expect(
          await protocolContract.balanceOf(user2.getAddress()),
        ).to.not.equal(BN(0));
        expect((await protocolContract.id()).toString() === "0").to.equal(true);

        const userNFTindex2 = await POS_CONTRACT.tokenOfOwnerByIndex(
          user2.getAddress(),
          0,
        );

        const nftUser2 = await POS_CONTRACT.positions(userNFTindex2);
        console.log("User 2 end position : ", nftUser2);

        const rewardsUser2 = await protocolContract
          .connect(user2)
          .rewardsOf(user2.getAddress(), nftUser2.liquidity, 0);
        console.log("Rewards user 2 : ", rewardsUser2.toString());

        expect(rewardsUser2.toNumber()).to.be.greaterThanOrEqual(1);
        const balBefore = await USDT_TOKEN_CONTRACT.connect(user2).balanceOf(
          user2.getAddress(),
        );

        await expect(
          ATHENA_CONTRACT.connect(user2).withdrawAll(),
        ).to.eventually.rejectedWith("use rate > 100%");

        const balAfter = await USDT_TOKEN_CONTRACT.connect(user2).balanceOf(
          user2.getAddress(),
        );
        console.log(
          "Diff Balance withdraw end user 2 : ",
          balAfter.sub(balBefore).toNumber(),
        );

        // expect(balAfter.sub(balBefore).toNumber()).to.be.equal(0);

        /**
         * Again for user 1 :
         */

        const balBefore1 = await USDT_TOKEN_CONTRACT.connect(user1).balanceOf(
          user1.getAddress(),
        );
        await expect(
          ATHENA_CONTRACT.connect(user1).withdrawAll(),
        ).to.eventually.rejectedWith("use rate > 100%");

        const balAfter1 = await USDT_TOKEN_CONTRACT.connect(user1).balanceOf(
          user1.getAddress(),
        );

        console.log(
          "Diff Balance withdraw end user 1 : ",
          balAfter1.sub(balBefore1).toNumber(),
        );

        // Expect deposit 10000 + premium 1000 (only share) + rewards from AAVE unkown but > 0
        // expect(balAfter1.sub(balBefore1).toNumber()).to.be.greaterThan(11001);

        // expect(balAfter1.sub(balBefore1).toNumber()).to.be.greaterThan(0);

        // const atokenBalAfter1 = await AtokenContract.scaledBalanceOf(
        //   ATHENA_CONTRACT.address
        // );
        // expect(atokenBalAfter1.toNumber()).to.be.lessThanOrEqual(3);

        const treasury = await USDT_TOKEN_CONTRACT.connect(user1).balanceOf(
          ATHENA_CONTRACT.address,
        );
        console.log("Treasury balance : ", treasury.toString());

        // expect(treasury.toNumber()).to.be.greaterThanOrEqual(10);
        // expect(treasury.toNumber()).to.be.lessThanOrEqual(1000);
        // expect Wrapped AAVE burned and USDT back ? With rewards ?
      });
    });

    //await ATHENA_CONTRACT.balanceOf(signerAddress)).to.be.true;
  });
}
