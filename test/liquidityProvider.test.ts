import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "./helpers/HardhatHelper";
import ProtocolHelper from "./helpers/ProtocolHelper";

chai.use(chaiAsPromised);

const bn = (num: string | number) => hre_ethers.BigNumber.from(num);

const USDT_AMOUNT = "1000000";
const ATEN_AMOUNT = "10000000";

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;

describe("liquidity provider deposit", () => {
  before(async () => {
    await HardhatHelper.reset();
    const allSigners = await HardhatHelper.allSigners();
    owner = allSigners[0];
    liquidityProvider1 = allSigners[1];
    liquidityProvider2 = allSigners[2];

    await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
    await ProtocolHelper.addNewProtocolPool("Test protocol 0");
    await ProtocolHelper.addNewProtocolPool("Test protocol 1");
    await ProtocolHelper.addNewProtocolPool("Test protocol 2");
  });

  describe("Should simulate liquidity provider actions", async () => {
    let atokenBalance = bn(0);

    describe("Should do actions of liquidity provider 1", async () => {
      const USDT_amount = "400000";
      const ATEN_amount = "100000";
      it("Should prepare USDT balance", async () => {
        expect(
          await HardhatHelper.USDT_balanceOf(
            await liquidityProvider1.getAddress()
          )
        ).to.be.equal(0);

        await HardhatHelper.USDT_transfer(
          await liquidityProvider1.getAddress(),
          hre_ethers.utils.parseUnits(USDT_amount, 6)
        );

        expect(
          await HardhatHelper.USDT_balanceOf(
            await liquidityProvider1.getAddress()
          )
        ).to.be.equal(hre_ethers.utils.parseUnits(USDT_amount, 6));
      });

      it("Should prepare ATEN balance", async () => {
        expect(
          await HardhatHelper.ATEN_balanceOf(
            await liquidityProvider1.getAddress()
          )
        ).to.be.equal(0);

        await HardhatHelper.ATEN_transfer(
          await liquidityProvider1.getAddress(),
          hre_ethers.utils.parseEther(ATEN_amount)
        );

        expect(
          await HardhatHelper.ATEN_balanceOf(
            await liquidityProvider1.getAddress()
          )
        ).to.be.equal(hre_ethers.utils.parseEther(ATEN_amount));
      });

      it("Should success deposit funds into the protocols 0 and 2", async () => {
        const USDT_Approved = await HardhatHelper.USDT_approve(
          liquidityProvider1,
          ProtocolHelper.getAthenaContract().address,
          hre_ethers.utils.parseUnits(USDT_AMOUNT, 6)
        );

        expect(USDT_Approved).to.haveOwnProperty("hash");

        const ATEN_Approved = await HardhatHelper.ATEN_approve(
          liquidityProvider1,
          ProtocolHelper.getStakedAtenContract().address,
          hre_ethers.utils.parseUnits(ATEN_AMOUNT, 18)
        );

        expect(ATEN_Approved).to.haveOwnProperty("hash");

        await HardhatHelper.setNextBlockTimestamp(5 * 24 * 60 * 60);

        const tx = await ProtocolHelper.getAthenaContract()
          .connect(liquidityProvider1)
          .deposit(
            USDT_amount,
            ATEN_amount,
            [0, 2],
            [USDT_amount, USDT_amount]
          );

        expect(tx).to.haveOwnProperty("hash");
      });

      it("Should check slot0 in protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider1,
          0
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
            await HardhatHelper.getATokenBalance(
              ProtocolHelper.getAthenaContract(),
              HardhatHelper.USDT,
              liquidityProvider1
            )
          ).gte(atokenBalance)
        ).to.be.true;
      });

      it("Should check relatedProtocols of Protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        const protocol0Index = await protocolContract.intersectingAmountIndexes(
          0
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
          await HardhatHelper.USDT_balanceOf(
            await liquidityProvider2.getAddress()
          )
        ).to.be.equal(0);

        await HardhatHelper.USDT_transfer(
          await liquidityProvider2.getAddress(),
          hre_ethers.utils.parseUnits(USDT_amount, 6)
        );

        expect(
          await HardhatHelper.USDT_balanceOf(
            await liquidityProvider2.getAddress()
          )
        ).to.be.equal(hre_ethers.utils.parseUnits(USDT_amount, 6));
      });

      it("Should prepare ATEN balance", async () => {
        expect(
          await HardhatHelper.ATEN_balanceOf(
            await liquidityProvider2.getAddress()
          )
        ).to.be.equal(0);

        await HardhatHelper.ATEN_transfer(
          await liquidityProvider2.getAddress(),
          hre_ethers.utils.parseEther(ATEN_amount)
        );

        expect(
          await HardhatHelper.ATEN_balanceOf(
            await liquidityProvider2.getAddress()
          )
        ).to.be.equal(hre_ethers.utils.parseEther(ATEN_amount));
      });

      it("Should success deposit funds into protocol 0, 1 and 2", async () => {
        const USDT_Approved = await HardhatHelper.USDT_approve(
          liquidityProvider2,
          ProtocolHelper.getAthenaContract().address,
          hre_ethers.utils.parseUnits(USDT_AMOUNT, 6)
        );

        expect(USDT_Approved).to.haveOwnProperty("hash");

        const ATEN_Approved = await await HardhatHelper.ATEN_approve(
          liquidityProvider2,
          ProtocolHelper.getStakedAtenContract().address,
          hre_ethers.utils.parseUnits(ATEN_AMOUNT, 18)
        );

        expect(ATEN_Approved).to.haveOwnProperty("hash");

        await HardhatHelper.setNextBlockTimestamp(10 * 24 * 60 * 60);

        const tx = await ProtocolHelper.getAthenaContract()
          .connect(liquidityProvider2)
          .deposit(
            USDT_amount,
            ATEN_amount,
            [0, 1, 2],
            [USDT_amount, USDT_amount, USDT_amount]
          );

        expect(tx).to.haveOwnProperty("hash");
      });

      it("Should check slot0 in protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          liquidityProvider2,
          0
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
            await HardhatHelper.getATokenBalance(
              ProtocolHelper.getAthenaContract(),
              HardhatHelper.USDT,
              liquidityProvider1
            )
          ).gte(atokenBalance)
        ).to.be.true;
      });

      it("Should check relatedProtocols of Protocol 0", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0
        );

        const protocol0Index = await protocolContract.intersectingAmountIndexes(
          0
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
  });
});
