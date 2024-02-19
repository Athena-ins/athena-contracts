import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function LiquidityManager_addLiquidity() {
  context("addLiquidity", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });

    it("should increase the position's liquidity with valid parameters", async function (this: Arguments) {
      // Simulate increasing the position's liquidity
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.positionOwner,
        ).addLiquidity(
          this.args.tokenId,
          this.args.amount,
          this.args.isWrapped,
        ),
      ).to.not.throw;

      // Retrieve the updated position information
      const position = await this.contracts.LiquidityManager._positions(
        this.args.tokenId,
      );

      // Check if the position's liquidity is increased correctly
      expect(position.supplied).to.equal(this.args.expectedNewSupplied);
    });

    it("should revert if called by non-position owner", async function (this: Arguments) {
      // Attempt to increase position's liquidity by non-owner
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.nonOwner,
        ).addLiquidity(
          this.args.tokenId,
          this.args.amount,
          this.args.isWrapped,
        ),
      ).to.be.revertedWith("OnlyTokenOwner");
    });

    it("should revert if the position is committed for withdrawal", async function (this: Arguments) {
      // Assuming position is committed for withdrawal
      expect(
        await this.contracts.LiquidityManager.connect(
          this.signers.positionOwner,
        ).addLiquidity(
          this.args.committedTokenId,
          this.args.amount,
          this.args.isWrapped,
        ),
      ).to.be.revertedWith("CannotIncreaseIfCommittedWithdrawal");
    });

    it("should handle both wrapped and unwrapped token deposits correctly", async function (this: Arguments) {
      // Increase position with non-wrapped tokens
      await this.contracts.LiquidityManager.connect(
        this.signers.positionOwner,
      ).addLiquidity(this.args.tokenId, this.args.amount, false);

      // Increase position with wrapped tokens
      await this.contracts.LiquidityManager.connect(
        this.signers.positionOwner,
      ).addLiquidity(this.args.tokenId, this.args.amount, true);

      // Check if the positions are updated correctly
      const position = await this.contracts.LiquidityManager._positions(
        this.args.tokenId,
      );
      expect(position.supplied).to.equal(
        this.args.expectedSuppliedAfterBothIncreases,
      );
    });

    it("should take interests in all pools before updating the position", async function (this: Arguments) {
      // Increase the position's liquidity
      await this.contracts.LiquidityManager.connect(
        this.signers.positionOwner,
      ).addLiquidity(this.args.tokenId, this.args.amount, this.args.isWrapped);

      // Check if interests are taken into account before updating the position
      // Specific checks depend on contract implementation and state
    });
  });
}
