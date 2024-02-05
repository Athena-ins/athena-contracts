import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool__getUpdatedPositionInfo() {
  context("_getUpdatedPositionInfo", function () {
    before(async function () {
      this.args = {};
    });
    

    it("should compute the updated position info correctly", async function() {
      // Compute the updated position info
      const updatedInfo = await this.contracts.TestableVirtualPool.getUpdatedPositionInfo(
        this.args.tokenId,
        this.args.userCapital,
        this.args.poolIds
      );
    
      // Check if the newUserCapital is correctly updated
      expect(updatedInfo.newUserCapital).to.equal(this.args.expectedNewUserCapital);
    
      // Check if the coverRewards are correctly computed
      expect(updatedInfo.coverRewards).to.equal(this.args.expectedCoverRewards);
    
      // Check if the strategyRewards are correctly computed
      expect(updatedInfo.strategyRewards).to.equal(this.args.expectedStrategyRewards);
    
      // Check if the newLpInfo is correctly updated
      expect(updatedInfo.newLpInfo.beginLiquidityIndex).to.equal(this.args.expectedBeginLiquidityIndex);
      expect(updatedInfo.newLpInfo.beginClaimIndex).to.equal(this.args.expectedBeginClaimIndex);
    });
    
    it("should account for claims affecting the position's capital", async function() {
      // Compute the updated position info with claims affecting the capital
      const updatedInfo = await this.contracts.TestableVirtualPool.getUpdatedPositionInfo(
        this.args.tokenId,
        this.args.userCapital,
        this.args.poolIds
      );
    
      // Verify that the user's capital is reduced according to the claims
      expect(updatedInfo.newUserCapital).to.be.lessThan(this.args.userCapital);
    });
    
    it("should correctly calculate rewards up to the latest claim or update", async function() {
      // Compute the updated position info and verify reward calculation
      const updatedInfo = await this.contracts.TestableVirtualPool.getUpdatedPositionInfo(
        this.args.tokenId,
        this.args.userCapital,
        this.args.poolIds
      );
    
      // Check if the rewards are calculated up to the latest claim or current block
      expect(updatedInfo.coverRewards).to.be.at.least(this.args.minimumExpectedCoverRewards);
      expect(updatedInfo.strategyRewards).to.be.at.least(this.args.minimumExpectedStrategyRewards);
    });
    
    it("should update the LpInfo with the latest indexes", async function() {
      // Compute the updated position info and verify LpInfo updates
      const updatedInfo = await this.contracts.TestableVirtualPool.getUpdatedPositionInfo(
        this.args.tokenId,
        this.args.userCapital,
        this.args.poolIds
      );
    
      // Check if the LpInfo is updated with the latest liquidity and claim indexes
      const latestLiquidityIndex = await this.contracts.TestableVirtualPool.liquidityIndex();
      const latestClaimIndex = await this.con
    
  });
}
