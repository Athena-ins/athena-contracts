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
} from "../helpers/deployers";
import { genContractAddress, getCurrentBlockNumber } from "../helpers/hardhat";
// Types
import { BaseContract } from "ethers";

export function deployProtocolTest() {
  describe("Setup protocol", function () {
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

      this.deployedAt = {};

      await Promise.all(
        deploymentOrder.map((name, i) =>
          genContractAddress(hre, this.signers.deployer.address, i).then(
            (address) => {
              this.deployedAt[name] = address;
            },
          ),
        ),
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

    context("Deploy contracts", function () {
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
    });
  });
}
