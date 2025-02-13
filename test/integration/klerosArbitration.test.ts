import { utils } from "ethers";
import { expect } from "chai";
// Helpers
import {
  setNextBlockTimestamp,
  postTxHandler,
  impersonateAccount,
} from "../helpers/hardhat";
import { makeIdArray } from "../helpers/miscUtils";
import { getKlerosLiquid } from "../helpers/contracts-getters";
// Types
import { BigNumber } from "ethers";
import { IKlerosLiquid } from "../../typechain";

const { parseUnits } = utils;

/**
 * View the Kleros Liquid contract here:
 * https://etherscan.io/address/0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069#code
 * View the Kleros court here (non-technical):
 * https://klerosboard.com/1/courts/2
 */

interface Arguments extends Mocha.Context {
  args: {
    nbPools: number;
    daoLockDuration: number;
    lpAmount: BigNumber;
    nbLpProviders: number;
    coverAmount: BigNumber;
    coverPremiums: BigNumber;
    claimAmount: BigNumber;
    KlerosLiquid: IKlerosLiquid & { address: string };
    disputeIds: BigNumber[];
  };
}

export function KlerosArbitrationTest() {
  context("Kleros Arbitration Test", function () {
    before(async function (this: Arguments) {
      const KlerosLiquid = await getKlerosLiquid(
        "0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069",
      );

      this.args = {
        nbPools: 3,
        daoLockDuration: 60 * 60 * 24 * 365,
        lpAmount: parseUnits("1000", 6),
        nbLpProviders: 1,
        coverAmount: parseUnits("1000", 6),
        coverPremiums: parseUnits("1000", 6),
        claimAmount: parseUnits("200", 6),
        KlerosLiquid,
        disputeIds: [],
      };
    });

    describe("setup", function () {
      it("can create pools", async function (this: Arguments) {
        for (let i = 0; i < this.args.nbPools; i++) {
          const poolId = i;

          const { uOptimal, r0, rSlope1, rSlope2 } =
            this.protocolConfig.poolFormula;

          // Create a pool
          expect(
            await postTxHandler(
              this.contracts.LiquidityManager.createPool(
                this.contracts.CircleToken.address, // paymentAsset
                0, // strategyId
                0, // feeRate
                uOptimal,
                r0,
                rSlope1,
                rSlope2,
                makeIdArray(this.args.nbPools).filter((id) => id != poolId), // compatiblePools
              ),
            ),
          ).to.not.throw;

          // Check pool info
          const poolInfo =
            await this.contracts.LiquidityManager.poolInfo(poolId);
          expect(poolInfo.paymentAsset.toLowerCase()).to.equal(
            this.contracts.CircleToken.address,
          );
          expect(poolInfo.underlyingAsset.toLowerCase()).to.equal(
            this.contracts.CircleToken.address,
          );
          expect(poolInfo.feeRate).to.equal(0);
          expect(poolInfo.strategyId).to.equal(0);
          expect(poolInfo.formula.uOptimal).to.equal(
            this.protocolConfig.poolFormula.uOptimal,
          );
          expect(poolInfo.formula.r0).to.equal(
            this.protocolConfig.poolFormula.r0,
          );
          expect(poolInfo.formula.rSlope1).to.equal(
            this.protocolConfig.poolFormula.rSlope1,
          );
          expect(poolInfo.formula.rSlope2).to.equal(
            this.protocolConfig.poolFormula.rSlope2,
          );
          expect(poolInfo.poolId).to.equal(poolId);
        }
      });

      it("accepts LPs", async function (this: Arguments) {
        for (let i = 0; i < this.args.nbLpProviders; i++) {
          expect(
            await this.helpers.openPosition(
              this.signers.deployer,
              this.args.lpAmount,
              false,
              makeIdArray(this.args.nbPools),
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
          for (let j = 0; j < this.args.nbPools; j++) {
            expect(position.poolIds[j]).to.equal(j);
          }
          expect(position.supplied).to.equal(this.args.lpAmount);
        }
      });

      it("accepts covers", async function (this: Arguments) {
        for (let i = 0; i < this.args.nbPools; i++) {
          expect(
            await this.helpers.openCover(
              this.signers.deployer,
              i,
              this.args.coverAmount,
              this.args.coverPremiums,
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

          expect(cover.coverId).to.equal(i);
          expect(cover.poolId).to.equal(i);
          expect(cover.coverAmount).to.equal(this.args.coverAmount);
          expect(cover.isActive).to.be.true;
        }
      });
    });

    describe("arbitration", function () {
      it("can update to kleros arbitrator", async function (this: Arguments) {
        expect(
          await postTxHandler(
            this.contracts.ClaimManager.setKlerosConfiguration(
              this.args.KlerosLiquid.address,
              2,
              4,
            ),
          ),
        ).to.not.throw;

        expect(
          await postTxHandler(
            this.contracts.ClaimManager.setPeriods(
              this.protocolConfig.challengePeriod,
              84 * 60 * 60, // Appeal Period 3 days 12 hours
              42 * 60 * 60, // Evidence Period 1 day 18 hours
            ),
          ),
        ).to.not.throw;
      });

      it("can create claims", async function (this: Arguments) {
        await setNextBlockTimestamp({ days: 30 });

        for (let i = 0; i < this.args.nbPools; i++) {
          expect(
            await this.helpers.initiateClaim(
              this.signers.deployer,
              i,
              this.args.claimAmount,
            ),
          ).to.not.throw;

          const claim = await this.contracts.ClaimManager.claims(i);

          expect(claim.status).to.equal(0);
          expect(claim.amount).to.equal(this.args.claimAmount);
          expect(claim.coverId).to.equal(i);
        }
      });

      it("can challenge claims", async function (this: Arguments) {
        const arbitrationCost =
          await this.contracts.ClaimManager.arbitrationCost();

        const KlerosLiquid = this.args.KlerosLiquid;
        if (!KlerosLiquid) throw Error("KlerosLiquid contract not found");

        for (let i = 0; i < 2; i++) {
          const tx = await this.contracts.ClaimManager.connect(
            this.signers.user1,
          ).disputeClaim(i, {
            value: arbitrationCost,
          });
          const receipt = await tx.wait();

          const disputeEvents = await KlerosLiquid.queryFilter(
            KlerosLiquid.filters.DisputeCreation(),
            receipt.blockNumber,
            receipt.blockNumber,
          );

          const disputeID = disputeEvents[0].args._disputeID;
          this.args.disputeIds.push(disputeID);
        }
      });

      it("can resolve disputes", async function (this: Arguments) {
        const KlerosLiquidSigner = await impersonateAccount(
          this.args.KlerosLiquid.address,
        );

        for (let i = 0; i < 2; i++) {
          const disputeId = this.args.disputeIds[i];
          const ruling = i + 1; // 1 = Accept claim, 2 = Reject claim

          expect(
            await postTxHandler(
              this.contracts.ClaimManager?.connect(KlerosLiquidSigner).rule(
                disputeId,
                ruling,
              ),
            ),
          ).to.not.throw;
        }
      });

      it("can withdraw unchallenged claims", async function (this: Arguments) {
        await setNextBlockTimestamp({ days: 15 });

        expect(
          await this.helpers.withdrawCompensation(this.signers.deployer, 2),
        ).to.not.throw;
      });
    });
  });
}
