import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

export function testDeployProtocol() {
  describe("Setup protocol", function () {
    before(async function () {});

    describe("Contract deployment", function () {
      const contractList = [
        "ATEN",
        "CentralizedArbitrator",
        "Athena",
        "ProtocolFactory",
        "PriceOracleV1",
        "TokenVault",
        "PositionsManager",
        "PolicyManager",
        "ClaimManager",
        "StakingGeneralPool",
        "StakingPolicy",
      ] as const;

      for (const contractName of contractList) {
        it(`deployed ${contractName}`, async function () {
          const { address } = this.contracts[contractName];
          const code = await hre_ethers.provider.getCode(address);
          expect(code).not.equal("0x");
          expect(code.length).gt(2);
        });
      }
    });

    describe("Contract setup", function () {
      // @bw should check that all addresses & configs match and are corretly set
      // either in constructor or in config/init fns
    });

    describe("Set new active protocol 0", function () {
      it("Should set new active protocol", async function () {
        await setNextBlockTimestamp(0 * 24 * 60 * 60);
        const tx = await ProtocolHelper.addNewProtocolPool("Test protocol 0");

        expect(tx).to.haveOwnProperty("hash");

        const protocol = await ProtocolHelper.getProtocolPoolDataById(0);
        expect(protocol.name).to.equal("Test protocol 0");
      });

      it("Should check slot0", async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0,
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(0);
        expect(slot0.secondsPerTick).to.be.equal("86400");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal("0");
        expect(slot0.lastUpdateTimestamp).to.be.equal(await getCurrentTime());

        const premiumRate = await protocolContract.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("1000000000000000000000000000");

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal("0");
      });

      it("Should check relatedProtocols", async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          0,
        );

        const relatedProtocol = await protocolContract.relatedProtocols(0);

        expect(relatedProtocol).to.be.equal(0);

        const intersectingAmounts =
          await protocolContract.intersectingAmounts(0);

        expect(intersectingAmounts).to.be.equal(0);
      });
    });

    describe("Set new active protocol 1", function () {
      it("Should set new active protocol", async function () {
        await setNextBlockTimestamp(1 * 24 * 60 * 60);
        const tx = await ProtocolHelper.addNewProtocolPool("Test protocol 1");

        expect(tx).to.haveOwnProperty("hash");

        const protocol = await ProtocolHelper.getProtocolPoolDataById(1);
        expect(protocol.name).to.equal("Test protocol 1");
      });

      it("Should check slot0", async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          1,
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(0);
        expect(slot0.secondsPerTick).to.be.equal("86400");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal("0");
        expect(slot0.lastUpdateTimestamp).to.be.equal(await getCurrentTime());

        const premiumRate = await protocolContract.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("1000000000000000000000000000");

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal("0");
      });

      it("Should check relatedProtocols", async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          1,
        );

        const relatedProtocol = await protocolContract.relatedProtocols(0);

        expect(relatedProtocol).to.be.equal(1);

        const intersectingAmounts =
          await protocolContract.intersectingAmounts(0);

        expect(intersectingAmounts).to.be.equal(0);
      });
    });

    describe("Set new active protocol 2", function () {
      it("Should set new active protocol", async function () {
        await setNextBlockTimestamp(1 * 24 * 60 * 60);
        const tx = await ProtocolHelper.addNewProtocolPool("Test protocol 2");

        expect(tx).to.haveOwnProperty("hash");

        const protocol = await ProtocolHelper.getProtocolPoolDataById(2);
        expect(protocol.name).to.equal("Test protocol 2");
      });

      it("Should check slot0", async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          2,
        );
        const slot0 = await protocolContract.slot0();

        expect(slot0.tick).to.be.equal(0);
        expect(slot0.secondsPerTick).to.be.equal("86400");
        expect(slot0.totalInsuredCapital).to.be.equal("0");
        expect(slot0.remainingPolicies).to.be.equal("0");
        expect(slot0.lastUpdateTimestamp).to.be.equal(await getCurrentTime());

        const premiumRate = await protocolContract.getCurrentPremiumRate();
        expect(premiumRate).to.be.equal("1000000000000000000000000000");

        const availableCapital = await protocolContract.availableCapital();

        expect(availableCapital).to.be.equal("0");
      });

      it("Should check relatedProtocols", async function () {
        const protocolContract = await ProtocolHelper.getProtocolPoolContract(
          owner,
          2,
        );

        const relatedProtocol = await protocolContract.relatedProtocols(0);

        expect(relatedProtocol).to.be.equal(2);

        const intersectingAmounts =
          await protocolContract.intersectingAmounts(0);

        expect(intersectingAmounts).to.be.equal(0);
      });
    });

    describe("Set discounts with Aten", function () {
      it("Should set discounts with Aten", async function () {
        const tx = await ProtocolHelper.setFeeLevelsWithAten(owner);

        expect(tx).to.haveOwnProperty("hash");

        const discountZero =
          await STAKING_GP_CONTRACT.connect(owner).supplyFeeLevels(0);
        expect(discountZero.atenAmount).to.equal(BN(0));
        expect(discountZero.feeRate).to.equal(BN(250));

        const discountFirst =
          await STAKING_GP_CONTRACT.connect(owner).supplyFeeLevels(1);
        expect(discountFirst.atenAmount).to.equal(BN(1_000));
        expect(discountFirst.feeRate).to.equal(BN(200));

        const discountSnd =
          await STAKING_GP_CONTRACT.connect(owner).supplyFeeLevels(2);
        expect(discountSnd.atenAmount).to.equal(BN(100_000));
        expect(discountSnd.feeRate).to.equal(BN(150));

        const discountThird =
          await STAKING_GP_CONTRACT.connect(owner).supplyFeeLevels(3);
        expect(discountThird.atenAmount).to.equal(BN(1_000_000));
        expect(discountThird.feeRate).to.equal(BN(50));

        await expect(
          STAKING_GP_CONTRACT.connect(owner).supplyFeeLevels(4),
        ).to.be.rejectedWith();
      });

      it("Should get discount amount with Aten", async function () {
        expect(
          await STAKING_GP_CONTRACT.connect(owner).getFeeRateWithAten(999),
        ).to.equal(250);
        expect(
          await STAKING_GP_CONTRACT.connect(owner).getFeeRateWithAten(1000),
        ).to.equal(200);
        expect(
          await STAKING_GP_CONTRACT.connect(owner).getFeeRateWithAten(10000000),
        ).to.equal(50);
      });

      it("Should set reward Rates ATEN with USD", async function () {
        await expect(
          STAKING_GP_CONTRACT.connect(owner).setStakingRewardRates([
            { amountSupplied: 0, aprStaking: 1_000 },
            { amountSupplied: 100_000, aprStaking: 1_600 },
            { amountSupplied: 10_000, aprStaking: 1_200 },
            { amountSupplied: 1_000_000, aprStaking: 2_000 },
          ]),
        ).to.be.rejectedWith("MustSortInAscendingOrder()");

        const tx = await ProtocolHelper.setStakingRewardRates(owner);

        expect(tx).to.haveOwnProperty("hash");

        expect(
          await STAKING_GP_CONTRACT.connect(owner).getStakingRewardRate(0),
        ).to.equal(BN(1_000));

        expect(
          await STAKING_GP_CONTRACT.connect(owner).getStakingRewardRate(10),
        ).to.equal(BN(1000));

        expect(
          await STAKING_GP_CONTRACT.connect(owner).getStakingRewardRate(10000),
        ).to.equal(BN(1200));

        expect(
          await STAKING_GP_CONTRACT.connect(owner).getStakingRewardRate(
            100_001,
          ),
        ).to.equal(BN(1600));

        expect(
          await STAKING_GP_CONTRACT.connect(owner).getStakingRewardRate(
            1_000_000,
          ),
        ).to.equal(BN(2000));

        const stakingLevels =
          await STAKING_GP_CONTRACT.connect(owner).getStakingRewardsLevels();

        expect(stakingLevels.length).to.equal(4);
      });
    });

    // @bw should move to views tests
    describe("View all array data", function () {
      it("Should get all pool data", async function () {
        const poolData = await ATHENA_CONTRACT.getAllProtocols();

        expect(poolData.length).to.equal(3);
      });

      it("Should get all fee level data", async function () {
        const feeLevels =
          await STAKING_GP_CONTRACT.connect(owner).getSupplyFeeLevels();

        expect(feeLevels.length).to.equal(4);
      });

      it("Should get all staking levels data", async function () {
        const stakingLevels =
          await STAKING_GP_CONTRACT.connect(owner).getStakingRewardsLevels();

        expect(stakingLevels.length).to.equal(4);
      });
    });
  });
}
