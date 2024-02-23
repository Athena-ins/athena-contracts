import { expect } from "chai";
import hre, { ethers } from "hardhat";
// Helpers
import {
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
} from "../helpers/deployers";
import {
  genContractAddress,
  getCurrentBlockNumber,
  postTxHandler,
} from "../helpers/hardhat";
import { toRay } from "../helpers/protocol";
// Types
import { BaseContract } from "ethers";

export function deployProtocol() {
  context("Setup protocol", function () {
    before(async function () {
      const deploymentOrder = [
        "AthenaCoverToken",
        "AthenaPositionToken",
        "AthenaToken",
        "ClaimManager",
        "StrategyManager",
        "RewardManager",
        "LiquidityManager",
        "_approve",
        "EcclesiaDao",
        "MockArbitrator",
      ];

      this.deployedAt = await deploymentOrder.reduce(
        (acc, name, i) =>
          genContractAddress(this.signers.deployer, i).then(
            async (address) => ({
              ...(await acc),
              [name]: address,
            }),
          ),
        {} as Promise<{ [name: string]: string }>,
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

      it("deploys AthenaCoverToken", async function () {
        await deployAthenaCoverToken(this.signers.deployer, [
          this.deployedAt.LiquidityManager,
        ]).then((contract) =>
          postDeployCheck(contract, this.deployedAt.AthenaCoverToken),
        );
      });
      it("deploys AthenaPositionToken", async function () {
        await deployAthenaPositionToken(this.signers.deployer, [
          this.deployedAt.LiquidityManager,
        ]).then((contract) =>
          postDeployCheck(contract, this.deployedAt.AthenaPositionToken),
        );
      });
      it("deploys AthenaToken", async function () {
        await deployAthenaToken(this.signers.deployer, [
          [this.deployedAt.EcclesiaDao],
        ]).then((contract) =>
          postDeployCheck(contract, this.deployedAt.AthenaToken),
        );
      });

      // ======= Managers ======= //

      it("deploys ClaimManager", async function () {
        await deployClaimManager(this.signers.deployer, [
          this.deployedAt.AthenaCoverToken, // IAthenaCoverToken coverToken_
          this.deployedAt.LiquidityManager, // ILiquidityManager liquidityManager_
          this.deployedAt.MockArbitrator, // IArbitrator arbitrator_
          this.signers.evidenceGuardian.address, // address metaEvidenceGuardian_
          this.signers.leverageRiskWallet.address, // address leverageRiskWallet_
          this.protocolConfig.subcourtId, // uint256 subcourtId_
          this.protocolConfig.nbOfJurors, // uint256 nbOfJurors_
        ]).then((contract) =>
          postDeployCheck(contract, this.deployedAt.ClaimManager),
        );
      });
      it("deploys StrategyManager", async function () {
        await deployStrategyManager(this.signers.deployer, [
          this.deployedAt.LiquidityManager,
          this.deployedAt.EcclesiaDao,
          this.signers.buybackWallet.address,
          this.protocolConfig.payoutDeductibleRate,
          this.protocolConfig.performanceFee,
        ]).then((contract) =>
          postDeployCheck(contract, this.deployedAt.StrategyManager),
        );
      });
      it("deploys RewardManager", async function () {
        const campaignStartBlock = (await getCurrentBlockNumber()) + 4;
        const rewardManager = await deployRewardManager(this.signers.deployer, [
          this.deployedAt.LiquidityManager,
          this.deployedAt.EcclesiaDao,
          this.deployedAt.AthenaPositionToken,
          this.deployedAt.AthenaCoverToken,
          this.deployedAt.AthenaToken,
          campaignStartBlock,
          this.protocolConfig.yieldBonuses,
        ]);
        await postDeployCheck(rewardManager, this.deployedAt.RewardManager);

        // Required for DAO & Liquidity Manager contract
        this.deployedAt.Staking = await rewardManager.staking();
      });
      it("deploys LiquidityManager", async function () {
        await deployLiquidityManager(this.signers.deployer, [
          this.deployedAt.AthenaPositionToken,
          this.deployedAt.AthenaCoverToken,
          this.deployedAt.Staking,
          this.deployedAt.FarmingRange,
          this.deployedAt.EcclesiaDao,
          this.deployedAt.StrategyManager,
          this.deployedAt.ClaimManager,
          this.protocolConfig.withdrawDelay,
          this.protocolConfig.maxLeverage,
          this.protocolConfig.leverageFeePerPool,
        ]).then((contract) =>
          postDeployCheck(contract, this.deployedAt.LiquidityManager),
        );
      });

      // ======= DAO ======= //

      it("deploys EcclesiaDao", async function () {
        // Approve for initial minimal DAO lock
        await postTxHandler(
          this.contracts.AthenaToken.connect(this.signers.deployer).approve(
            this.deployedAt.EcclesiaDao,
            ethers.utils.parseEther("1"),
          ),
        );

        await deployEcclesiaDao(this.signers.deployer, [
          this.deployedAt.AthenaToken,
          this.deployedAt.Staking,
          this.deployedAt.LiquidityManager,
          this.deployedAt.StrategyManager,
          this.signers.treasuryWallet.address,
          this.signers.leverageRiskWallet.address,
        ]).then((contract) =>
          postDeployCheck(contract, this.deployedAt.EcclesiaDao),
        );
      });

      // ======= Claims ======= //

      it("deploys MockArbitrator", async function () {
        await deployMockArbitrator(this.signers.deployer, [
          ethers.utils.parseEther("0.05"),
        ]).then((contract) =>
          postDeployCheck(contract, this.deployedAt.MockArbitrator),
        );
      });

      // ======= Whole protocol ======= //
    });

    describe("Protocol", function () {
      it("deploys the protocol", async function () {
        const contracts = await deployAllContractsAndInitializeProtocol(
          this.signers.deployer,
          this.protocolConfig,
        );

        expect(Object.keys(contracts).length).to.equal(13);

        for (const contract of Object.values(contracts)) {
          expect((await ethers.provider.getCode(contract.address)).length).gt(
            2,
          );
        }
      });
    });
  });
}
