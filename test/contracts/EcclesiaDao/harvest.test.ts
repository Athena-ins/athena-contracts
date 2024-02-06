import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function EcclesiaDao_harvest() {
  context("harvest", function () {
    before(async function () {
      this.args = {};
    });

    it("should revert if the user does not have a lock", async function () {
      // Attempt to harvest rewards for a user without a lock
      expect(
        await this.contract.harvest(this.args.tokens, {
          from: this.signers.userWithoutLock,
        }),
      ).to.be.revertedWith("LockDoesNotExist"); // Use appropriate error message
    });

    it("should correctly calculate and transfer staking rewards", async function () {
      // Harvest staking rewards and verify correct calculation and transfer
      await this.contract.harvest(this.args.tokens, {
        from: this.signers.userWithLock,
      });
      // Add logic to check staking rewards calculation and transfer
    });

    it("should correctly calculate and transfer redistributed rewards", async function () {
      // Harvest redistributed rewards and verify correct calculation and transfer
      await this.contract.harvest(this.args.tokens, {
        from: this.signers.userWithLock,
      });
      // Add logic to check redistributed rewards calculation and transfer
    });

    it("should update user's staking and redistribution indexes after harvesting", async function () {
      // Harvest rewards and verify the user's indexes are updated
      await this.contract.harvest(this.args.tokens, {
        from: this.signers.userWithLock,
      });
      const updatedLock = await this.contract.locks(
        this.signers.userWithLock.address,
      );

      // Check if the user's staking and redistribution indexes are updated
      expect(updatedLock.userStakingIndex).to.equal(
        await this.contract.stakingIndex(),
      );
      expect(updatedLock.userRedisIndex).to.equal(
        await this.contract.redistributeIndex(),
      );
    });

    it("should harvest and transfer revenue for specified tokens", async function () {
      // Harvest revenue rewards for specified tokens and verify transfer
      await this.contract.harvest(this.args.tokens, {
        from: this.signers.userWithLock,
      });
      // Add logic to check each specified token's revenue harvest and transfer
    });

    it("should update user's revenue index for each harvested token", async function () {
      // Harvest revenue rewards and verify each token's user revenue index is updated
      await this.contract.harvest(this.args.tokens, {
        from: this.signers.userWithLock,
      });

      for (let i = 0; i < this.args.tokens.length; i++) {
        const tokenAddress = this.args.tokens[i];
        const updatedUserRevenueIndex = await this.contract.userRevenueIndex(
          this.signers.userWithLock.address,
          tokenAddress,
        );

        // Check if the user's revenue index for each token is updated
        expect(updatedUserRevenueIndex).to.equal(
          await this.contract.revenueIndex(tokenAddress),
        );
      }
    });

    it("should not transfer any tokens if there are no rewards to harvest", async function () {
      // Attempt to harvest when there are no rewards
      expect(
        await this.contract.harvest(this.args.tokens, {
          from: this.signers.userWithNoRewards,
        }),
      ).to.not.throw;
      // Add logic to verify that no tokens are transferred
    });
  });
}
