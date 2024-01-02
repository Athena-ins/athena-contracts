import chai, { expect } from "chai";
import { ethers } from "hardhat";
import chaiAsPromised from "chai-as-promised";
// Helpers
import { getCurrentTime, setNextBlockTimestamp } from "../helpers/hardhat";
// Types
import { Signer, Contract, BigNumber, BigNumberish } from "ethers";
//
chai.use(chaiAsPromised);

const BN = (num: string | number) => BigNumber.from(num);

const USDT_AMOUNT = "1000000";
const ATEN_AMOUNT = "10000000";

let owner: Signer;
let liquidityProvider1: Signer;
let liquidityProvider2: Signer;
let provider1tokenId: BigNumberish;
let provider2tokenId: BigNumberish;

export function testLiquidityProvider() {
  describe("Liquidity provider deposit", function () {
    before(async function () {
      const allSigners = await ethers.getSigners();
      owner = allSigners[0];
      liquidityProvider1 = allSigners[1];
      liquidityProvider2 = allSigners[2];

      await this.helpers.addNewProtocolPool("Test protocol 0");
      await this.helpers.addNewProtocolPool("Test protocol 1");
      await this.helpers.addNewProtocolPool("Test protocol 2");
    });

    describe("Should simulate liquidity provider actions", async function () {
      let atokenBalance = BN(0);

      describe("Should do actions of liquidity provider 1", async function () {
        const USDT_amount = "400000";
        const ATEN_amount = "100000";
        it("Should prepare USDT balance", async function () {
          expect(
            await this.contracts.USDT.balanceOf(
              await liquidityProvider1.getAddress(),
            ),
          ).to.be.equal(0);

          await this.helpers.getUsdt(
            await liquidityProvider1.getAddress(),
            ethers.utils.parseUnits(USDT_amount, 6),
          );

          expect(
            await this.contracts.USDT.balanceOf(
              await liquidityProvider1.getAddress(),
            ),
          ).to.be.equal(ethers.utils.parseUnits(USDT_amount, 6));
        });

        it("Should prepare ATEN balance", async function () {
          expect(
            await this.contracts.ATEN.balanceOf(
              await liquidityProvider1.getAddress(),
            ),
          ).to.be.equal(0);

          await this.helpers.getAten(
            await liquidityProvider1.getAddress(),
            ATEN_amount,
          );

          const amountExpected = ATEN_amount;

          expect(
            await this.contracts.ATEN.balanceOf(
              await liquidityProvider1.getAddress(),
            ),
          ).to.be.equal(amountExpected);
        });

        it("Should success deposit funds into the protocols 0 and 2", async function () {
          const USDT_Approved = await this.contracts.USDT.connect(
            liquidityProvider1,
          ).approve(
            this.contracts.Athena.address,
            ethers.utils.parseUnits(USDT_AMOUNT, 6),
          );

          expect(USDT_Approved).to.haveOwnProperty("transactionHash");

          const ATEN_Approved = await this.contracts.ATEN.connect(
            liquidityProvider1,
          ).approve(
            this.contracts.StakingGeneralPool.address,
            ethers.utils.parseUnits(ATEN_AMOUNT, 18),
          );

          expect(ATEN_Approved).to.haveOwnProperty("transactionHash");

          await setNextBlockTimestamp(5 * 24 * 60 * 60);

          const tx = await this.contracts.Athena.connect(
            liquidityProvider1,
          ).deposit(USDT_amount, [0, 2]);

          const provider1tokenIds =
            await this.contracts.PositionsManager.connect(
              liquidityProvider1,
            ).allPositionTokensOfOwner(await liquidityProvider1.getAddress());
          provider1tokenId = provider1tokenIds[0];

          expect(tx).to.haveOwnProperty("hash");
        });

        it("Should check slot0 in protocol 0", async function () {
          const protocolContract = await this.helpers.getProtocolPoolContract(
            liquidityProvider1,
            0,
          );
          const slot0 = await protocolContract.slot0();

          expect(slot0.tick).to.be.equal(0);
          expect(slot0.secondsPerTick).to.be.equal("86400");
          expect(slot0.totalInsuredCapital).to.be.equal("0");
          expect(slot0.remainingPolicies).to.be.equal("0");
          expect(slot0.lastUpdateTimestamp).to.be.equal(await getCurrentTime());

          const premiumRate = await protocolContract.getCurrentPremiumRate();
          expect(premiumRate).to.be.equal("1000000000000000000000000000");

          const availableCapital = await protocolContract.availableCapital();
          expect(availableCapital).to.be.equal("400000");
        });

        it("Should check funds and NFT", async function () {
          const POSITIONS_MANAGER_CONTRACT = this.contracts.PositionsManager;

          const position =
            await POSITIONS_MANAGER_CONTRACT.position(provider1tokenId);
          expect(position.amountSupplied).to.equal(BN(USDT_amount));
          expect(position.poolIds).to.deep.equal([BN(0), BN(2)]);

          // we check AAVE aToken balance
          atokenBalance = atokenBalance.add(USDT_amount);
          expect(
            (await this.helpers.balanceOfAaveUsdt(liquidityProvider1)).gte(
              atokenBalance,
            ),
          ).to.be.true;
        });

        it("Should check relatedProtocols of Protocol 0", async function () {
          const protocolContract = await this.helpers.getProtocolPoolContract(
            owner,
            0,
          );

          const protocol0Index =
            await protocolContract.intersectingAmountIndexes(0);

          expect(protocol0Index).to.be.equal(0);

          expect(
            await protocolContract.relatedProtocols(protocol0Index),
          ).to.be.equal(0);

          expect(
            await protocolContract.intersectingAmounts(protocol0Index),
          ).to.be.equal("400000");

          const protocol2Index =
            await protocolContract.intersectingAmountIndexes(2);

          expect(
            await protocolContract.relatedProtocols(protocol2Index),
          ).to.be.equal(2);

          expect(
            await protocolContract.intersectingAmounts(protocol2Index),
          ).to.be.equal("400000");
        });
      });

      describe("Should do actions of liquidity provider 2", function () {
        const USDT_amount = "330000";
        const ATEN_amount = "9000000";
        it("Should prepare USDT balance", async function () {
          expect(
            await this.contracts.USDT.balanceOf(
              await liquidityProvider2.getAddress(),
            ),
          ).to.be.equal(0);

          await this.helpers.getUsdt(
            await liquidityProvider2.getAddress(),
            ethers.utils.parseUnits(USDT_amount, 6),
          );

          expect(
            await this.contracts.USDT.balanceOf(
              await liquidityProvider2.getAddress(),
            ),
          ).to.be.equal(ethers.utils.parseUnits(USDT_amount, 6));
        });

        it("Should prepare ATEN balance", async function () {
          expect(
            await this.contracts.ATEN.balanceOf(
              await liquidityProvider2.getAddress(),
            ),
          ).to.be.equal(0);

          await this.helpers.getAten(
            await liquidityProvider2.getAddress(),
            ATEN_amount,
          );

          const amountExpected = ATEN_amount;

          expect(
            await this.contracts.ATEN.balanceOf(
              await liquidityProvider2.getAddress(),
            ),
          ).to.be.equal(amountExpected);
        });

        it("Should success deposit funds into protocol 0, 1 and 2", async function () {
          const USDT_Approved = await this.contracts.USDT.connect(
            liquidityProvider2,
          ).approve(
            this.contracts.Athena.address,
            ethers.utils.parseUnits(USDT_AMOUNT, 6),
          );

          expect(USDT_Approved).to.haveOwnProperty("transactionHash");

          const ATEN_Approved = await this.contracts.ATEN.connect(
            liquidityProvider2,
          ).approve(
            this.contracts.StakingGeneralPool.address,
            ethers.utils.parseUnits(ATEN_AMOUNT, 18),
          );

          expect(ATEN_Approved).to.haveOwnProperty("transactionHash");

          await setNextBlockTimestamp(10 * 24 * 60 * 60);

          const tx = await this.contracts.Athena.connect(
            liquidityProvider2,
          ).deposit(USDT_amount, [0, 1, 2]);

          const provider2tokenIds =
            await this.contracts.PositionsManager.connect(
              liquidityProvider2,
            ).allPositionTokensOfOwner(await liquidityProvider2.getAddress());
          provider2tokenId = provider2tokenIds[0];

          expect(tx).to.haveOwnProperty("hash");
        });

        it("Should check slot0 in protocol 0", async function () {
          const protocolContract = await this.helpers.getProtocolPoolContract(
            liquidityProvider2,
            0,
          );
          const slot0 = await protocolContract.slot0();

          expect(slot0.tick).to.be.equal(0);
          expect(slot0.secondsPerTick).to.be.equal("86400");
          expect(slot0.totalInsuredCapital).to.be.equal("0");
          expect(slot0.remainingPolicies).to.be.equal("0");
          expect(slot0.lastUpdateTimestamp).to.be.equal(await getCurrentTime());

          const premiumRate = await protocolContract.getCurrentPremiumRate();
          expect(premiumRate).to.be.equal("1000000000000000000000000000");

          const availableCapital = await protocolContract.availableCapital();
          expect(availableCapital).to.be.equal("730000");
        });

        it("Should check funds and NFT", async function () {
          const POSITIONS_MANAGER_CONTRACT = this.contracts.PositionsManager;

          const position =
            await POSITIONS_MANAGER_CONTRACT.position(provider2tokenId);
          expect(position.amountSupplied).to.equal(BN(USDT_amount));
          expect(position.poolIds).to.deep.equal([BN(0), BN(1), BN(2)]);

          // we check AAVE aToken balance
          atokenBalance = atokenBalance.add(USDT_amount);
          expect(
            (await this.helpers.balanceOfAaveUsdt(liquidityProvider1)).gte(
              atokenBalance,
            ),
          ).to.be.true;
        });

        it("Should check relatedProtocols of Protocol 0", async function () {
          const protocolContract = await this.helpers.getProtocolPoolContract(
            owner,
            0,
          );

          const protocol0Index =
            await protocolContract.intersectingAmountIndexes(0);

          expect(protocol0Index).to.be.equal(0);

          expect(
            await protocolContract.relatedProtocols(protocol0Index),
          ).to.be.equal(0);

          expect(
            await protocolContract.intersectingAmounts(protocol0Index),
          ).to.be.equal("730000");

          const protocol1Index =
            await protocolContract.intersectingAmountIndexes(1);

          expect(protocol1Index).to.be.equal(2);

          expect(
            await protocolContract.relatedProtocols(protocol1Index),
          ).to.be.equal(1);

          expect(
            await protocolContract.intersectingAmounts(protocol1Index),
          ).to.be.equal("330000");

          const protocol2Index =
            await protocolContract.intersectingAmountIndexes(2);

          expect(protocol2Index).to.be.equal(1);

          expect(
            await protocolContract.relatedProtocols(protocol2Index),
          ).to.be.equal(2);

          expect(
            await protocolContract.intersectingAmounts(protocol2Index),
          ).to.be.equal("730000");
        });
      });
    });
  });
}
