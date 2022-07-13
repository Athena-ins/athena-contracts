import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "./helpers/HardhatHelper";
import ProtocolHelper from "./helpers/ProtocolHelper";

chai.use(chaiAsPromised);

const bn = (num: string | number) => hre_ethers.BigNumber.from(num);

import { BigNumber, BigNumberish } from "ethers";

const RAY = bn(10).pow(27);
const halfRAY = RAY.div(2);

function ray(n: BigNumberish) {
  return RAY.mul(n);
}

function rayMul(a: BigNumberish, b: BigNumberish) {
  return bn(a.toString()).mul(b).add(halfRAY).div(RAY);
}

function rayDiv(a: BigNumberish, b: BigNumberish) {
  return bn(a.toString()).mul(RAY).add(bn(b.toString()).div(2)).div(b);
}

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
let policyTaker1: ethers.Signer;
let policyTaker2: ethers.Signer;
let policyTaker3: ethers.Signer;

describe("Liquidity provider rewards", () => {
  before(async () => {
    await HardhatHelper.reset();
    const allSigners = await HardhatHelper.allSigners();
    owner = allSigners[0];
    liquidityProvider1 = allSigners[1];
    liquidityProvider2 = allSigners[2];
    policyTaker1 = allSigners[100];
    policyTaker2 = allSigners[101];
    policyTaker3 = allSigners[102];

    await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
    await ProtocolHelper.addNewProtocolPool("Test protocol 0");
    await ProtocolHelper.addNewProtocolPool("Test protocol 1");
    await ProtocolHelper.addNewProtocolPool("Test protocol 2");

    const USDT_amount1 = "400000";
    const ATEN_amount1 = "100000";
    await ProtocolHelper.deposit(
      liquidityProvider1,
      USDT_amount1,
      ATEN_amount1,
      [0, 2],
      1 * 24 * 60 * 60
    );

    // console.log("deposit lp2");
    const USDT_amount2 = "330000";
    const ATEN_amount2 = "9000000";
    await ProtocolHelper.deposit(
      liquidityProvider2,
      USDT_amount2,
      ATEN_amount2,
      [0, 1],
      1 * 24 * 60 * 60
    );

    const capital1 = "109500";
    const premium1 = "2190";
    const atensLocked1 = "0";
    await ProtocolHelper.buyPolicy(
      policyTaker1,
      capital1,
      premium1,
      atensLocked1,
      0,
      20 * 24 * 60 * 60
    );

    const capital2 = "219000";
    const premium2 = "8760";
    const atensLocked2 = "0";
    await ProtocolHelper.buyPolicy(
      policyTaker2,
      capital2,
      premium2,
      atensLocked2,
      0,
      10 * 24 * 60 * 60
    );
  });

  describe("Rewards of LP1", async () => {
    it("Should call rewardsOf and check data", async () => {
      let protocolPool0 = await ProtocolHelper.getProtocolPoolContract(
        owner,
        0
      );

      let reponse = await protocolPool0._rewardsOf(
        await liquidityProvider1.getAddress(),
        400000,
        [0, 2],
        HardhatHelper.getCurrentTime() + 1 * 24 * 60 * 60
      );

      console.log("avant claim");
      console.log("slot0:", await protocolPool0.slot0());
      console.log("reward:", reponse);

      await ProtocolHelper.claim(owner, 2, "182500", 1 * 24 * 60 * 60);

      const claim = await protocolPool0.claims(0);
      console.log("claim:", claim);

      reponse = await protocolPool0._rewardsOf(
        await liquidityProvider1.getAddress(),
        400000,
        [0, 2],
        HardhatHelper.getCurrentTime() + 1 * 24 * 60 * 60
      );

      //   console.log("apres claim");
      //   console.log(await protocolPool0.slot0());
      console.log("reward:", reponse);

      const capital1 = bn("400000000000000000000000000000000");
      const rewards1 = bn("52602739726027397260273920160");

      const capital2 = bn("330000000000000000000000000000000");
      const rewards2 = bn("96000000000000000000000000000").sub(rewards1); //43397260273972602739726079840
      console.log("rewards2:", rewards2);

      const removeFromCapital1 = bn("182500000000000000000000000000000");
      const capital1AfterRemove = capital1.sub(removeFromCapital1);
      console.log("capital1AfterRemove:", capital1AfterRemove);

      const totalSupplyReal = capital1AfterRemove
        .add(rewards1)
        .add(capital2)
        .add(rewards2);

      console.log("totalSupplyReal:", totalSupplyReal);

      const rewards1AfterClaim = rayDiv(
        rayMul(
          bn("45000000000000000000000000000"),
          capital1AfterRemove.add(rewards1)
        ),
        totalSupplyReal
      );
      console.log("rewards1 after claim:", rewards1AfterClaim);

      console.log("totalRewards1:", rewards1.add(rewards1AfterClaim));
    });
  });
});
