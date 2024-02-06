import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool__addPremiumPosition() {
  context("_addPremiumPosition", function () {
    before(async function () {
      this.args = {};
    });

    it("should add a premium position for the cover", async function () {
      // Add a premium position for a cover
      expect(
        await this.contracts.TestableVirtualPool.addPremiumPosition(
          this.args.coverId,
          this.args.beginPremiumRate,
          this.args.lastTick,
        ),
      ).to.not.throw;
      // Check if the premium position is added correctly
      const coverPremiums =
        await this.contracts.TestableVirtualPool.coverPremiums(
          this.args.coverId,
        );
      expect(coverPremiums.beginPremiumRate).to.equal(
        this.args.beginPremiumRate,
      );
      expect(coverPremiums.lastTick).to.equal(this.args.lastTick);
    });

    it("should initialize the last tick of the cover if not already initialized", async function () {
      // Add a premium position for a cover where the last tick is not initialized
      await this.contracts.TestableVirtualPool.addPremiumPosition(
        this.args.coverId,
        this.args.beginPremiumRate,
        this.args.uninitializedLastTick,
      );
      // Check if the last tick is now initialized
      const isInitialized =
        await this.contracts.TestableVirtualPool.isInitializedTick(
          this.args.uninitializedLastTick,
        );
      expect(isInitialized).to.be.true;
    });

    it("should increment the number of covers in the tick", async function () {
      // Add a premium position and check the number of covers in the tick
      await this.contracts.TestableVirtualPool.addPremiumPosition(
        this.args.coverId,
        this.args.beginPremiumRate,
        this.args.lastTick,
      );
      const nbCoversInTick =
        await this.contracts.TestableVirtualPool.nbCoversInTick(
          this.args.lastTick,
        );
      expect(nbCoversInTick).to.be.greaterThan(this.args.initialNbCoversInTick);
    });

    it("should set the cover's premium position data correctly", async function () {
      // Add a premium position for a cover and check its data
      await this.contracts.TestableVirtualPool.addPremiumPosition(
        this.args.coverId,
        this.args.beginPremiumRate,
        this.args.lastTick,
      );
      const coverPremium =
        await this.contracts.TestableVirtualPool.coverPremiums(
          this.args.coverId,
        );
      expect(coverPremium.beginPremiumRate).to.equal(
        this.args.beginPremiumRate,
      );
      expect(coverPremium.lastTick).to.equal(this.args.lastTick);
      expect(coverPremium.coverIdIndex).to.be.a("number");
    });
  });
}
