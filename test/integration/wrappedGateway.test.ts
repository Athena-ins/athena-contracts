import { utils } from "ethers";
import { expect } from "chai";
import {
  setNextBlockTimestamp,
  postTxHandler,
  getCurrentTime,
} from "../helpers/hardhat";
import { makeIdArray } from "../helpers/miscUtils";
import { poolInfoFormat } from "../helpers/dataFormat";
import { BigNumber } from "ethers";

const { parseEther } = utils;

interface Arguments extends Mocha.Context {
  args: {
    nbPools: number;
    daoLockDuration: number;
    lpAmount: BigNumber;
    nbLpProviders: number;
    coverAmount: BigNumber;
    coverPremiums: BigNumber;
    lpIncreaseAmount: BigNumber;
    coverIncreaseAmount: BigNumber;
    coverIncreasePremiums: BigNumber;
    wstETH: string;
  };
}

export function WrappedTokenGatewayTest() {
  context("Wrapped ETH Gateway Test", function () {
    this.timeout(600_000);

    before(async function (this: Arguments) {
      if (
        !this.contracts.WrappedTokenGateway ||
        this.contracts.WrappedTokenGateway.address ===
          "0x0000000000000000000000000000000000000000"
      )
        throw Error("WrappedTokenGateway not deployed");

      if (!this.protocolConfig.wstETH) {
        throw Error("wstETH token address is requires");
      }

      this.args = {
        nbPools: 3,
        daoLockDuration: 60 * 60 * 24 * 365,
        lpAmount: parseEther("1000"),
        nbLpProviders: 1,
        coverAmount: parseEther("1000"),
        coverPremiums: parseEther("200"),
        lpIncreaseAmount: parseEther("500"),
        coverIncreaseAmount: parseEther("350"),
        coverIncreasePremiums: parseEther("1"),
        wstETH: this.protocolConfig.wstETH,
      };
    });

    describe("for WETH pools", function () {
      it("can create pools", async function (this: Arguments) {
        for (let i = 0; i < this.args.nbPools; i++) {
          const poolId = i;
          const { uOptimal, r0, rSlope1, rSlope2 } =
            this.protocolConfig.poolFormula;

          expect(
            await postTxHandler(
              this.contracts.LiquidityManager.createPool(
                this.contracts.WethToken.address,
                3, // Morpho vault strategy ID
                0,
                uOptimal,
                r0,
                rSlope1,
                rSlope2,
                makeIdArray(this.args.nbPools).filter((id) => id != poolId),
              ),
            ),
          ).to.not.throw;

          const poolInfo =
            await this.contracts.LiquidityManager.poolInfo(poolId);
          expect(poolInfo.paymentAsset.toLowerCase()).to.equal(
            this.contracts.WethToken.address.toLowerCase(),
          );
          expect(poolInfo.underlyingAsset.toLowerCase()).to.equal(
            this.contracts.WethToken.address.toLowerCase(),
          );
        }
      });

      it("accepts LPs through ETH gateway", async function (this: Arguments) {
        for (let i = 0; i < this.args.nbLpProviders; i++) {
          expect(
            await postTxHandler(
              this.contracts.WrappedTokenGateway.openPositionETH(
                makeIdArray(this.args.nbPools),
                { value: this.args.lpAmount },
              ),
            ),
          ).to.not.throw;

          expect(
            await this.contracts.AthenaPositionToken.balanceOf(
              this.signers.deployer.address,
            ),
          ).to.equal(i + 1);

          const position =
            await this.contracts.LiquidityManager.positionInfo(i);
          expect(position.poolIds.length).to.equal(this.args.nbPools);
          expect(position.supplied).to.equal(this.args.lpAmount);
        }
      });

      it("accepts covers through ETH gateway", async function (this: Arguments) {
        for (let i = 0; i < this.args.nbPools; i++) {
          expect(
            await postTxHandler(
              this.contracts.WrappedTokenGateway.openCoverETH(
                i,
                this.args.coverAmount,
                this.args.coverPremiums,
                { value: this.args.coverPremiums },
              ),
            ),
          ).to.not.throw;
        }

        expect(
          await this.contracts.AthenaCoverToken.balanceOf(
            this.signers.deployer.address,
          ),
        ).to.equal(this.args.nbPools);

        for (let i = 0; i < this.args.nbPools; i++) {
          const cover = await this.contracts.LiquidityManager.coverInfo(i);
          expect(cover.coverAmount).to.equal(this.args.coverAmount);
          expect(cover.isActive).to.be.true;
        }
      });

      it("can take interests", async function (this: Arguments) {
        await setNextBlockTimestamp({ days: 2 });

        for (let i = 0; i < this.args.nbLpProviders; i++) {
          const positionBefore =
            await this.contracts.LiquidityManager.positionInfo(i);
          expect(await this.contracts.LiquidityManager.takeInterests(i)).to.not
            .throw;
          const position =
            await this.contracts.LiquidityManager.positionInfo(i);

          for (let j = 0; j < this.args.nbPools; j++) {
            expect(positionBefore.coverRewards[j]).to.not.equal(0);
            expect(position.coverRewards[j]).to.equal(0);
          }
        }
      });

      it("can increase LPs through ETH gateway", async function (this: Arguments) {
        await setNextBlockTimestamp({ days: 365 });

        for (let i = 0; i < this.args.nbLpProviders; i++) {
          expect(
            await postTxHandler(
              this.contracts.AthenaPositionToken.approve(
                this.contracts.WrappedTokenGateway.address,
                i,
              ),
            ),
          ).to.not.throw;

          expect(
            await postTxHandler(
              this.contracts.WrappedTokenGateway.addLiquidityETH(i, {
                value: this.args.lpIncreaseAmount,
              }),
            ),
          ).to.not.throw;
        }

        await setNextBlockTimestamp({ days: 5 });

        for (let i = 0; i < this.args.nbLpProviders; i++) {
          const position =
            await this.contracts.LiquidityManager.positionInfo(i);
          expect(position.supplied).to.equal(
            this.args.lpIncreaseAmount.add(this.args.lpAmount),
          );
        }
      });

      it("can increase cover & premiums through ETH gateway", async function (this: Arguments) {
        for (let i = 0; i < this.args.nbPools; i++) {
          const coverId = i;

          expect(
            await postTxHandler(
              this.contracts.AthenaCoverToken.approve(
                this.contracts.WrappedTokenGateway.address,
                coverId,
              ),
            ),
          ).to.not.throw;

          expect(
            await postTxHandler(
              this.contracts.WrappedTokenGateway.updateCoverETH(
                coverId,
                this.args.coverIncreaseAmount,
                0,
                this.args.coverIncreasePremiums,
                0,
                { value: this.args.coverIncreasePremiums },
              ),
            ),
          ).to.not.throw;

          await setNextBlockTimestamp({ days: 5 });

          const cover =
            await this.contracts.LiquidityManager.coverInfo(coverId);
          expect(cover.coverAmount).to.equal(
            this.args.coverIncreaseAmount.add(this.args.coverAmount),
          );
        }
      });

      it("can close cover through ETH gateway", async function (this: Arguments) {
        const uint256Max = BigNumber.from(2).pow(256).sub(1);

        const coverId = 0;

        expect(
          await postTxHandler(
            this.contracts.AthenaCoverToken.approve(
              this.contracts.WrappedTokenGateway.address,
              coverId,
            ),
          ),
        ).to.not.throw;

        expect(
          await postTxHandler(
            this.contracts.WrappedTokenGateway.updateCoverETH(
              coverId,
              0,
              0,
              0,
              uint256Max,
            ),
          ),
        ).to.not.throw;

        const cover = await this.contracts.LiquidityManager.coverInfo(coverId);
        expect(cover.premiumsLeft).to.equal(0);
      });

      it("can commit LPs withdrawal", async function (this: Arguments) {
        await setNextBlockTimestamp({ days: 10 });
        const expectedTimestamp = await getCurrentTime();

        expect(
          await postTxHandler(
            this.contracts.AthenaPositionToken.approve(
              this.contracts.WrappedTokenGateway.address,
              0,
            ),
          ),
        ).to.not.throw;

        expect(
          await postTxHandler(
            this.contracts.LiquidityManager.commitRemoveLiquidity(0),
          ),
        ).to.not.throw;

        const position = await this.contracts.LiquidityManager.positionInfo(0);
        expect(position.commitWithdrawalTimestamp.div(100)).to.almostEqual(
          Math.floor(expectedTimestamp / 100),
        );
      });

      it("can withdraw LPs through ETH gateway", async function (this: Arguments) {
        await setNextBlockTimestamp({ days: 365 });

        for (let i = 0; i < this.args.nbLpProviders; i++) {
          const positionInfo =
            await this.contracts.LiquidityManager.positionInfo(0);

          const balanceBefore = await this.signers.deployer.getBalance();

          expect(
            await postTxHandler(
              this.contracts.AthenaPositionToken.approve(
                this.contracts.WrappedTokenGateway.address,
                i,
              ),
            ),
          ).to.not.throw;

          expect(
            await postTxHandler(
              this.contracts.WrappedTokenGateway.removeLiquidityETH(
                i,
                positionInfo.supplied,
              ),
            ),
          ).to.not.throw;

          const balanceAfter = await this.signers.deployer.getBalance();
          expect(balanceAfter.sub(balanceBefore)).to.be.gt(0);

          const position =
            await this.contracts.LiquidityManager.positionInfo(i);
          expect(position.supplied).to.equal(0);
        }
      });
    });

    describe("for wstETH pools", function () {
      it("can create pool", async function (this: Arguments) {
        const poolId = (
          await this.contracts.LiquidityManager.nextPoolId()
        ).toNumber();
        const { uOptimal, r0, rSlope1, rSlope2 } =
          this.protocolConfig.poolFormula;

        expect(
          await postTxHandler(
            this.contracts.LiquidityManager.createPool(
              this.contracts.WethToken.address,
              4, // Inception Symbiotic LRT
              0,
              uOptimal,
              r0,
              rSlope1,
              rSlope2,
              [],
            ),
          ),
        ).to.not.throw;

        const poolInfo = await this.contracts.LiquidityManager.poolInfo(poolId);
        expect(poolInfo.paymentAsset.toLowerCase()).to.equal(
          this.contracts.WethToken.address.toLowerCase(),
        );
        expect(poolInfo.underlyingAsset.toLowerCase()).to.equal(
          this.args.wstETH.toLowerCase(),
        );
      });

      it("accepts LPs through ETH to wstETH gateway", async function (this: Arguments) {
        for (let i = 0; i < this.args.nbLpProviders; i++) {
          const poolId =
            (await this.contracts.LiquidityManager.nextPoolId()).toNumber() - 1;
          const positionId =
            await this.contracts.AthenaPositionToken.nextPositionId();

          expect(
            await postTxHandler(
              this.contracts.WrappedTokenGateway.openPositionETHToWstETH(
                0,
                false,
                [poolId],
                { value: this.args.lpAmount },
              ),
            ),
          ).to.not.throw;

          const position =
            await this.contracts.LiquidityManager.positionInfo(positionId);
          expect(position.poolIds.length).to.equal(1);
          // Position should show wstETH amount, which will be less than ETH amount due to conversion
          expect(position.supplied).to.be.gt(0);
          expect(position.supplied).to.be.lt(this.args.lpAmount);
        }
      });

      it("can increase LPs through ETH to wstETH gateway", async function (this: Arguments) {
        await setNextBlockTimestamp({ days: 15 });

        const positionId =
          (
            await this.contracts.AthenaPositionToken.nextPositionId()
          ).toNumber() - 1;
        const positionBefore =
          await this.contracts.LiquidityManager.positionInfo(positionId);

        expect(
          await postTxHandler(
            this.contracts.AthenaPositionToken.approve(
              this.contracts.WrappedTokenGateway.address,
              positionId,
            ),
          ),
        ).to.not.throw;

        expect(
          await postTxHandler(
            this.contracts.WrappedTokenGateway.addLiquidityETHToWstETH(
              positionId,
              0,
              false,
              { value: this.args.lpIncreaseAmount },
            ),
          ),
        ).to.not.throw;

        await setNextBlockTimestamp({ days: 5 });

        const positionAfter =
          await this.contracts.LiquidityManager.positionInfo(positionId);
        expect(positionAfter.supplied).to.be.gt(positionBefore.supplied);
      });

      it("accepts LPs through WETH to wstETH gateway", async function (this: Arguments) {
        for (let i = 0; i < this.args.nbLpProviders; i++) {
          const poolId =
            (await this.contracts.LiquidityManager.nextPoolId()).toNumber() - 1;
          const positionId =
            await this.contracts.AthenaPositionToken.nextPositionId();

          expect(
            await postTxHandler(
              this.contracts.WethToken.approve(
                this.contracts.WrappedTokenGateway.address,
                this.args.lpAmount,
              ),
            ),
          ).to.not.throw;

          expect(
            await postTxHandler(
              this.contracts.WrappedTokenGateway.openPositionETHToWstETH(
                this.args.lpAmount, // amount is ignored when sending ETH
                false,
                [poolId],
              ),
            ),
          ).to.not.throw;

          const position =
            await this.contracts.LiquidityManager.positionInfo(positionId);
          expect(position.poolIds.length).to.equal(1);
          // Position should show wstETH amount, which will be less than ETH amount due to conversion
          expect(position.supplied).to.be.gt(0);
          expect(position.supplied).to.be.lt(this.args.lpAmount);
        }
      });

      it("can increase LPs through WETH to wstETH gateway", async function (this: Arguments) {
        await setNextBlockTimestamp({ days: 15 });

        const positionId =
          (
            await this.contracts.AthenaPositionToken.nextPositionId()
          ).toNumber() - 1;
        const positionBefore =
          await this.contracts.LiquidityManager.positionInfo(positionId);

        expect(
          await postTxHandler(
            this.contracts.WethToken.approve(
              this.contracts.WrappedTokenGateway.address,
              this.args.lpIncreaseAmount,
            ),
          ),
        ).to.not.throw;

        expect(
          await postTxHandler(
            this.contracts.AthenaPositionToken.approve(
              this.contracts.WrappedTokenGateway.address,
              positionId,
            ),
          ),
        ).to.not.throw;

        expect(
          await postTxHandler(
            this.contracts.WrappedTokenGateway.addLiquidityETHToWstETH(
              positionId,
              this.args.lpIncreaseAmount,
              false,
            ),
          ),
        ).to.not.throw;

        await setNextBlockTimestamp({ days: 5 });

        const positionAfter =
          await this.contracts.LiquidityManager.positionInfo(positionId);
        expect(positionAfter.supplied).to.be.gt(positionBefore.supplied);
      });
    });
  });
}
