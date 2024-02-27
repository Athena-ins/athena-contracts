import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
import { toRay } from "../../helpers/utils/poolRayMath";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {
    poolId: number;
    coverId: number;
    beginPremiumRate: BigNumber;
    lastTick: number;
    initialNbCoversInTick: number;
    nextNbCoversInTick: number;
  };
}

export function VirtualPool__addPremiumPosition() {
  context("_addPremiumPosition", function () {
    before(async function (this: Arguments) {
      this.args = {
        poolId: 1,
        coverId: 1,
        beginPremiumRate: toRay(5), // 5%
        lastTick: 42,
        initialNbCoversInTick: 0,
        nextNbCoversInTick: 1,
      };
    });

    it("has no covers in the tick", async function (this: Arguments) {
      // Check if the tick has no covers
      const coverIdsInTick = await this.contracts.LiquidityManager.ticks(
        this.args.poolId,
        this.args.lastTick,
      );
      expect(coverIdsInTick.length).to.equal(this.args.initialNbCoversInTick);
    });

    it("has an uninitialized last tick", async function (this: Arguments) {
      // Check if the last tick is not initialized
      const isInitialized =
        await this.contracts.LiquidityManager.isInitializedTick(
          this.args.poolId,
          this.args.lastTick,
        );
      expect(isInitialized).to.be.false;
    });

    it("has empty cover premium data for the cover", async function (this: Arguments) {
      // Check if the cover has no premium data
      const coverPremiums = await this.contracts.LiquidityManager.coverPremiums(
        this.args.poolId,
        this.args.coverId,
      );
      expect(coverPremiums.beginPremiumRate).to.equal(0);
      expect(coverPremiums.lastTick).to.equal(0);
      expect(coverPremiums.coverIdIndex).to.equal(0);
    });

    it("should add a premium position for the cover", async function (this: Arguments) {
      // Add a premium position for a cover
      expect(
        await this.contracts.LiquidityManager.addPremiumPosition(
          this.args.poolId,
          this.args.coverId,
          this.args.beginPremiumRate,
          this.args.lastTick,
        ),
      ).to.not.throw;

      // Check if the premium position is added correctly
      const coverPremiums = await this.contracts.LiquidityManager.coverPremiums(
        this.args.poolId,
        this.args.coverId,
      );
      expect(coverPremiums.beginPremiumRate).to.equal(
        this.args.beginPremiumRate,
      );
      expect(coverPremiums.lastTick).to.equal(this.args.lastTick);
      expect(coverPremiums.coverIdIndex).to.equal(0);
    });

    it("should initialize the last tick of the cover", async function (this: Arguments) {
      // Check if the last tick is now initialized
      const isInitialized =
        await this.contracts.LiquidityManager.isInitializedTick(
          this.args.poolId,
          this.args.lastTick,
        );
      expect(isInitialized).to.be.true;
    });

    it("should increment the number of covers in the tick", async function (this: Arguments) {
      const coverIdsInTick = await this.contracts.LiquidityManager.ticks(
        this.args.poolId,
        this.args.lastTick,
      );
      expect(coverIdsInTick.length).to.equal(this.args.nextNbCoversInTick);
    });
  });
}
