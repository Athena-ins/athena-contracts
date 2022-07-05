import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import weth_abi from "../abis/weth.json";
import chaiAsPromised from "chai-as-promised";
import { getATokenBalance } from "./helpers";

import HardhatHelper from "./helpers/HardhatHelper";
import ProtocolHelper from "./helpers/ProtocolHelper";

chai.use(chaiAsPromised);

const bn = (num: string | number) => hre_ethers.BigNumber.from(num);

const BINANCE_WALLET = "0xF977814e90dA44bFA03b6295A0616a897441aceC"; //1Md2 USDT
const ATEN_OWNER_ADDRESS = "0x967d98e659f2787A38d928B9B7a49a2E4701B30C";

const AAVE_LENDING_POOL = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const ATEN_TOKEN = "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283";

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
  USDT_TOKEN_CONTRACT: ethers.Contract,
  ATEN_TOKEN_CONTRACT: ethers.Contract;

const PROTOCOL_ZERO = 0;
const USDT_AMOUNT = "1000000";
const ATEN_AMOUNT = "10000000";

describe("Simulation", () => {
  before(async () => {
    await HardhatHelper.reset();

    allSigners = await HardhatHelper.allSigners();
    owner = allSigners[0];
    liquidityProvider1 = allSigners[1];
    liquidityProvider2 = allSigners[2];
    liquidityProvider3 = allSigners[3];
    policyTaker1 = allSigners[100];
    policyTaker2 = allSigners[101];
    policyTaker3 = allSigners[102];

    binanceSigner = await HardhatHelper.impersonateAccount(BINANCE_WALLET);

    atenOwnerSigner = await HardhatHelper.impersonateAccount(
      ATEN_OWNER_ADDRESS
    );

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

  function getSlot0Info(slot0: any) {
    const info = {
      tick: slot0.tick.toString(),
      premiumRate: slot0.premiumRate.toString(),
      emissionRate: slot0.emissionRate.toString(),
      hoursPerTick: slot0.hoursPerTick.toString(),
      totalInsuredCapital: slot0.totalInsuredCapital.toString(),
      availableCapital: slot0.availableCapital.toString(),
      premiumSpent: slot0.premiumSpent.toString(),
      remainingPolicies: slot0.remainingPolicies.toString(),
      lastUpdateTimestamp: slot0.lastUpdateTimestamp.toString(),
    };

    return info;
  }

  describe("Should prepare Protocol", () => {
    describe("Should deploy all Contracts and initialize Protocol", () => {
      it("Should deploy Athena contract", async () => {
        await ProtocolHelper.deployAthenaContract(owner);
        ATHENA_CONTRACT = ProtocolHelper.getAthenaContract();
        expect(
          await hre_ethers.provider.getCode(
            ProtocolHelper.getAthenaContract().address
          )
        ).to.not.equal("0x");
      });

      it("Should deploy PositionsManager contract", async () => {
        await ProtocolHelper.deployPositionManagerContract(owner);

        expect(
          await hre_ethers.provider.getCode(
            ProtocolHelper.getPositionManagerContract().address
          )
        ).to.not.equal("0x");
      });

      it("Should deploy StakedAten contract", async () => {
        await ProtocolHelper.deployStakedAtenContract(owner);

        expect(
          await hre_ethers.provider.getCode(
            ProtocolHelper.getStakedAtenContract().address
          )
        ).to.not.equal("0x");
      });

      it("Should deploy ProtocolFactory contract", async () => {
        await ProtocolHelper.deployProtocolFactoryContract(owner);

        expect(
          await hre_ethers.provider.getCode(
            ProtocolHelper.getProtocolFactoryContract().address
          )
        ).to.not.equal("0x");
      });

      it("Should deploy PolicyManager contract", async () => {
        await ProtocolHelper.deployPolicyManagerContract(owner);

        expect(
          await hre_ethers.provider.getCode(
            ProtocolHelper.getPolicyManagerContract().address
          )
        ).to.not.equal("0x");
      });

      it("Should initialize protocol with required values", async () => {
        const init = await ProtocolHelper.initializeProtocol();

        expect(init).to.haveOwnProperty("hash");
      });
    });

    describe("Set new active protocol 0", () => {
      it("Should set new active protocol", async () => {
        await HardhatHelper.setNextBlockTimestamp(0 * 24 * 60 * 60);
        const tx = await ProtocolHelper.addNewProtocolPool("Test protocol 0");

        expect(tx).to.haveOwnProperty("hash");

        const protocol = await ProtocolHelper.getProtocolPoolDataById(0);
        expect(protocol.name).to.equal("Test protocol 0");
      });

      it("Should check slot0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          PROTOCOL_ZERO
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(0);
        expect(slot0.premiumRate).to.be.equal("1000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("0");
        expect(slot0.hoursPerTick).to.be.equal("24000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.premiumSpent).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal("0");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal("0");
      });

      it("Should check relatedProtocols", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          PROTOCOL_ZERO
        );

        const relatedProtocol = await protocolContract.relatedProtocols(0);

        expect(relatedProtocol).to.be.equal(0);

        const intersectingAmounts = await protocolContract.intersectingAmounts(
          0
        );

        expect(intersectingAmounts).to.be.equal(0);
      });
    });

    describe("Set new active protocol 1", () => {
      it("Should set new active protocol", async () => {
        await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);
        const tx = await ProtocolHelper.addNewProtocolPool("Test protocol 1");

        expect(tx).to.haveOwnProperty("hash");

        const protocol = await ProtocolHelper.getProtocolPoolDataById(1);
        expect(protocol.name).to.equal("Test protocol 1");
      });

      it("Should check slot0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          1
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(0);
        expect(slot0.premiumRate).to.be.equal("1000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("0");
        expect(slot0.hoursPerTick).to.be.equal("24000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.premiumSpent).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal("0");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal("0");
      });

      it("Should check relatedProtocols", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          1
        );

        const relatedProtocol = await protocolContract.relatedProtocols(0);

        expect(relatedProtocol).to.be.equal(1);

        const intersectingAmounts = await protocolContract.intersectingAmounts(
          0
        );

        expect(intersectingAmounts).to.be.equal(0);
      });
    });

    describe("Set new active protocol 2", () => {
      it("Should set new active protocol", async () => {
        await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);
        const tx = await ProtocolHelper.addNewProtocolPool("Test protocol 2");

        expect(tx).to.haveOwnProperty("hash");

        const protocol = await ProtocolHelper.getProtocolPoolDataById(2);
        expect(protocol.name).to.equal("Test protocol 2");
      });

      it("Should check slot0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          2
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(0);
        expect(slot0.premiumRate).to.be.equal("1000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("0");
        expect(slot0.hoursPerTick).to.be.equal("24000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.premiumSpent).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal("0");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal("0");
      });

      it("Should check relatedProtocols", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          2
        );

        const relatedProtocol = await protocolContract.relatedProtocols(0);

        expect(relatedProtocol).to.be.equal(2);

        const intersectingAmounts = await protocolContract.intersectingAmounts(
          0
        );

        expect(intersectingAmounts).to.be.equal(0);
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
        const STAKED_ATENS_CONTRACT = ProtocolHelper.getStakedAtenContract();

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

      it("Should success deposit funds into the protocols 0 and 2", async () => {
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
          ProtocolHelper.getStakedAtenContract().address,
          hre_ethers.utils.parseUnits(ATEN_AMOUNT, 18)
        );

        expect(ATEN_Approved).to.haveOwnProperty("hash");

        await HardhatHelper.setNextBlockTimestamp(5 * 24 * 60 * 60);

        const tx = await ATHENA_CONTRACT.connect(liquidityProvider1).deposit(
          USDT_amount,
          ATEN_amount,
          [PROTOCOL_ZERO, 2],
          [USDT_amount, USDT_amount]
        );

        expect(tx).to.haveOwnProperty("hash");
      });

      it("Should check slot0 in protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider1,
          PROTOCOL_ZERO
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(0);
        expect(slot0.premiumRate).to.be.equal("1000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("0");
        expect(slot0.hoursPerTick).to.be.equal("24000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.premiumSpent).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal("0");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const availableCapital = await protocolContract.availableCapital();
        expect(availableCapital).to.be.equal(
          "400000000000000000000000000000000"
        );

        // console.log(
        //   "Simulate user actions >>> LP1 >> check slot0 >>> slot0:",
        //   getSlot0Info(slot0)
        // );
      });

      it("Should check funs and NFT", async () => {
        const POSITIONS_MANAGER_CONTRACT =
          ProtocolHelper.getPositionManagerContract();

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
        expect(position.protocolsId).to.deep.equal([bn(0), bn(2)]);

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

      it("Should check relatedProtocols of Protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          PROTOCOL_ZERO
        );

        const protocol0Index = await protocolContract.intersectingAmountIndexes(
          PROTOCOL_ZERO
        );

        expect(protocol0Index).to.be.equal(0);

        expect(
          await protocolContract.relatedProtocols(protocol0Index)
        ).to.be.equal(0);

        expect(
          await protocolContract.intersectingAmounts(protocol0Index)
        ).to.be.equal("400000000000000000000000000000000");

        const protocol2Index = await protocolContract.intersectingAmountIndexes(
          2
        );

        expect(
          await protocolContract.relatedProtocols(protocol2Index)
        ).to.be.equal(2);

        expect(
          await protocolContract.intersectingAmounts(protocol2Index)
        ).to.be.equal("400000000000000000000000000000000");
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

      it("Should success deposit funds into protocol 0, 1 and 2", async () => {
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
          ProtocolHelper.getStakedAtenContract().address,
          hre_ethers.utils.parseUnits(ATEN_AMOUNT, 18)
        );

        expect(ATEN_Approved).to.haveOwnProperty("hash");

        await HardhatHelper.setNextBlockTimestamp(10 * 24 * 60 * 60);

        const tx = await ATHENA_CONTRACT.connect(liquidityProvider2).deposit(
          USDT_amount,
          ATEN_amount,
          [PROTOCOL_ZERO, 1, 2],
          [USDT_amount, USDT_amount, USDT_amount]
        );

        expect(tx).to.haveOwnProperty("hash");
      });

      it("Should check slot0 in protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider2,
          PROTOCOL_ZERO
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(0);
        expect(slot0.premiumRate).to.be.equal("1000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("0");
        expect(slot0.hoursPerTick).to.be.equal("24000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.premiumSpent).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal("0");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const availableCapital = await protocolContract.availableCapital();
        expect(availableCapital).to.be.equal(
          "730000000000000000000000000000000"
        );

        // console.log(
        //   "Simulate user actions >>> LP2 >> check slot0 >>> slot0:",
        //   getSlot0Info(slot0)
        // );
      });

      it("Should check funs and NFT", async () => {
        const POSITIONS_MANAGER_CONTRACT =
          ProtocolHelper.getPositionManagerContract();

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
        expect(position.protocolsId).to.deep.equal([bn(0), bn(1), bn(2)]);

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

      it("Should check relatedProtocols of Protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          PROTOCOL_ZERO
        );

        const protocol0Index = await protocolContract.intersectingAmountIndexes(
          PROTOCOL_ZERO
        );

        expect(protocol0Index).to.be.equal(0);

        expect(
          await protocolContract.relatedProtocols(protocol0Index)
        ).to.be.equal(0);

        expect(
          await protocolContract.intersectingAmounts(protocol0Index)
        ).to.be.equal("730000000000000000000000000000000");

        const protocol1Index = await protocolContract.intersectingAmountIndexes(
          1
        );

        expect(protocol1Index).to.be.equal(2);

        expect(
          await protocolContract.relatedProtocols(protocol1Index)
        ).to.be.equal(1);

        expect(
          await protocolContract.intersectingAmounts(protocol1Index)
        ).to.be.equal("330000000000000000000000000000000");

        const protocol2Index = await protocolContract.intersectingAmountIndexes(
          2
        );

        expect(protocol2Index).to.be.equal(1);

        expect(
          await protocolContract.relatedProtocols(protocol2Index)
        ).to.be.equal(2);

        expect(
          await protocolContract.intersectingAmounts(protocol2Index)
        ).to.be.equal("730000000000000000000000000000000");
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

        await HardhatHelper.setNextBlockTimestamp(20 * 24 * 60 * 60);

        const tx = await ATHENA_CONTRACT.connect(policyTaker1).buyPolicy(
          capital,
          premium,
          atensLocked,
          PROTOCOL_ZERO
        );
        expect(tx).to.haveOwnProperty("hash");

        totalPremium = totalPremium.add(premium);
      });

      it("Should check policy info", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          PROTOCOL_ZERO
        );
        const policyInfo = await protocolContract.premiumPositions(
          await policyTaker1.getAddress()
        );

        expect(policyInfo.capitalInsured).to.be.equal(
          "109500000000000000000000000000000"
        );
        expect(policyInfo.beginPremiumRate).to.be.equal(
          "2000000000000000000000000000"
        );
        expect(policyInfo.ownerIndex).to.be.equal("0");
        expect(policyInfo.lastTick).to.be.equal(730);

        // console.log(
        //   "Simulate user actions >>> PT1 >> check policy info >>> policyInfo:",
        //   policyInfo
        // );
      });

      it("Should get info", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          PROTOCOL_ZERO
        );

        const response = await protocolContract.getInfo(
          await policyTaker1.getAddress()
        );

        expect(response.__remainingPremium).to.be.equal(2190);
        expect(response.__remainingDay).to.be.equal(365);

        // console.log( "Simulate user actions >>> PT1 >> get info >>> response:", response);
      });

      it("Should check slot0 in protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          PROTOCOL_ZERO
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(0);
        expect(slot0.premiumRate).to.be.equal("2000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("6000000000000000000000000000");
        expect(slot0.hoursPerTick).to.be.equal("12000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal(
          "109500000000000000000000000000000"
        );
        expect(slot0.premiumSpent).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal("1");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal(
          "730000000000000000000000000000000"
        );

        // console.log(
        //   "Simulate user actions >>> PT1 >> check slot0 >>> slot0:",
        //   getSlot0Info(slot0)
        // );
      });

      it("Should check NFT", async () => {
        const POLICY_MANAGER_CONTRACT =
          ProtocolHelper.getPolicyManagerContract();

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

        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
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

        await HardhatHelper.setNextBlockTimestamp(10 * 24 * 60 * 60);

        const tx = await ATHENA_CONTRACT.connect(policyTaker2).buyPolicy(
          capital,
          premium,
          atensLocked,
          PROTOCOL_ZERO
        );
        expect(tx).to.haveOwnProperty("hash");

        totalPremium = totalPremium.add(premium);
      });

      it("Should check policy info", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker2,
          PROTOCOL_ZERO
        );
        const policyInfo = await protocolContract.premiumPositions(
          await policyTaker2.getAddress()
        );

        expect(policyInfo.capitalInsured).to.be.equal(
          "219000000000000000000000000000000"
        );
        expect(policyInfo.beginPremiumRate).to.be.equal(
          "4000000000000000000000000000"
        );
        expect(policyInfo.ownerIndex).to.be.equal("0");
        expect(policyInfo.lastTick).to.be.equal(1480);

        // console.log(
        //   "Simulate user actions >>> PT2 >> check policy info >>> policyInfo:",
        //   policyInfo
        // );
      });

      it("Should get info", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker2,
          PROTOCOL_ZERO
        );

        const response = await protocolContract.getInfo(
          await policyTaker2.getAddress()
        );

        expect(response.__remainingPremium).to.be.equal("8760");
        //remainingDay == 428 and not 365 because of expired policy of PT1
        expect(response.__remainingDay).to.be.equal("427");

        // console.log( "Simulate user actions >>> PT2 >> get info >>> response:", response);
      });

      it("Should check slot0 in protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker2,
          PROTOCOL_ZERO
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(20);
        expect(slot0.premiumRate).to.be.equal("4000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("36000000000000000000000000000");
        expect(slot0.hoursPerTick).to.be.equal("6000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal(
          "328500000000000000000000000000000"
        );
        expect(slot0.premiumSpent).to.be.equal("60000000000000000000000000000");
        expect(slot0.remainingPolicies).to.be.equal("2");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal(
          "730000000000000000000000000000000"
        );

        // console.log(
        //   "Simulate user actions >>> PT2 >> check slot0 >>> slot0:",
        //   getSlot0Info(slot0)
        // );
      });

      it("Should check NFT", async () => {
        const POLICY_MANAGER_CONTRACT =
          ProtocolHelper.getPolicyManagerContract();

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

        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
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

    describe("Should view actualize", () => {
      it("Should get vSlot0 after 10 days", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          PROTOCOL_ZERO
        );

        const view = await protocolContract.actualizingUntilGivenDate(
          HardhatHelper.getCurrentTime() + 10 * 24 * 60 * 60
        );

        expect(view.__slot0.tick).to.be.equal(60);
        expect(view.__slot0.premiumRate).to.be.equal(4);
        expect(view.__slot0.emissionRate).to.be.equal(36);
        expect(view.__slot0.hoursPerTick).to.be.equal(6);
        expect(view.__slot0.totalInsuredCapital).to.be.equal(328500);
        expect(view.__slot0.premiumSpent).to.be.equal(420);
        expect(view.__slot0.remainingPolicies).to.be.equal(2);
        expect(view.__slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime() + 10 * 24 * 60 * 60
        );

        expect(view.__availableCapital).to.be.equal(730000);

        // console.log(
        //   "Simulate user actions >>> actualize view after 10 days >>> vslot0:",
        //   getSlot0Info(vSlot0)
        // );
      });

      it("Should get vSlot0 after 178 days", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          PROTOCOL_ZERO
        );

        const days = 178;
        const view = await protocolContract.actualizingUntilGivenDate(
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(view.__slot0.tick).to.be.equal(731);
        expect(view.__slot0.premiumRate).to.be.equal(3);
        expect(view.__slot0.emissionRate).to.be.equal(18);
        expect(view.__slot0.hoursPerTick).to.be.equal(8);
        expect(view.__slot0.totalInsuredCapital).to.be.equal(219000);
        expect(view.__slot0.premiumSpent).to.be.equal(6459); //Thao@TODO: check why ???
        expect(view.__slot0.remainingPolicies).to.be.equal(1);
        expect(view.__slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(view.__availableCapital).to.be.equal(730000);

        // console.log(
        //   "Simulate user actions >>> actualize view after 178 days >>> vslot0:",
        //   getSlot0Info(vSlot0)
        // );
      });

      it("Should get vSlot0 after 428 days", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          PROTOCOL_ZERO
        );

        const days = 428;
        const view = await protocolContract.actualizingUntilGivenDate(
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(view.__slot0.tick).to.be.equal(1480);
        expect(view.__slot0.premiumRate).to.be.equal(1);
        expect(view.__slot0.emissionRate).to.be.equal(0);
        expect(view.__slot0.hoursPerTick).to.be.equal(24);
        expect(view.__slot0.totalInsuredCapital).to.be.equal(0);
        expect(view.__slot0.premiumSpent).to.be.equal(10950);
        expect(view.__slot0.remainingPolicies).to.be.equal(0);
        expect(view.__slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(view.__availableCapital).to.be.equal(730000);

        // console.log(
        //   "Simulate user actions >>> actualize view after 428 days >>> vslot0:",
        //   getSlot0Info(vSlot0)
        // );
      });
    });

    describe("Should view info of PT1 after 10 days and arriving of PT2", () => {
      it("Should get info via protocol contract", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          PROTOCOL_ZERO
        );

        const response = await protocolContract.getInfo(
          await policyTaker1.getAddress()
        );

        expect(response.__remainingPremium).to.be.equal("2130");
        expect(response.__remainingDay).to.be.equal("177");

        // console.log(
        //   "Simulate user actions >>> Should view info of PT1 after arriving of PT2 >> get info >>> response:",
        //   response
        // );
      });
    });

    describe("Should withdraw policy of PT1 after 1 days arriving of PT2", () => {
      it("Should withdraw policy", async () => {
        await HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);
        const tx = await ATHENA_CONTRACT.connect(policyTaker1).withdrawPolicy(
          PROTOCOL_ZERO
        );

        const result = await tx.wait();
        const event = result.events[1];

        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker1,
          PROTOCOL_ZERO
        );

        const decodedData = protocolContract.interface.decodeEventLog(
          event.topics[0],
          event.data
        );

        expect(decodedData.owner).to.be.equal(await policyTaker1.getAddress());
        expect(decodedData.remainedAmount).to.be.equal("2118");
      });

      it("Should check slot0 after PT1 quit", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          PROTOCOL_ZERO
        );

        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(24);
        expect(slot0.premiumRate).to.be.equal("3000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("18000000000000000000000000000");
        expect(slot0.hoursPerTick).to.be.equal("8000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal(
          "219000000000000000000000000000000"
        );
        expect(slot0.premiumSpent).to.be.equal("96000000000000000000000000000");
        expect(slot0.remainingPolicies).to.be.equal(1);
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal(
          "730000000000000000000000000000000"
        );
      });
    });

    describe("Should withdraw policy of PT2 after 10 days withdrawed of PT1", () => {
      it("Should withdraw policy", async () => {
        await HardhatHelper.setNextBlockTimestamp(10 * 24 * 60 * 60);
        const tx = await ATHENA_CONTRACT.connect(policyTaker2).withdrawPolicy(
          PROTOCOL_ZERO
        );

        const result = await tx.wait();
        const event = result.events[1];

        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker2,
          PROTOCOL_ZERO
        );

        const decodedData = protocolContract.interface.decodeEventLog(
          event.topics[0],
          event.data
        );

        expect(decodedData.owner).to.be.equal(await policyTaker2.getAddress());
        expect(decodedData.remainedAmount).to.be.equal("8556");
      });

      it("Should check slot0 after PT2 quit", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          PROTOCOL_ZERO
        );

        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(54);
        expect(slot0.premiumRate).to.be.equal("1000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("0");
        expect(slot0.hoursPerTick).to.be.equal("24000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.premiumSpent).to.be.equal(
          "276000000000000000000000000000"
        );
        expect(slot0.remainingPolicies).to.be.equal(0);
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal(
          "730000000000000000000000000000000"
        );
      });
    });

    describe("Claims", async () => {
      it("Should success rebuy policy for policyTaker1 in protocol 0 for 1 year", async () => {
        const capital = "109500";
        const premium = "2190";
        const atensLocked = "0";

        await HardhatHelper.setNextBlockTimestamp(20 * 24 * 60 * 60);

        const tx = await ATHENA_CONTRACT.connect(policyTaker1).buyPolicy(
          capital,
          premium,
          atensLocked,
          PROTOCOL_ZERO
        );
        expect(tx).to.haveOwnProperty("hash");
      });

      it("Should success rebuy policy for policyTaker2 in protocol 0 for 1 year", async () => {
        const capital = "219000";
        const premium = "8760";
        const atensLocked = "0";

        await HardhatHelper.setNextBlockTimestamp(10 * 24 * 60 * 60);

        const tx = await ATHENA_CONTRACT.connect(policyTaker2).buyPolicy(
          capital,
          premium,
          atensLocked,
          PROTOCOL_ZERO
        );
        expect(tx).to.haveOwnProperty("hash");
      });

      it("Should check slot0 in protocol 0 before claim", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker2,
          PROTOCOL_ZERO
        );
        const slot0 = await protocolContract.slot0();

        // expect(slot0.tick).to.be.equal(20);
        expect(slot0.premiumRate).to.be.equal("4000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("36000000000000000000000000000");
        expect(slot0.hoursPerTick).to.be.equal("6000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal(
          "328500000000000000000000000000000"
        );
        expect(slot0.premiumSpent).to.be.equal(
          "336000000000000000000000000000"
        );
        expect(slot0.remainingPolicies).to.be.equal("2");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal(
          "730000000000000000000000000000000"
        );

        // console.log(
        //   "Simulate user actions >>> PT2 >> check slot0 >>> slot0:",
        //   getSlot0Info(slot0)
        // );
      });

      it("Should add claim of policyTaker3 in Protocol 2", async () => {
        HardhatHelper.setNextBlockTimestamp(1 * 24 * 60 * 60);

        await ATHENA_CONTRACT.connect(owner).addClaim(
          await policyTaker3.getAddress(),
          2,
          182500
        );

        const protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );
        const claim = await protocolPool0.claims(0);

        expect(claim.disputeId).to.be.equal(2);
        expect(claim.amount).to.be.equal("182500000000000000000000000000000");
        expect(claim.ratio).to.be.equal("250000000000000000000000000");
        expect(claim.createdAt).to.be.equal(HardhatHelper.getCurrentTime());
        expect(claim.availableCapitalBefore).to.be.equal(0);
        expect(claim.premiumSpentBefore).to.be.equal(0);
      });

      it("Should check slot0 in Protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          policyTaker2,
          PROTOCOL_ZERO
        );
        const slot0 = await protocolContract.slot0();

        // expect(slot0.tick).to.be.equal(24);
        expect(slot0.premiumRate).to.be.equal("4000000000000000000000000000");
        expect(slot0.emissionRate).to.be.equal("36000000000000000000000000000");
        expect(slot0.hoursPerTick).to.be.equal("6000000000000000000000000000");
        expect(slot0.totalInsuredCapital).to.be.equal(
          "328500000000000000000000000000000"
        );
        expect(slot0.premiumSpent).to.be.equal(
          "372000000000000000000000000000"
        );
        expect(slot0.remainingPolicies).to.be.equal("2");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal(
          "730000000000000000000000000000000"
        );

        // console.log(
        //   "Simulate user actions >>> PT2 >> check slot0 >>> slot0:",
        //   getSlot0Info(slot0)
        // );
      });

      it("Should get vSlot0 of Protocol 0 after claim 1 day ", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          PROTOCOL_ZERO
        );

        const days = 1;
        const view = await protocolContract.actualizingUntilGivenDate(
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        // expect(view.__slot0.tick).to.be.equal(29);
        expect(view.__slot0.premiumRate).to.be.equal(5);
        expect(view.__slot0.emissionRate).to.be.equal(45);
        expect(view.__slot0.hoursPerTick).to.be.equal(5); //Thao@NOTE: la vrai valeur est 4,8 mais arrondi par RayMath
        expect(view.__slot0.totalInsuredCapital).to.be.equal(328500);
        // expect(view.__slot0.premiumSpent).to.be.equal(10950);
        expect(view.__slot0.remainingPolicies).to.be.equal(2);
        expect(view.__slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime() + days * 24 * 60 * 60
        );

        expect(view.__availableCapital).to.be.equal(730000 - 182500);

        // console.log(
        //   "Simulate user actions >>> actualize view after 428 days >>> vslot0:",
        //   getSlot0Info(vSlot0)
        // );
      });

      //Thao@TODO: check intersecAmounts too
    });
  });
});
