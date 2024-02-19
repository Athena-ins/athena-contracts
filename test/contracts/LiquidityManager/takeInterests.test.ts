import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {}}

export function LiquidityManager_takeInterests() {
  context("takeInterests", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should revert if called by someone other than the position owner", async function (this: Arguments) {
      const nonOwner = this.signers.account2;
      const positionId = this.args.positionId;  

      expect( await 
        this.contracts.LiquidityManager.connect(nonOwner).takeInterests(
          positionId,
        ),
      ).to.be.revertedWith("OnlyPositionOwner");
    });

    it("should succeed if called by the position owner", async function (this: Arguments) {
      const owner = this.signers.account1;
      const positionId = this.args.positionId;  

      expect( await 
        this.contracts.LiquidityManager.connect(owner).takeInterests(
          positionId,
        ),
      ).to.not.be.reverted;
    });

    it("should correctly update the position's capital and strategy rewards", async function (this: Arguments) {
      const owner = this.signers.account1;
      const positionId = this.args.positionId;  

      const positionBefore =
        await this.contracts.LiquidityManager.positions(positionId);

      await this.contracts.LiquidityManager.connect(owner).takeInterests(
        positionId,
      );

      const positionAfter =
        await this.contracts.LiquidityManager.positions(positionId);

      expect(positionAfter.supplied).to.be.at.least(positionBefore.supplied);
    });

    it("should revert if there's a committed withdrawal for the position", async function (this: Arguments) {
      const owner = this.signers.account1;
      const positionId = this.args.positionId;   where withdrawal is committed

      await this.contracts.LiquidityManager.connect(owner).commitWithdrawal(
        positionId,
      );

      expect( await 
        this.contracts.LiquidityManager.connect(owner).takeInterests(
          positionId,
        ),
      ).to.be.revertedWith("CannotTakeInterestsIfCommittedWithdrawal");
    });

    it("should purge expired covers from the pool", async function (this: Arguments) {
      const owner = this.signers.account1;
      const positionId = this.args.positionId;

      await this.contracts.LiquidityManager.connect(owner).takeInterests(
        positionId,
      );

      const isCoverActiveBefore =
        await this.contracts.LiquidityManager.isCoverActive(coverId);
      expect(isCoverActiveBefore).to.be.true;
      const isCoverActiveAfter =
        await this.contracts.LiquidityManager.isCoverActive(coverId);
      expect(isCoverActiveAfter).to.be.false;
    });

    it("should correctly calculate new user capital and strategy rewards", async function (this: Arguments) {
      const owner = this.signers.account1;
      const positionId = this.args.positionId;  

      const [newUserCapital, strategyRewards] =
        await this.contracts.LiquidityManager.connect(owner).takeInterests(
          positionId,
        );

      const userCapitalBefore =
        await this.contracts.LiquidityManager.positions(positionId).supplied;
      expect(newUserCapital).to.be.greaterThanOrEqual(userCapitalBefore);
      expect(strategyRewards).to.be.a("number").that.is.greaterThan(0);
    });

    it("should correctly update the position's reward index", async function (this: Arguments) {
      const owner = this.signers.account1;
      const positionId = this.args.positionId;  

      const initialRewardIndex =
        await this.contracts.LiquidityManager._posRewardIndex(positionId);

      await this.contracts.LiquidityManager.connect(owner).takeInterests(
        positionId,
      );

      const updatedRewardIndex =
        await this.contracts.LiquidityManager._posRewardIndex(positionId);

      expect(updatedRewardIndex).to.be.greaterThan(initialRewardIndex);
    });

    it("should withdraw interests from the strategy manager", async function (this: Arguments) {
      const owner = this.signers.account1;
      const positionId = this.args.positionId;

      const poolId = this.args.poolId;
      const strategyId = (
        await this.contracts.LiquidityManager.poolInfo(poolId)
      ).strategyId;

      const initialRewards = await this.contracts.StrategyManager.connect(
        owner,
      ).strategyRewards(strategyId, owner.address);

      await this.contracts.LiquidityManager.connect(owner).takeInterests(
        positionId,
      );

      const updatedRewards = await this.contracts.StrategyManager.connect(
        owner,
      ).strategyRewards(strategyId, owner.address);

      expect(updatedRewards).to.be.greaterThan(initialRewards);
    });

    it("should update the position's supplied capital", async function (this: Arguments) {
      const owner = this.signers.account1;
      const positionId = this.args.positionId;

      const initialCapital = (
        await this.contracts.LiquidityManager._positions(positionId)
      ).supplied;

      await this.contracts.LiquidityManager.connect(owner).takeInterests(
        positionId,
      );

      const updatedCapital = (
        await this.contracts.LiquidityManager._positions(positionId)
      ).supplied;

      expect(updatedCapital).to.be.greaterThanOrEqual(initialCapital);
    });

    it("should interact correctly with the position token contract to get the owner of the position", async function (this: Arguments) {
      const positionId = this.args.positionId;
      expect( await this.contracts.LiquidityManager.takeInterests(positionId))
        .to.emit(this.contracts.PositionToken, "OwnerQueried")
        .withArgs(positionId);
    });

    it("should interact correctly with the strategy manager for withdrawing rewards", async function (this: Arguments) {
      const positionId = this.args.positionId;
      const poolId = this.args.poolId;
      const strategyId = (
        await this.contracts.LiquidityManager.poolInfo(poolId)
      ).strategyId;
      expect( await this.contracts.LiquidityManager.takeInterests(positionId))
        .to.emit(this.contracts.StrategyManager, "RewardsWithdrawn")
        .withArgs(strategyId);
    });

    it("should interact correctly with the virtual pool for taking pool interests", async function (this: Arguments) {
      const positionId = this.args.positionId;
      const poolIds = this.args.poolIds;
      for (let i = 0; i < poolIds.length; i++) {
        expect( await this.contracts.LiquidityManager.takeInterests(positionId))
          .to.emit(this.contracts.LiquidityManager, "PoolInterestsTaken")
          .withArgs(poolIds[i], positionId);
      }
    });

    it("should handle cases where the position is involved in multiple pools", async function (this: Arguments) {
      const positionId = this.args.positionId;
      const poolIds = this.args.poolIds;
      for (let i = 0; i < poolIds.length; i++) {
        expect( await this.contracts.LiquidityManager.takeInterests(positionId))
          .to.emit(this.contracts.LiquidityManager, "PoolInterestsTaken")
          .withArgs(poolIds[i], positionId);
      }
    });

    it("should correctly handle the yield bonus", async function (this: Arguments) {
      const positionId = this.args.positionId;
      const yieldBonus = this.args.yieldBonus;

      await this.contracts.LiquidityManager.takeInterests(
        positionId,
        yieldBonus,
      );

      const finalReward =
        await this.contracts.LiquidityManager.getFinalReward(positionId); 
      const expectedRewardWithBonus =
        this.args.initialReward * (1 + yieldBonus / 100);  

      expect(finalReward).to.be.closeTo(expectedRewardWithBonus, 1e-6);  
    });
  });
}
