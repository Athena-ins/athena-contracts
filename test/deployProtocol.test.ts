import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "./helpers/HardhatHelper";
import ProtocolHelper from "./helpers/ProtocolHelper";

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
        await ProtocolHelper.deployAthenaContract(owner);

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

      it("Should deploy StakedAtensPolicy contract", async () => {
        await ProtocolHelper.deployStakedAtensPolicyContract(owner);

        expect(
          await hre_ethers.provider.getCode(
            ProtocolHelper.getStakedAtensPolicyContract().address
          )
        ).to.not.equal("0x");
      });

      it("Should deploy VaultAtens contract", async () => {
        await ProtocolHelper.deployVaultAtenContract(owner);

        expect(
          await hre_ethers.provider.getCode(
            ProtocolHelper.getVaultAtenContract().address
          )
        ).to.not.equal("0x");
      });

      it("Should deploy ClaimManager contract", async () => {
        await ProtocolHelper.deployClaimManagerContract(owner);

        expect(
          await hre_ethers.provider.getCode(
            ProtocolHelper.getClaimManagerContract().address
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
          0
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(0);
        expect(slot0.secondsPerTick).to.be.equal("86400");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal("0");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const premiumRate = await protocolContract.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("1000000000000000000000000000");

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal("0");
      });

      it("Should check relatedProtocols", async () => {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
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
        expect(slot0.secondsPerTick).to.be.equal("86400");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal("0");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const premiumRate = await protocolContract.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("1000000000000000000000000000");

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
        expect(slot0.secondsPerTick).to.be.equal("86400");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal("0");
        expect(slot0.lastUpdateTimestamp).to.be.equal(
          HardhatHelper.getCurrentTime()
        );

        const premiumRate = await protocolContract.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("1000000000000000000000000000");

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
        const ATHENA_CONTRACT = ProtocolHelper.getAthenaContract();
        const tx = await ProtocolHelper.setDiscountWithAten(owner);

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
          await ProtocolHelper.getAthenaContract()
            .connect(owner)
            .getDiscountWithAten(999)
        ).to.equal(0);
        expect(
          await ProtocolHelper.getAthenaContract()
            .connect(owner)
            .getDiscountWithAten(1000)
        ).to.equal(200);
        expect(
          await ProtocolHelper.getAthenaContract()
            .connect(owner)
            .getDiscountWithAten(10000000)
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

        const tx = await ProtocolHelper.setStakeRewards(owner);

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
