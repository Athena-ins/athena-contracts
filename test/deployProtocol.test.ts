import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "./helpers/HardhatHelper";
import ContractHelper from "./helpers/ContractHelper";

chai.use(chaiAsPromised);

const bn = (num: string | number) => hre_ethers.BigNumber.from(num);

let owner: ethers.Signer;

describe("Deploy protocol", () => {
  before(async () => {
    await HardhatHelper.reset();
    owner = (await HardhatHelper.allSigners())[0];
  });

  describe("Should prepare Protocol", () => {
    describe("Should deploy all Contracts and initialize Protocol", () => {
      it("Should deploy Athena contract", async () => {
        await ContractHelper.deployAthenaContract(owner);

        expect(
          await hre_ethers.provider.getCode(
            ContractHelper.getAthenaContract().address
          )
        ).to.not.equal("0x");
      });

      it("Should deploy PositionsManager contract", async () => {
        await ContractHelper.deployPositionManagerContract(owner);

        expect(
          await hre_ethers.provider.getCode(
            ContractHelper.getPositionManagerContract().address
          )
        ).to.not.equal("0x");
      });

      it("Should deploy StakedAten contract", async () => {
        await ContractHelper.deployStakedAtenContract(owner);

        expect(
          await hre_ethers.provider.getCode(
            ContractHelper.getStakedAtenContract().address
          )
        ).to.not.equal("0x");
      });

      it("Should deploy ProtocolFactory contract", async () => {
        await ContractHelper.deployProtocolFactoryContract(owner);

        expect(
          await hre_ethers.provider.getCode(
            ContractHelper.getProtocolFactoryContract().address
          )
        ).to.not.equal("0x");
      });

      it("Should deploy PolicyManager contract", async () => {
        await ContractHelper.deployPolicyManagerContract(owner);

        expect(
          await hre_ethers.provider.getCode(
            ContractHelper.getPolicyManagerContract().address
          )
        ).to.not.equal("0x");
      });

      it("Should initialize protocol with required values", async () => {
        const init = await ContractHelper.initializeProtocol();

        expect(init).to.haveOwnProperty("hash");
      });
    });

    describe("Set new active protocol 0", () => {
      it("Should set new active protocol", async () => {
        await HardhatHelper.setNextBlockTimestamp(0 * 24 * 60 * 60);
        const tx = await ContractHelper.addNewProtocolPool("Test protocol 0");

        expect(tx).to.haveOwnProperty("hash");

        const protocol = await ContractHelper.getProtocolPoolById(0);
        expect(protocol.name).to.equal("Test protocol 0");
      });

      it("Should check slot0", async () => {
        const protocolContract = await ContractHelper.getProtocolPoolContract(
          owner,
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

        expect(availableCapital).to.be.equal("0");
      });

      it("Should check relatedProtocols", async () => {
        const protocolContract = await ContractHelper.getProtocolPoolContract(
          owner,
          0
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
        const tx = await ContractHelper.addNewProtocolPool("Test protocol 1");

        expect(tx).to.haveOwnProperty("hash");

        const protocol = await ContractHelper.getProtocolPoolById(1);
        expect(protocol.name).to.equal("Test protocol 1");
      });

      it("Should check slot0", async () => {
        const protocolContract = await ContractHelper.getProtocolPoolContract(
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
        const protocolContract = await ContractHelper.getProtocolPoolContract(
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
        const tx = await ContractHelper.addNewProtocolPool("Test protocol 2");

        expect(tx).to.haveOwnProperty("hash");

        const protocol = await ContractHelper.getProtocolPoolById(2);
        expect(protocol.name).to.equal("Test protocol 2");
      });

      it("Should check slot0", async () => {
        const protocolContract = await ContractHelper.getProtocolPoolContract(
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
        const protocolContract = await ContractHelper.getProtocolPoolContract(
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
        const ATHENA_CONTRACT = ContractHelper.getAthenaContract();
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
          await ContractHelper.getAthenaContract()
            .connect(owner)
            .getDiscountWithAten(999)
        ).to.equal(0);
        expect(
          await ContractHelper.getAthenaContract()
            .connect(owner)
            .getDiscountWithAten(1000)
        ).to.equal(200);
        expect(
          await ContractHelper.getAthenaContract()
            .connect(owner)
            .getDiscountWithAten(10000000)
        ).to.equal(50);
      });

      it("Should set reward Rates ATEN with USD", async () => {
        const STAKED_ATENS_CONTRACT = ContractHelper.getStakedAtenContract();

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
});
