import chai, { expect } from "chai";
import { ethers as hre_ethers } from "hardhat";
import { ethers } from "ethers";
import chaiAsPromised from "chai-as-promised";

import HardhatHelper from "./helpers/HardhatHelper";
import ProtocolHelper from "./helpers/ProtocolHelper";

chai.use(chaiAsPromised);

const BN = (num: string | number) => hre_ethers.BigNumber.from(num);

let owner: ethers.Signer;
let liquidityProvider1: ethers.Signer;
let liquidityProvider2: ethers.Signer;
let liquidityProvider3: ethers.Signer;
let policyTaker1: ethers.Signer;
let policyTaker2: ethers.Signer;
let policyTaker3: ethers.Signer;

describe("Staking General Pool", function () {
  before(async function () {
    await HardhatHelper.reset();
    const allSigners = await HardhatHelper.allSigners();
    owner = allSigners[0];
    liquidityProvider1 = allSigners[1];
    liquidityProvider2 = allSigners[2];
    liquidityProvider3 = allSigners[3];
    policyTaker1 = allSigners[100];
    policyTaker2 = allSigners[101];
    policyTaker3 = allSigners[102];

    await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
    // await ProtocolHelper.addNewProtocolPool("Test protocol 0");
    // await ProtocolHelper.addNewProtocolPool("Test protocol 1");
    // await ProtocolHelper.addNewProtocolPool("Test protocol 2");
    // await ProtocolHelper.addNewProtocolPool("Test protocol 3");

    // ================= Cover Providers ================= //

    // const USDT_amount1 = "4000000";
    // const ATEN_amount1 = "100";
    // await ProtocolHelper.deposit(
    //   liquidityProvider1,
    //   USDT_amount1,
    //   ATEN_amount1,
    //   [0, 2],
    //   1 * 24 * 60 * 60
    // );

    // const USDT_amount2 = "330";
    // const ATEN_amount2 = "9000000";
    // await ProtocolHelper.deposit(
    //   liquidityProvider2,
    //   USDT_amount2,
    //   ATEN_amount2,
    //   [0, 1, 2],
    //   1 * 24 * 60 * 60
    // );

    // const USDT_amount3 = "36500";
    // const ATEN_amount3 = "9000";
    // await ProtocolHelper.deposit(
    //   liquidityProvider3,
    //   USDT_amount3,
    //   ATEN_amount3,
    //   [1, 3],
    //   1 * 24 * 60 * 60
    // );

    // ================= Policy Buyers ================= //

    // await HardhatHelper.USDT_maxApprove(
    //   policyTaker1,
    //   ProtocolHelper.getAthenaContract().address
    // );

    // const capital1 = "109500";
    // const capital1_2 = "140";
    // const premium1 = "2190";
    // const atensLocked1 = "0";
    // await ProtocolHelper.buyPolicies(
    //   policyTaker1,
    //   [capital1, capital1_2],
    //   [premium1, premium1],
    //   [atensLocked1, atensLocked1],
    //   [0, 3],
    //   20 * 24 * 60 * 60
    // );

    // await HardhatHelper.USDT_maxApprove(
    //   policyTaker2,
    //   ProtocolHelper.getAthenaContract().address
    // );

    // const capital2 = "219000";
    // const premium2 = "8760";
    // const atensLocked2 = "0";
    // await ProtocolHelper.buyPolicy(
    //   policyTaker2,
    //   capital2,
    //   premium2,
    //   atensLocked2,
    //   0,
    //   10 * 24 * 60 * 60
    // );

    // await HardhatHelper.USDT_maxApprove(
    //   policyTaker3,
    //   ProtocolHelper.getAthenaContract().address
    // );

    // const capital3 = "182500";
    // const premium3 = "8760";
    // const atensLocked3 = "0";
    // await ProtocolHelper.buyPolicy(
    //   policyTaker3,
    //   capital3,
    //   premium3,
    //   atensLocked3,
    //   2,
    //   10 * 24 * 60 * 60
    // );
  });

  it("Should check staking rate of liquidity providers", async function () {
    const ATHENA_CONTRACT = ProtocolHelper.getAthenaContract();
    const feeLevels = await ATHENA_CONTRACT.connect(
      owner
    ).getAtenStakingFeeLevels();

    console.log("feeLevels: ", feeLevels);
  });
});
