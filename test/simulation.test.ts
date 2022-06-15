import chai, { expect } from "chai";
import hre, { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import weth_abi from "../abis/weth.json";
import chaiAsPromised from "chai-as-promised";
import { getATokenBalance } from "./helpers";
import protocolPoolAbi from "../artifacts/contracts/ProtocolPool.sol/ProtocolPool.json";

chai.use(chaiAsPromised);

const bn = (num: string | number) => hre_ethers.BigNumber.from(num);

const BINANCE_WALLET = "0xF977814e90dA44bFA03b6295A0616a897441aceC"; //1Md2 USDT
const ATEN_OWNER_ADDRESS = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";

const AAVE_LENDING_POOL = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
const AAVE_REGISTRY = "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5";
const NULL_ADDRESS = "0x" + "0".repeat(40);
const ARBITRATOR_ADDRESS = "0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069";

const USDT_AAVE_ATOKEN = "0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

let allSigners: ethers.Signer[],
  owner: ethers.Signer,
  liquidityProvider1: ethers.Signer,
  liquidityProvider2: ethers.Signer,
  liquidityProvider3: ethers.Signer,
  policyTaker1: ethers.Signer,
  policyTaker2: ethers.Signer,
  policyTaker3: ethers.Signer,
  binanceSigner: ethers.Signer,
  atenOwnerSigner: ethers.Signer,
  ATHENA_CONTRACT: ethers.Contract,
  POSITIONS_MANAGER_CONTRACT: ethers.Contract,
  STAKED_ATENS_CONTRACT: ethers.Contract,
  FACTORY_PROTOCOL_CONTRACT: ethers.Contract,
  POLICY_MANAGER_CONTRACT: ethers.Contract,
  USDT_TOKEN_CONTRACT: ethers.Contract,
  ATEN_TOKEN_CONTRACT: ethers.Contract;

const PROTOCOL_ZERO = 0;
let currentTime = 1646220000;
const USDT_AMOUNT = "1000000";
const ATEN_AMOUNT = "10000000";

describe("Simulation", () => {
  before(async () => {
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

    allSigners = await hre_ethers.getSigners();
    owner = allSigners[0];
    liquidityProvider1 = allSigners[1];
    liquidityProvider2 = allSigners[2];
    liquidityProvider3 = allSigners[3];
    policyTaker1 = allSigners[100];
    policyTaker2 = allSigners[101];
    policyTaker3 = allSigners[102];

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [BINANCE_WALLET],
    });

    binanceSigner = await hre_ethers.getSigner(BINANCE_WALLET);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ATEN_OWNER_ADDRESS],
    });

    atenOwnerSigner = await hre_ethers.getSigner(ATEN_OWNER_ADDRESS);

    USDT_TOKEN_CONTRACT = new hre_ethers.Contract(
      USDT,
      weth_abi,
      binanceSigner
    );
    ATEN_TOKEN_CONTRACT = new hre_ethers.Contract(
      ATEN_TOKEN,
      weth_abi,
      atenOwnerSigner
    );
  });

  async function setNextBlockTimestamp(addingTime: number) {
    currentTime += addingTime;
    await hre.network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [currentTime],
    });
  }

  async function getProtocolContract(user: ethers.Signer, protocolId: number) {
    const protocol = await ATHENA_CONTRACT.connect(user).protocolsMapping(
      protocolId
    );

    return new ethers.Contract(protocol.deployed, protocolPoolAbi.abi, user);
  }

  function getSlot0Info(slot0: any) {
    const info = {
      tick: slot0.tick.toString(),
      premiumRate: slot0.premiumRate.toString(),
      emissionRate: slot0.emissionRate.toString(),
      hoursPerTick: slot0.hoursPerTick.toString(),
      totalInsuredCapital: slot0.totalInsuredCapital.toString(),
      availableCapital: slot0.availableCapital.toString(),
      lastUpdateTimestamp: slot0.lastUpdateTimestamp.toString(),
    };

    return info;
  }

  describe("Should prepare Protocol", () => {
    describe("Should deploy all Contracts and initialize Protocol", () => {
      it("Should deploy Athena contract", async () => {
        ATHENA_CONTRACT = await (await hre_ethers.getContractFactory("Athena"))
          .connect(owner)
          .deploy(USDT, ATEN_TOKEN, AAVE_REGISTRY);

        await ATHENA_CONTRACT.deployed();

        expect(
          await hre_ethers.provider.getCode(ATHENA_CONTRACT.address)
        ).to.not.equal("0x");
      });

      it("Should deploy PositionsManager contract", async () => {
        POSITIONS_MANAGER_CONTRACT = await (
          await hre_ethers.getContractFactory("PositionsManager")
        )
          .connect(owner)
          .deploy(ATHENA_CONTRACT.address);

        await POSITIONS_MANAGER_CONTRACT.deployed();

        expect(
          await hre_ethers.provider.getCode(POSITIONS_MANAGER_CONTRACT.address)
        ).to.not.equal("0x");
      });

      it("Should deploy StakedAten contract", async () => {
        STAKED_ATENS_CONTRACT = await (
          await hre_ethers.getContractFactory("StakedAten")
        )
          .connect(owner)
          .deploy(ATEN_TOKEN, ATHENA_CONTRACT.address);

        await STAKED_ATENS_CONTRACT.deployed();

        expect(
          await hre_ethers.provider.getCode(STAKED_ATENS_CONTRACT.address)
        ).to.not.equal("0x");
      });

      it("Should deploy ProtocolFactory contract", async () => {
        FACTORY_PROTOCOL_CONTRACT = await (
          await hre_ethers.getContractFactory("ProtocolFactory")
        )
          .connect(owner)
          .deploy(ATHENA_CONTRACT.address);

        await FACTORY_PROTOCOL_CONTRACT.deployed();

        expect(
          await hre_ethers.provider.getCode(FACTORY_PROTOCOL_CONTRACT.address)
        ).to.not.equal("0x");
      });

      it("Should deploy PolicyManager contract", async () => {
        POLICY_MANAGER_CONTRACT = await (
          await hre_ethers.getContractFactory("PolicyManager")
        )
          .connect(owner)
          .deploy(ATHENA_CONTRACT.address);

        await POLICY_MANAGER_CONTRACT.deployed();

        expect(
          await hre_ethers.provider.getCode(POLICY_MANAGER_CONTRACT.address)
        ).to.not.equal("0x");
      });

      it("Should initialize protocol with required values", async () => {
        const init = await ATHENA_CONTRACT.initialize(
          POSITIONS_MANAGER_CONTRACT.address,
          STAKED_ATENS_CONTRACT.address,
          POLICY_MANAGER_CONTRACT.address,
          USDT_AAVE_ATOKEN,
          FACTORY_PROTOCOL_CONTRACT.address,
          ARBITRATOR_ADDRESS,
          NULL_ADDRESS
        );

        expect(init).to.haveOwnProperty("hash");
      });
    });

    describe("Set new active protocol", () => {
      it("Should set new active Protocol 0", async () => {
        await setNextBlockTimestamp(0 * 24 * 60 * 60);
        const tx = await ATHENA_CONTRACT.addNewProtocol(
          "Test protocol 0",
          0,
          30,
          WETH,
          []
        );

        expect(tx).to.haveOwnProperty("hash");

        const protocol = await ATHENA_CONTRACT.protocolsMapping(0);
        expect(protocol.name).to.equal("Test protocol 0");
      });

      it("Shoud check slot0 in protocol 0", async () => {
        const protocolContract = await getProtocolContract(
          owner,
          PROTOCOL_ZERO
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(0);
        expect(slot0.premiumRate).to.be.equal("1000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("0");
        expect(slot0.hoursPerTick).to.be.equal("24000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.availableCapital).to.be.equal("0");
        expect(slot0.lastUpdateTimestamp).to.be.equal(currentTime);
      });
    });

    describe("Set discounts with Aten", () => {
      it("Should set discounts with Aten", async () => {
        const tx = await ATHENA_CONTRACT.connect(owner).setDiscountWithAten([
          [1000, 200],
          [100000, 150],
          [1000000, 50],
        ]);

        expect(tx).to.haveOwnProperty("hash");

        const discountFirst = await ATHENA_CONTRACT.connect(
          owner
        ).premiumAtenDiscount(0);

        expect(discountFirst.atenAmount).to.equal(bn(1000));
        expect(discountFirst.discount).to.equal(bn(200));

        const discountSnd = await ATHENA_CONTRACT.connect(
          owner
        ).premiumAtenDiscount(1);

        expect(discountSnd.atenAmount).to.equal(bn(100000));
        expect(discountSnd.discount).to.equal(bn(150));

        const discountThird = await ATHENA_CONTRACT.connect(
          owner
        ).premiumAtenDiscount(2);

        expect(discountThird.atenAmount).to.equal(bn(1000000));
        expect(discountThird.discount).to.equal(bn(50));

        await expect(
          ATHENA_CONTRACT.connect(owner).premiumAtenDiscount(3)
        ).to.be.rejectedWith();
      });

      it("Should get discount amount with Aten", async () => {
        expect(
          await ATHENA_CONTRACT.connect(liquidityProvider1).getDiscountWithAten(
            999
          )
        ).to.equal(0);
        expect(
          await ATHENA_CONTRACT.connect(liquidityProvider1).getDiscountWithAten(
            1000
          )
        ).to.equal(200);
        expect(
          await ATHENA_CONTRACT.connect(liquidityProvider1).getDiscountWithAten(
            10000000
          )
        ).to.equal(50);
      });

      it("Should set reward Rates ATEN with USD", async () => {
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
        const discountFirst = await STAKED_ATENS_CONTRACT.connect(
          owner
        ).getRate(0);
        expect(discountFirst).to.equal(bn(0));
        expect(await STAKED_ATENS_CONTRACT.connect(owner).getRate(10)).to.equal(
          bn(1000)
        );
        expect(
          await STAKED_ATENS_CONTRACT.connect(owner).getRate(10000)
        ).to.equal(bn(1200));
        expect(
          await STAKED_ATENS_CONTRACT.connect(owner).getRate(100001)
        ).to.equal(bn(1600));
        expect(
          await STAKED_ATENS_CONTRACT.connect(owner).getRate(1000000)
        ).to.equal(bn(2000));
      });
    });
  });

  describe("Should simulate user actions", () => {
    let atokenBalance = bn(0);
    let totalPremium = bn(0);

    describe("Should do actions of liquidity provider 1", () => {
      const USDT_amount = "400000";
      const ATEN_amount = "100000";
      it("Should prepare USDT balance", async () => {
        expect(
          await USDT_TOKEN_CONTRACT.balanceOf(
            await liquidityProvider1.getAddress()
          )
        ).to.be.equal(0);

        await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
          await liquidityProvider1.getAddress(),
          hre_ethers.utils.parseUnits(USDT_amount, 6)
        );

        expect(
          await USDT_TOKEN_CONTRACT.balanceOf(
            await liquidityProvider1.getAddress()
          )
        ).to.be.equal(hre_ethers.utils.parseUnits(USDT_amount, 6));
      });

      it("Should prepare ATEN balance", async () => {
        expect(
          await ATEN_TOKEN_CONTRACT.balanceOf(
            await liquidityProvider1.getAddress()
          )
        ).to.be.equal(0);

        await ATEN_TOKEN_CONTRACT.connect(atenOwnerSigner).transfer(
          await liquidityProvider1.getAddress(),
          hre_ethers.utils.parseEther(ATEN_amount)
        );

        expect(
          await ATEN_TOKEN_CONTRACT.balanceOf(
            await liquidityProvider1.getAddress()
          )
        ).to.be.equal(hre_ethers.utils.parseEther(ATEN_amount));
      });

      it("Should success deposit funds into protocol 0", async () => {
        const USDT_Approved = await USDT_TOKEN_CONTRACT.connect(
          liquidityProvider1
        ).approve(
          ATHENA_CONTRACT.address,
          hre_ethers.utils.parseUnits(USDT_AMOUNT, 6)
        );

        expect(USDT_Approved).to.haveOwnProperty("hash");

        const ATEN_Approved = await ATEN_TOKEN_CONTRACT.connect(
          liquidityProvider1
        ).approve(
          STAKED_ATENS_CONTRACT.address,
          hre_ethers.utils.parseUnits(ATEN_AMOUNT, 18)
        );

        expect(ATEN_Approved).to.haveOwnProperty("hash");

        await setNextBlockTimestamp(5 * 24 * 60 * 60);

        const tx = await ATHENA_CONTRACT.connect(liquidityProvider1).deposit(
          USDT_amount,
          ATEN_amount,
          [PROTOCOL_ZERO],
          [USDT_amount]
        );

        expect(tx).to.haveOwnProperty("hash");
      });

      it("Shoud check slot0 in protocol 0", async () => {
        const protocolContract = await getProtocolContract(
          liquidityProvider1,
          PROTOCOL_ZERO
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(5);
        expect(slot0.premiumRate).to.be.equal("1000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("0");
        expect(slot0.hoursPerTick).to.be.equal("24000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.availableCapital).to.be.equal(
          "400000000000000000000000000000000"
        );
        expect(slot0.lastUpdateTimestamp).to.be.equal(currentTime);

        console.log(
          "Simulate user actions >>> LP1 >> check slot0 >>> slot0:",
          getSlot0Info(slot0)
        );
      });

      it("Should check funs and NFT", async () => {
        const balNFT = await POSITIONS_MANAGER_CONTRACT.balanceOf(
          await liquidityProvider1.getAddress()
        );
        expect(balNFT).to.equal("1");

        const userNFTindex =
          await POSITIONS_MANAGER_CONTRACT.tokenOfOwnerByIndex(
            await liquidityProvider1.getAddress(),
            0
          );
        expect(userNFTindex).to.equal("0"); // tokenid 0

        const position = await POSITIONS_MANAGER_CONTRACT.positions(
          userNFTindex
        );
        expect(position.liquidity).to.equal(bn(USDT_amount));
        expect(position.protocolsId).to.deep.equal([bn(0)]);

        // we check AAVE aToken balance
        atokenBalance = atokenBalance.add(USDT_amount);
        expect(
          (
            await getATokenBalance(
              AAVE_LENDING_POOL,
              ATHENA_CONTRACT,
              USDT,
              liquidityProvider1
            )
          ).gte(atokenBalance)
        ).to.be.true;
      });
    });

    describe("Should do actions of liquidity provider 2", () => {
      const USDT_amount = "330000";
      const ATEN_amount = "9000000";
      it("Should prepare USDT balance", async () => {
        expect(
          await USDT_TOKEN_CONTRACT.balanceOf(
            await liquidityProvider2.getAddress()
          )
        ).to.be.equal(0);

        await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
          await liquidityProvider2.getAddress(),
          hre_ethers.utils.parseUnits(USDT_amount, 6)
        );

        expect(
          await USDT_TOKEN_CONTRACT.balanceOf(
            await liquidityProvider2.getAddress()
          )
        ).to.be.equal(hre_ethers.utils.parseUnits(USDT_amount, 6));
      });

      it("Should prepare ATEN balance", async () => {
        expect(
          await ATEN_TOKEN_CONTRACT.balanceOf(
            await liquidityProvider2.getAddress()
          )
        ).to.be.equal(0);

        await ATEN_TOKEN_CONTRACT.connect(atenOwnerSigner).transfer(
          await liquidityProvider2.getAddress(),
          hre_ethers.utils.parseEther(ATEN_amount)
        );

        expect(
          await ATEN_TOKEN_CONTRACT.balanceOf(
            await liquidityProvider2.getAddress()
          )
        ).to.be.equal(hre_ethers.utils.parseEther(ATEN_amount));
      });

      it("Should success deposit funds into protocol 0", async () => {
        const USDT_Approved = await USDT_TOKEN_CONTRACT.connect(
          liquidityProvider2
        ).approve(
          ATHENA_CONTRACT.address,
          hre_ethers.utils.parseUnits(USDT_AMOUNT, 6)
        );

        expect(USDT_Approved).to.haveOwnProperty("hash");

        const ATEN_Approved = await ATEN_TOKEN_CONTRACT.connect(
          liquidityProvider2
        ).approve(
          STAKED_ATENS_CONTRACT.address,
          hre_ethers.utils.parseUnits(ATEN_AMOUNT, 18)
        );

        expect(ATEN_Approved).to.haveOwnProperty("hash");

        await setNextBlockTimestamp(10 * 24 * 60 * 60);

        const tx = await ATHENA_CONTRACT.connect(liquidityProvider2).deposit(
          USDT_amount,
          ATEN_amount,
          [PROTOCOL_ZERO],
          [USDT_amount]
        );

        expect(tx).to.haveOwnProperty("hash");
      });

      it("Shoud check slot0 in protocol 0", async () => {
        const protocolContract = await getProtocolContract(
          liquidityProvider2,
          PROTOCOL_ZERO
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(15);
        expect(slot0.premiumRate).to.be.equal("1000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("0");
        expect(slot0.hoursPerTick).to.be.equal("24000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.availableCapital).to.be.equal(
          "730000000000000000000000000000000"
        );
        expect(slot0.lastUpdateTimestamp).to.be.equal(currentTime);

        console.log(
          "Simulate user actions >>> LP2 >> check slot0 >>> slot0:",
          getSlot0Info(slot0)
        );
      });

      it("Should check funs and NFT", async () => {
        const balNFT = await POSITIONS_MANAGER_CONTRACT.balanceOf(
          await liquidityProvider2.getAddress()
        );
        expect(balNFT).to.equal("1");

        const userNFTindex =
          await POSITIONS_MANAGER_CONTRACT.tokenOfOwnerByIndex(
            await liquidityProvider2.getAddress(),
            0
          );
        expect(userNFTindex).to.equal("1"); // tokenid 1

        const position = await POSITIONS_MANAGER_CONTRACT.positions(
          userNFTindex
        );
        expect(position.liquidity).to.equal(bn(USDT_amount));
        expect(position.protocolsId).to.deep.equal([bn(0)]);

        // we check AAVE aToken balance
        atokenBalance = atokenBalance.add(USDT_amount);
        expect(
          (
            await getATokenBalance(
              AAVE_LENDING_POOL,
              ATHENA_CONTRACT,
              USDT,
              liquidityProvider1
            )
          ).gte(atokenBalance)
        ).to.be.true;
      });
    });

    describe("Should do actions of policy taker 1", () => {
      const capital = "109500";
      const premium = "2190";
      const atensLocked = "0";

      it("Should prepare USDT balance", async () => {
        expect(
          await USDT_TOKEN_CONTRACT.balanceOf(await policyTaker1.getAddress())
        ).to.be.equal(0);

        await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
          await policyTaker1.getAddress(),
          hre_ethers.utils.parseUnits(USDT_AMOUNT, 6)
        );

        expect(
          await USDT_TOKEN_CONTRACT.balanceOf(await policyTaker1.getAddress())
        ).to.be.equal(hre_ethers.utils.parseUnits(USDT_AMOUNT, 6));
      });

      it("Should success buy policy in protocol 0 for 1 year", async () => {
        const USDT_Approved = await USDT_TOKEN_CONTRACT.connect(
          policyTaker1
        ).approve(
          ATHENA_CONTRACT.address,
          hre_ethers.utils.parseUnits(USDT_AMOUNT, 6)
        );

        expect(USDT_Approved).to.haveOwnProperty("hash");

        await setNextBlockTimestamp(20 * 24 * 60 * 60);

        const tx = await ATHENA_CONTRACT.connect(policyTaker1).buyPolicy(
          capital,
          premium,
          atensLocked,
          PROTOCOL_ZERO
        );
        expect(tx).to.haveOwnProperty("hash");

        totalPremium = totalPremium.add(premium);
      });

      it("Shoud check slot0 in protocol 0", async () => {
        const protocolContract = await getProtocolContract(
          policyTaker1,
          PROTOCOL_ZERO
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(35);
        expect(slot0.premiumRate).to.be.equal("2000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("6000000000000000000000000000");
        expect(slot0.hoursPerTick).to.be.equal("12000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal(
          "109500000000000000000000000000000"
        );
        expect(slot0.availableCapital).to.be.equal(
          "730000000000000000000000000000000"
        );
        expect(slot0.lastUpdateTimestamp).to.be.equal(currentTime);

        console.log(
          "Simulate user actions >>> PT1 >> check slot0 >>> slot0:",
          getSlot0Info(slot0)
        );
      });

      it("Should check NFT", async () => {
        const balance = await POLICY_MANAGER_CONTRACT.balanceOf(
          await policyTaker1.getAddress()
        );
        expect(balance).to.equal(1);

        const tokenId = await POLICY_MANAGER_CONTRACT.tokenOfOwnerByIndex(
          await policyTaker1.getAddress(),
          0
        );
        expect(tokenId).to.equal(0);

        const policy = await POLICY_MANAGER_CONTRACT.policies(tokenId);
        expect(policy.liquidity).to.equal(capital);
        expect(policy.protocolId).to.equal(bn(PROTOCOL_ZERO));

        const protocolContract = await getProtocolContract(
          policyTaker1,
          PROTOCOL_ZERO
        );

        expect(await protocolContract.symbol()).to.equal(
          "APP_" + PROTOCOL_ZERO
        );

        const balanceProtocol = await USDT_TOKEN_CONTRACT.balanceOf(
          protocolContract.address
        );
        expect(balanceProtocol).to.equal(totalPremium);
      });
    });

    describe("Should do actions of policy taker 2", () => {
      const capital = "219000";
      const premium = "8760";
      const atensLocked = "0";

      it("Should prepare USDT balance", async () => {
        expect(
          await USDT_TOKEN_CONTRACT.balanceOf(await policyTaker2.getAddress())
        ).to.be.equal(0);

        await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
          await policyTaker2.getAddress(),
          hre_ethers.utils.parseUnits(USDT_AMOUNT, 6)
        );

        expect(
          await USDT_TOKEN_CONTRACT.balanceOf(await policyTaker2.getAddress())
        ).to.be.equal(hre_ethers.utils.parseUnits(USDT_AMOUNT, 6));
      });

      it("Should success buy policy in protocol 0 for 1 year", async () => {
        const USDT_Approved = await USDT_TOKEN_CONTRACT.connect(
          policyTaker2
        ).approve(
          ATHENA_CONTRACT.address,
          hre_ethers.utils.parseUnits(USDT_AMOUNT, 6)
        );

        expect(USDT_Approved).to.haveOwnProperty("hash");

        await setNextBlockTimestamp(10 * 24 * 60 * 60);

        const tx = await ATHENA_CONTRACT.connect(policyTaker2).buyPolicy(
          capital,
          premium,
          atensLocked,
          PROTOCOL_ZERO
        );
        expect(tx).to.haveOwnProperty("hash");

        totalPremium = totalPremium.add(premium);
      });

      it("Shoud check slot0 in protocol 0", async () => {
        const protocolContract = await getProtocolContract(
          policyTaker2,
          PROTOCOL_ZERO
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(55);
        expect(slot0.premiumRate).to.be.equal("3999753444922335150535572420");
        expect(slot0.emissionRate).to.be.equal("35997781004301016354820151780");
        expect(slot0.hoursPerTick).to.be.equal("6000369855413929850756491303");
        expect(slot0.totalInsuredCapital).to.be.equal(
          "328500000000000000000000000000000"
        );
        expect(slot0.availableCapital).to.be.equal(
          "730060000000000000000000000000000"
        );
        expect(slot0.lastUpdateTimestamp).to.be.equal(currentTime);

        console.log(
          "Simulate user actions >>> PT2 >> check slot0 >>> slot0:",
          getSlot0Info(slot0)
        );
      });

      it("Should check NFT", async () => {
        const balance = await POLICY_MANAGER_CONTRACT.balanceOf(
          await policyTaker2.getAddress()
        );
        expect(balance).to.equal(1);

        const tokenId = await POLICY_MANAGER_CONTRACT.tokenOfOwnerByIndex(
          await policyTaker2.getAddress(),
          0
        );
        expect(tokenId).to.equal(1);

        const policy = await POLICY_MANAGER_CONTRACT.policies(tokenId);
        expect(policy.liquidity).to.equal(capital);
        expect(policy.protocolId).to.equal(bn(PROTOCOL_ZERO));

        const protocolContract = await getProtocolContract(
          policyTaker2,
          PROTOCOL_ZERO
        );

        expect(await protocolContract.symbol()).to.equal(
          "APP_" + PROTOCOL_ZERO
        );

        const balanceProtocol = await USDT_TOKEN_CONTRACT.balanceOf(
          protocolContract.address
        );
        expect(balanceProtocol).to.equal(totalPremium);
      });
    });
  });
});
