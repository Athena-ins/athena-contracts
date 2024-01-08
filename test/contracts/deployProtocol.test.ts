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
import { genContractAddress, getCurrentBlockNumber } from "../helpers/hardhat";
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
        await deployAthenaToken(this.signers.deployer, []).then((contract) =>
          postDeployCheck(contract, this.deployedAt.AthenaToken),
        );
      });

      // ======= Managers ======= //

      it("deploys ClaimManager", async function () {
        await deployClaimManager(this.signers.deployer, [
          this.deployedAt.AthenaCoverToken,
          this.deployedAt.LiquidityManager,
          this.deployedAt.MockArbitrator,
          this.signers.deployer.address,
        ]).then((contract) =>
          postDeployCheck(contract, this.deployedAt.ClaimManager),
        );
      });
      it("deploys StrategyManager", async function () {
        await deployStrategyManager(this.signers.deployer, [
          this.deployedAt.LiquidityManager,
        ]).then((contract) =>
          postDeployCheck(contract, this.deployedAt.StrategyManager),
        );
      });
      it("deploys RewardManager", async function () {
        const campaignStartBlock = (await getCurrentBlockNumber()) + 4;
        const rewardManager = await deployRewardManager(this.signers.deployer, [
          this.deployedAt.LiquidityManager,
          this.deployedAt.AthenaPositionToken,
          this.deployedAt.AthenaCoverToken,
          this.deployedAt.AthenaToken,
          campaignStartBlock,
          [],
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
          this.deployedAt.StrategyManager,
          this.deployedAt.ClaimManager,
        ]).then((contract) =>
          postDeployCheck(contract, this.deployedAt.LiquidityManager),
        );
      });

      // ======= DAO ======= //

      it("deploys EcclesiaDao", async function () {
        await deployEcclesiaDao(this.signers.deployer, [
          this.deployedAt.AthenaToken,
          this.deployedAt.Staking,
          this.deployedAt.LiquidityManager,
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

        expect(Object.keys(contracts).length).to.equal(12);

        for (const contract of Object.values(contracts)) {
          expect((await ethers.provider.getCode(contract.address)).length).gt(
            2,
          );
        }
      });
    });
  });
}
