import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function LiquidityManager_payoutClaim() {
  context("payoutClaim", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    describe("payoutClaim", function (this: Arguments) {
      it("should revert if called by a non-claim manager", async function (this: Arguments) {
        // Simulate call by a non-claim manager
        expect(
          await this.contracts.LiquidityManager.connect(
            this.signers.nonClaimManager,
          ).payoutClaim(this.args.coverId, this.args.compensationAmount),
        ).to.be.revertedWith("OnlyClaimManager");
      });

      it("should succeed if called by the claim manager", async function (this: Arguments) {
        // Simulate call by the claim manager
        expect(
          await this.contracts.LiquidityManager.connect(
            this.signers.claimManager,
          ).payoutClaim(this.args.coverId, this.args.compensationAmount),
        ).to.not.be.reverted;
      });

      it("should revert if the compensation ratio is above the pool's capacity", async function (this: Arguments) {
        // Setup a scenario where the compensation amount exceeds the pool's capacity
        const poolId = await this.contracts.LiquidityManager.coverPoolId(
          this.args.coverId,
        );
        const poolInfo =
          await this.contracts.TestableVirtualPool.poolInfo(poolId);
        const poolCapacity = await poolInfo.totalLiquidity();
        const excessiveCompensation = poolCapacity.add(1);

        expect(
          await this.contracts.LiquidityManager.connect(
            this.signers.claimManager,
          ).payoutClaim(this.args.coverId, excessiveCompensation),
        ).to.be.revertedWith("RatioAbovePoolCapacity");
      });

      describe("Compensation Calculation and Distribution", function (this: Arguments) {
        it("should calculate the correct compensation ratio", async function (this: Arguments) {
          const poolId = await this.contracts.LiquidityManager.coverPoolId(
            this.args.coverId,
          );
          const poolInfoBefore =
            await this.contracts.TestableVirtualPool.poolInfo(poolId);
          const totalLiquidityBefore = poolInfoBefore.totalLiquidity;
          const expectedRatio =
            this.args.compensationAmount.rayDiv(totalLiquidityBefore);

          await this.contracts.LiquidityManager.connect(
            this.signers.claimManager,
          ).payoutClaim(this.args.coverId, this.args.compensationAmount);

          const compensation =
            await this.contracts.LiquidityManager.compensations(
              this.args.compensationId,
            );
          expect(compensation.ratio).to.equal(expectedRatio);
        });

        it("should reduce the liquidity in affected pools correctly", async function (this: Arguments) {
          const poolId = await this.contracts.LiquidityManager.coverPoolId(
            this.args.coverId,
          );
          const poolInfoBefore =
            await this.contracts.TestableVirtualPool.poolInfo(poolId);
          const totalLiquidityBefore = poolInfoBefore.totalLiquidity;
          const expectedLiquidityAfter = totalLiquidityBefore.sub(
            this.args.compensationAmount,
          );

          await this.contracts.LiquidityManager.connect(
            this.signers.claimManager,
          ).payoutClaim(this.args.coverId, this.args.compensationAmount);

          const poolInfoAfter =
            await this.contracts.TestableVirtualPool.poolInfo(poolId);
          expect(poolInfoAfter.totalLiquidity).to.equal(expectedLiquidityAfter);
        });

        it("should update pool pricing after liquidity change", async function (this: Arguments) {
          const poolId = await this.contracts.LiquidityManager.coverPoolId(
            this.args.coverId,
          );
          const poolInfoBefore =
            await this.contracts.TestableVirtualPool.poolInfo(poolId);

          await this.contracts.LiquidityManager.connect(
            this.signers.claimManager,
          ).payoutClaim(this.args.coverId, this.args.compensationAmount);

          const poolInfoAfter =
            await this.contracts.TestableVirtualPool.poolInfo(poolId);
          expect(poolInfoAfter.slot0.secondsPerTick).to.not.equal(
            poolInfoBefore.slot0.secondsPerTick,
          );
        });

        it("should register the compensation ID and its related data correctly", async function (this: Arguments) {
          await this.contracts.LiquidityManager.connect(
            this.signers.claimManager,
          ).payoutClaim(this.args.coverId, this.args.compensationAmount);

          const compensation =
            await this.contracts.LiquidityManager.compensations(
              this.args.compensationId,
            );
          expect(compensation.fromPoolId).to.equal(this.args.poolId);
          expect(compensation.ratio).to.exist;
          expect(compensation.rewardIndexBeforeClaim).to.exist;
        });

        it("should update the cover amount for non-expired covers", async function (this: Arguments) {
          const coverInfoBefore =
            await this.contracts.TestableVirtualPool.coverPremiums(
              this.args.poolId,
              this.args.coverId,
            );
          await this.contracts.LiquidityManager.connect(
            this.signers.claimManager,
          ).payoutClaim(this.args.coverId, this.args.compensationAmount);
          const coverInfoAfter =
            await this.contracts.TestableVirtualPool.coverPremiums(
              this.args.poolId,
              this.args.coverId,
            );
          expect(coverInfoAfter.coverAmount).to.equal(
            coverInfoBefore.coverAmount.sub(this.args.compensationAmount),
          );
        });

        it("should handle failed cover updates due to insufficient liquidity", async function (this: Arguments) {
          await this.contracts.TestableVirtualPool.setAvailableLiquidity(
            this.args.poolId,
            0,
          );
          expect(
            await this.contracts.LiquidityManager.connect(
              this.signers.claimManager,
            ).payoutClaim(this.args.coverId, this.args.compensationAmount),
          ).to.be.revertedWith("InsufficientLiquidityForCover");
        });

        it("should expire the cover if updating it fails", async function (this: Arguments) {
          await this.contracts.TestableVirtualPool.setAvailableLiquidity(
            this.args.poolId,
            0,
          );
          await this.contracts.LiquidityManager.connect(
            this.signers.claimManager,
          ).payoutClaim(this.args.coverId, this.args.compensationAmount);
          const isCoverActive =
            await this.contracts.TestableVirtualPool.isCoverActive(
              this.args.coverId,
            );
          expect(isCoverActive).to.be.false;
        });
      });

      it("should pay out the compensation from the strategy to the claimant", async function (this: Arguments) {
        const claimantBalanceBefore =
          await this.contracts.TestableVirtualPool.paymentAsset.balanceOf(
            this.signers.claimant.address,
          );
        await this.contracts.LiquidityManager.connect(
          this.signers.claimManager,
        ).payoutClaim(this.args.coverId, this.args.compensationAmount);
        const claimantBalanceAfter =
          await this.contracts.TestableVirtualPool.paymentAsset.balanceOf(
            this.signers.claimant.address,
          );
        expect(claimantBalanceAfter).to.equal(
          claimantBalanceBefore.add(this.args.compensationAmount),
        );
      });

      describe("Edge Cases and External Contracts Interaction", function (this: Arguments) {
        it("should handle invalid coverId_ values correctly", async function (this: Arguments) {
          const invalidCoverId = this.args.nextCoverId.add(1); // Assuming nextCoverId is the last valid coverId
          expect(
            await this.contracts.LiquidityManager.connect(
              this.signers.claimManager,
            ).payoutClaim(invalidCoverId, this.args.compensationAmount),
          ).to.be.revertedWith("CoverDoesNotExist"); // Replace with the correct error message
        });

        it("should interact correctly with ERC20 safeTransfer for returning premiums", async function (this: Arguments) {
          const initialBalance =
            await this.contracts.TestableVirtualPool.paymentAsset.balanceOf(
              this.signers.claimant.address,
            );
          await this.contracts.LiquidityManager.connect(
            this.signers.claimManager,
          ).payoutClaim(this.args.coverId, this.args.compensationAmount);
          const finalBalance =
            await this.contracts.TestableVirtualPool.paymentAsset.balanceOf(
              this.signers.claimant.address,
            );
          expect(finalBalance.sub(initialBalance)).to.equal(
            this.args.premiumsReturned,
          ); // Assuming premiumsReturned is the amount of premiums returned
        });

        it("should interact correctly with the strategy manager for payout", async function (this: Arguments) {
          const initialStrategyBalance =
            await this.contracts.TestableVirtualPool.paymentAsset.balanceOf(
              this.contracts.StrategyManager.address,
            );
          await this.contracts.LiquidityManager.connect(
            this.signers.claimManager,
          ).payoutClaim(this.args.coverId, this.args.compensationAmount);
          const finalStrategyBalance =
            await this.contracts.TestableVirtualPool.paymentAsset.balanceOf(
              this.contracts.StrategyManager.address,
            );
          expect(initialStrategyBalance.sub(finalStrategyBalance)).to.equal(
            this.args.compensationAmount,
          );
        });
      });
    });
  });
}
