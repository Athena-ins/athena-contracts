import { utils } from "ethers";
import { expect } from "chai";
import {
  setNextBlockTimestamp,
  postTxHandler,
  getCurrentTime,
} from "../helpers/hardhat";
import { makeIdArray } from "../helpers/miscUtils";
import { BigNumber } from "ethers";
import { deployPoolManager } from "../helpers/deployers";
import { PoolManager } from "../../typechain";

const { parseUnits } = utils;

interface Arguments extends Mocha.Context {
  customEnv: {
    PoolManager: PoolManager;
  };
  args: {
    nbPools: number;
    feeRate: BigNumber;
    uOptimal: BigNumber;
    r0: BigNumber;
    rSlope1: BigNumber;
    rSlope2: BigNumber;
  };
}

export function PoolManagerTest() {
  context("Pool Manager Tests", function () {
    this.timeout(50000);

    before(async function (this: Arguments) {
      this.args = {
        nbPools: 3,
        feeRate: parseUnits("0.01", 18), // 1%
        uOptimal: parseUnits("0.8", 18), // 80%
        r0: parseUnits("0.1", 18), // 10%
        rSlope1: parseUnits("0.2", 18), // 20%
        rSlope2: parseUnits("0.4", 18), // 40%
      };
    });

    it("deploys PoolManager correctly", async function (this: Arguments) {
      const poolManager = await deployPoolManager(this.signers.deployer, [
        this.contracts.LiquidityManager.address,
      ]);

      this.customEnv = {
        PoolManager: poolManager,
      };

      expect(
        (await this.customEnv.PoolManager?.liquidityManager()).toLowerCase(),
      ).to.equal(this.contracts.LiquidityManager.address.toLowerCase());

      // Update PoolManager address in LiquidityManager
      expect(
        await postTxHandler(
          this.contracts.LiquidityManager.transferOwnership(
            this.customEnv.PoolManager.address,
          ),
        ),
      ).to.not.throw;
      expect(
        (await this.contracts.LiquidityManager.owner()).toLowerCase(),
      ).to.equal(this.customEnv.PoolManager.address.toLowerCase());
    });

    it("batch creates pools", async function (this: Arguments) {
      const poolParams = makeIdArray(this.args.nbPools).map(() => ({
        paymentAsset: this.contracts.CircleToken.address,
        strategyId: 0,
        feeRate: this.args.feeRate,
        uOptimal: this.args.uOptimal,
        r0: this.args.r0,
        rSlope1: this.args.rSlope1,
        rSlope2: this.args.rSlope2,
        compatiblePools: [] as number[],
      }));

      expect(
        await postTxHandler(
          this.customEnv.PoolManager?.batchCreatePool(poolParams),
        ),
      ).to.not.throw;

      // Verify pools were created
      for (let i = 0; i < this.args.nbPools; i++) {
        const poolInfo = await this.contracts.LiquidityManager.poolInfo(i);
        expect(poolInfo.paymentAsset.toLowerCase()).to.equal(
          this.contracts.CircleToken.address.toLowerCase(),
        );
      }
    });

    it("batch pauses pools", async function (this: Arguments) {
      const poolIds = makeIdArray(this.args.nbPools);

      expect(
        await postTxHandler(
          this.customEnv.PoolManager?.batchPausePool(poolIds, true),
        ),
      ).to.not.throw;

      // Verify pools are paused
      for (let i = 0; i < this.args.nbPools; i++) {
        const poolInfo = await this.contracts.LiquidityManager.poolInfo(i);
        expect(poolInfo.isPaused).to.be.true;
      }
    });

    it("batch updates pool config", async function (this: Arguments) {
      const newConfigs = makeIdArray(this.args.nbPools).map((id) => ({
        poolId: id,
        feeRate: this.args.feeRate.mul(2), // Double the fee rate
        uOptimal: this.args.uOptimal,
        r0: this.args.r0,
        rSlope1: this.args.rSlope1,
        rSlope2: this.args.rSlope2,
      }));

      expect(
        await postTxHandler(
          this.customEnv.PoolManager?.batchUpdatePoolConfig(newConfigs),
        ),
      ).to.not.throw;

      // Verify configs were updated
      for (let i = 0; i < this.args.nbPools; i++) {
        const poolInfo = await this.contracts.LiquidityManager.poolInfo(i);
        expect(poolInfo.feeRate).to.equal(this.args.feeRate.mul(2));
      }
    });

    it("batch updates pool compatibility", async function (this: Arguments) {
      const poolIds = [0, 1];
      const compatiblePools = [[1], [2]];
      const compatibilityStatus = poolIds.map(() => [true]);

      expect(
        await postTxHandler(
          this.customEnv.PoolManager?.batchUpdatePoolCompatibility(
            poolIds,
            compatiblePools,
            compatibilityStatus,
          ),
        ),
      ).to.not.throw;
    });

    it("transfers LiquidityManager ownership", async function (this: Arguments) {
      const newOwner = this.signers.user1.address;

      expect(
        await postTxHandler(
          this.customEnv.PoolManager?.transferLiquidityManagerOwnership(
            newOwner,
          ),
        ),
      ).to.not.throw;

      expect(await this.contracts.LiquidityManager.owner()).to.equal(newOwner);
    });

    it("updates LiquidityManager address", async function (this: Arguments) {
      const newAddress = this.signers.user1.address;

      expect(
        await postTxHandler(
          this.customEnv.PoolManager?.updateLiquidityManager(newAddress),
        ),
      ).to.not.throw;

      expect(await this.customEnv.PoolManager?.liquidityManager()).to.equal(
        newAddress,
      );
    });
  });
}
