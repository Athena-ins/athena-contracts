import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function LiquidityManager_takeInterestsWithYieldBonus() {
  context("takeInterestsWithYieldBonus", function () {
    before(async function () {
      this.args = {};
    });

    it("should process interests with yield bonus for a valid account and existing position IDs", async function () {
      const initialRewardIndices = await Promise.all(
        this.args.existingPositionIds.map(async (id) => {
          return await this.contracts.LiquidityManager.posRewardIndex(id);
        }),
      );

      await this.contracts.LiquidityManager.takeInterestsWithYieldBonus(
        this.args.validAccount,
        this.args.yieldBonus,
        this.args.existingPositionIds,
      );

      const finalRewardIndices = await Promise.all(
        this.args.existingPositionIds.map(async (id) => {
          return await this.contracts.LiquidityManager.posRewardIndex(id);
        }),
      );

      for (let i = 0; i < this.args.existingPositionIds.length; i++) {
        expect(finalRewardIndices[i]).to.be.above(initialRewardIndices[i]);
      }
    });

    it("should handle an empty array of position IDs without error for a valid account and yield bonus", async function () {
      const initialRewardIndex =
        await this.contracts.LiquidityManager.posRewardIndex(samplePositionId); // Assuming a sample position ID is available

      await this.contracts.LiquidityManager.takeInterestsWithYieldBonus(
        this.args.validAccount,
        this.args.yieldBonus,
        [],
      );

      const finalRewardIndex =
        await this.contracts.LiquidityManager.posRewardIndex(samplePositionId);

      expect(finalRewardIndex).to.equal(initialRewardIndex);
    });

    it("should handle non-existent position IDs without error for a valid account and yield bonus", async function () {
      const initialRewardIndex =
        await this.contracts.LiquidityManager.posRewardIndex(samplePositionId); // Assuming a sample position ID is available

      await this.contracts.LiquidityManager.takeInterestsWithYieldBonus(
        this.args.validAccount,
        this.args.yieldBonus,
        this.args.nonExistentPositionIds,
      );

      const finalRewardIndex =
        await this.contracts.LiquidityManager.posRewardIndex(samplePositionId);

      expect(finalRewardIndex).to.equal(initialRewardIndex);
    });

      it("should handle position IDs where some positions do not belong to the account", async function() {
        const initialRewardIndices = await Promise.all(this.args.mixedOwnershipPositionIds.map(async (id) => {
            return await this.contracts.LiquidityManager.posRewardIndex(id);
        }));

        await this.contracts.LiquidityManager.takeInterestsWithYieldBonus(this.args.validAccount, this.args.yieldBonus, this.args.mixedOwnershipPositionIds);

        const finalRewardIndices = await Promise.all(this.args.mixedOwnershipPositionIds.map(async (id) => {
            return await this.contracts.LiquidityManager.posRewardIndex(id);
        }));

        for (let i = 0; i < this.args.mixedOwnershipPositionIds.length; i++) {
            // Only expect an increase in reward index for positions that belong to the account
            if (/* condition to check if position belongs to the account */) {
                expect(finalRewardIndices[i]).to.be.above(initialRewardIndices[i]);
            } else {
                expect(finalRewardIndices[i]).to.equal(initialRewardIndices[i]);
            }
        }
    });

    it("should handle an invalid account without changing the reward index", async function () {
      const initialRewardIndex =
        await this.contracts.LiquidityManager.posRewardIndex(samplePositionId);

      await this.contracts.LiquidityManager.takeInterestsWithYieldBonus(
        "0x0000000000000000000000000000000000000000",
        this.args.yieldBonus,
        [samplePositionId],
      );

      const finalRewardIndex =
        await this.contracts.LiquidityManager.posRewardIndex(samplePositionId);

      expect(finalRewardIndex).to.equal(initialRewardIndex);
    });

    it("should handle an extreme yieldBonus value without error", async function () {
      const initialRewardIndex =
        await this.contracts.LiquidityManager.posRewardIndex(samplePositionId);

      await this.contracts.LiquidityManager.takeInterestsWithYieldBonus(
        this.args.validAccount,
        this.args.extremeYieldBonus,
        [samplePositionId],
      );

      const finalRewardIndex =
        await this.contracts.LiquidityManager.posRewardIndex(samplePositionId);

      // Check if the reward index has changed appropriately
      // The expectation here depends on how an extreme yield bonus is supposed to affect the position
      // For example, if a zero yield bonus should not change the index: expect(finalRewardIndex).to.equal(initialRewardIndex);
    });

    it("should revert when called by an address other than the farming range", async function () {
      try {
        await this.contracts.LiquidityManager.connect(
          this.args.nonFarmingRangeAccount,
        ).takeInterestsWithYieldBonus(
          this.args.validAccount,
          this.args.yieldBonus,
          this.args.existingPositionIds,
        );
        throw new Error(
          "Expected function to revert when called by non-farming range account, but it didn't",
        );
      } catch (error) {
        expect(error.message).to.include("OnlyFarmingRange");
      }
    });

    it("should handle duplicate position IDs without error", async function () {
      const initialRewardIndices = await Promise.all(
        this.args.duplicatePositionIds.map(async (id) => {
          return await this.contracts.LiquidityManager.posRewardIndex(id);
        }),
      );

      await this.contracts.LiquidityManager.takeInterestsWithYieldBonus(
        this.args.validAccount,
        this.args.yieldBonus,
        this.args.duplicatePositionIds,
      );

      const finalRewardIndices = await Promise.all(
        this.args.duplicatePositionIds.map(async (id) => {
          return await this.contracts.LiquidityManager.posRewardIndex(id);
        }),
      );

      for (let i = 0; i < this.args.duplicatePositionIds.length; i++) {
        expect(finalRewardIndices[i]).to.be.above(initialRewardIndices[i]);
      }
    });

    it("should appropriately affect the positions' state with yield bonus interest calculation", async function () {
      const initialRewardIndices = await Promise.all(
        this.args.existingPositionIds.map(async (id) => {
          return await this.contracts.LiquidityManager.posRewardIndex(id);
        }),
      );

      await this.contracts.LiquidityManager.takeInterestsWithYieldBonus(
        this.args.validAccount,
        this.args.yieldBonus,
        this.args.existingPositionIds,
      );

      const finalRewardIndices = await Promise.all(
        this.args.existingPositionIds.map(async (id) => {
          return await this.contracts.LiquidityManager.posRewardIndex(id);
        }),
      );

      for (let i = 0; i < this.args.existingPositionIds.length; i++) {
        expect(finalRewardIndices[i]).to.be.above(initialRewardIndices[i]);
        // Additional checks can be made here to verify specific interest calculations if necessary
      }
    });
  });
}
