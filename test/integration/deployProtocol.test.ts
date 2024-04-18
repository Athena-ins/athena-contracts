import { expect } from "chai";
import hre, { ethers } from "hardhat";
// Helpers
import {
  deploymentOrder,
  //
  deployMockArbitrator,
  deployAthenaCoverToken,
  deployAthenaPositionToken,
  deployAthenaToken,
  deployClaimManager,
  deployEcclesiaDao,
  deployLiquidityManager,
  deployRewardManager,
  deployStrategyManager,
  deployAllContractsAndInitializeProtocol,
  deployPoolMath,
  deployVirtualPool,
  deployAthenaDataProvider,
} from "../helpers/deployers";
import {
  genContractAddress,
  getCurrentBlockNumber,
  postTxHandler,
} from "../helpers/hardhat";
import { AthenaToken__factory } from "../../typechain";
// Types
import { BaseContract } from "ethers";

interface Arguments extends Omit<Mocha.Context, "contracts"> {
  args: {
    deployedAt: { [key: string]: string };
  };
}

export function deployProtocol() {
  context("Setup protocol", function () {
    before(async function (this: Arguments) {
      this.args = {
        deployedAt: {},
      };

      await Promise.all(
        deploymentOrder.map((name, i) =>
          genContractAddress(this.signers.deployer, i).then(
            (address: string) => {
              this.args.deployedAt[name] = address;
            },
          ),
        ),
      );

      await genContractAddress(this.args.deployedAt.RewardManager, 1).then(
        (address) => (this.args.deployedAt.FarmingRange = address),
      );
      await genContractAddress(this.args.deployedAt.RewardManager, 2).then(
        (address) => (this.args.deployedAt.Staking = address),
      );
    });

    /**
     * After a deploy checks the address matches the expect one
     * and that the address holds code
     */
    async function postDeployCheck(
      contract: BaseContract,
      expectedAddress: any,
    ) {
      expect(contract.address.toLowerCase()).to.equal(
        expectedAddress.toLowerCase(),
      );
      expect((await ethers.provider.getCode(contract.address)).length).gt(2);
    }

    describe("Single contracts", function () {
      // ======= Tokens ======= //

      it("deploys AthenaCoverToken", async function (this: Arguments) {
        await deployAthenaCoverToken(this.signers.deployer, [
          this.args.deployedAt.LiquidityManager,
        ]).then((contract) =>
          postDeployCheck(contract, this.args.deployedAt.AthenaCoverToken),
        );
      });

      it("deploys AthenaPositionToken", async function (this: Arguments) {
        await deployAthenaPositionToken(this.signers.deployer, [
          this.args.deployedAt.LiquidityManager,
        ]).then((contract) =>
          postDeployCheck(contract, this.args.deployedAt.AthenaPositionToken),
        );
      });

      it("deploys AthenaToken", async function (this: Arguments) {
        await deployAthenaToken(this.signers.deployer, [
          [this.args.deployedAt.EcclesiaDao, this.args.deployedAt.Staking],
        ]).then((contract) =>
          postDeployCheck(contract, this.args.deployedAt.AthenaToken),
        );
      });

      // ======= Approve for DAO lock ======= //

      it("approves minimal DAO lock", async function (this: Arguments) {
        // Approve for initial minimal DAO lock
        await postTxHandler(
          AthenaToken__factory.connect(
            this.args.deployedAt.AthenaToken,
            this.signers.deployer,
          ).approve(
            this.args.deployedAt.EcclesiaDao,
            ethers.utils.parseEther("1"),
          ),
        );
      });

      // ======= Libs ======= //

      it("deploys PoolMath", async function (this: Arguments) {
        await deployPoolMath(this.signers.deployer, []).then((contract) =>
          postDeployCheck(contract, this.args.deployedAt.PoolMath),
        );
      });

      it("deploys VirtualPool", async function (this: Arguments) {
        await deployVirtualPool(this.signers.deployer, [], {
          PoolMath: this.args.deployedAt.PoolMath,
        }).then((contract) =>
          postDeployCheck(contract, this.args.deployedAt.VirtualPool),
        );
      });

      it("deploys AthenaDataProvider", async function (this: Arguments) {
        await deployAthenaDataProvider(this.signers.deployer, [], {
          PoolMath: this.args.deployedAt.PoolMath,
          VirtualPool: this.args.deployedAt.VirtualPool,
        }).then((contract) =>
          postDeployCheck(contract, this.args.deployedAt.AthenaDataProvider),
        );
      });

      // ======= Managers ======= //

      it("deploys ClaimManager", async function (this: Arguments) {
        await deployClaimManager(this.signers.deployer, [
          this.args.deployedAt.AthenaCoverToken, // IAthenaCoverToken coverToken_
          this.args.deployedAt.LiquidityManager, // ILiquidityManager liquidityManager_
          this.args.deployedAt.MockArbitrator, // IArbitrator arbitrator_
          this.signers.evidenceGuardian.address, // address metaEvidenceGuardian_
          this.signers.leverageRiskWallet.address, // address leverageRiskWallet_
          this.protocolConfig.subcourtId, // uint256 subcourtId_
          this.protocolConfig.nbOfJurors, // uint256 nbOfJurors_
        ]).then((contract) =>
          postDeployCheck(contract, this.args.deployedAt.ClaimManager),
        );
      });

      it("deploys StrategyManager", async function (this: Arguments) {
        await deployStrategyManager(this.signers.deployer, [
          this.args.deployedAt.LiquidityManager,
          this.args.deployedAt.EcclesiaDao,
          this.signers.buybackWallet.address,
          this.protocolConfig.payoutDeductibleRate,
          this.protocolConfig.performanceFee,
        ]).then((contract) =>
          postDeployCheck(contract, this.args.deployedAt.StrategyManager),
        );
      });

      it("deploys LiquidityManager", async function (this: Arguments) {
        await deployLiquidityManager(
          this.signers.deployer,
          [
            this.args.deployedAt.AthenaPositionToken,
            this.args.deployedAt.AthenaCoverToken,
            this.args.deployedAt.EcclesiaDao,
            this.args.deployedAt.StrategyManager,
            this.args.deployedAt.ClaimManager,
            this.args.deployedAt.FarmingRange,
            this.protocolConfig.withdrawDelay,
            this.protocolConfig.maxLeverage,
            this.protocolConfig.leverageFeePerPool,
          ],
          {
            VirtualPool: this.args.deployedAt.VirtualPool,
            AthenaDataProvider: this.args.deployedAt.AthenaDataProvider,
          },
        ).then((contract) =>
          postDeployCheck(contract, this.args.deployedAt.LiquidityManager),
        );
      });

      it("deploys RewardManager", async function (this: Arguments) {
        const campaignStartBlock = (await getCurrentBlockNumber()) + 4;
        const rewardManager = await deployRewardManager(this.signers.deployer, [
          this.args.deployedAt.LiquidityManager,
          this.args.deployedAt.EcclesiaDao,
          this.args.deployedAt.AthenaPositionToken,
          this.args.deployedAt.AthenaCoverToken,
          this.args.deployedAt.AthenaToken,
          campaignStartBlock,
          this.protocolConfig.yieldBonuses,
        ]);
        await postDeployCheck(
          rewardManager,
          this.args.deployedAt.RewardManager,
        );

        // Required for DAO & Liquidity Manager contract
        this.args.deployedAt.Staking = await rewardManager.staking();
        this.args.deployedAt.FarmingRange = await rewardManager.farming();
      });

      // ======= DAO ======= //

      it("deploys EcclesiaDao", async function (this: Arguments) {
        await deployEcclesiaDao(this.signers.deployer, [
          this.args.deployedAt.AthenaToken,
          this.args.deployedAt.Staking,
          this.args.deployedAt.LiquidityManager,
          this.args.deployedAt.StrategyManager,
          this.signers.treasuryWallet.address,
          this.signers.leverageRiskWallet.address,
        ]).then((contract) =>
          postDeployCheck(contract, this.args.deployedAt.EcclesiaDao),
        );
      });

      // ======= Claims ======= //

      it("deploys MockArbitrator", async function (this: Arguments) {
        await deployMockArbitrator(this.signers.deployer, [
          ethers.utils.parseEther("0.05"),
        ]).then((contract) =>
          postDeployCheck(contract, this.args.deployedAt.MockArbitrator),
        );
      });
    });

    // ======= Whole protocol ======= //

    describe("Protocol", function () {
      it("deploys the protocol", async function (this: Arguments) {
        const contracts = await deployAllContractsAndInitializeProtocol(
          this.signers.deployer,
          this.protocolConfig,
        );

        expect(Object.keys(contracts).length).to.equal(14);

        for (const contract of Object.values(contracts)) {
          expect((await ethers.provider.getCode(contract.address)).length).gt(
            2,
          );
        }
      });
    });
  });
}
