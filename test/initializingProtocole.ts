import { ethers } from "ethers";

import HardhatHelper from "./helpers/HardhatHelper";
import ProtocolHelper from "./helpers/ProtocolHelper";

async function initProtocol(poolNumber: number) {
  const allSigners = await HardhatHelper.allSigners();
  let owner = allSigners[0];
  console.log("owner:", await owner.getAddress());

  await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
  console.log("Athena:", ProtocolHelper.getAthenaContract().address);
  console.log("Athena view:", ProtocolHelper.getAthenaViewContract().address);

  for (let i = 0; i < poolNumber; i++)
    await ProtocolHelper.addNewProtocolPool(`Pool ${i}`);

  const stablecoin = await ProtocolHelper.getAthenaContract().stablecoin();
  console.log("stablecoin:", stablecoin);
}

async function deposit() {
  await HardhatHelper.initSigners();
  const allSigners = await HardhatHelper.allSigners();

  const usdtBillion = allSigners[301];
  await HardhatHelper.USDT_transfer(
    await usdtBillion.getAddress(),
    ethers.utils.parseUnits("100000000", 6)
  );
  console.log("USDT billion:", await usdtBillion.getAddress());

  let liquidityProvider1 = allSigners[1];
  console.log("liquidity provider:", await liquidityProvider1.getAddress());

  const USDT_amount = "365000";
  const ATEN_amount = "100000";

  await HardhatHelper.USDT_transfer(
    await liquidityProvider1.getAddress(),
    ethers.utils.parseUnits(USDT_amount, 6)
  );

  await HardhatHelper.USDT_approve(
    liquidityProvider1,
    ProtocolHelper.getAthenaContract().address,
    ethers.utils.parseUnits(USDT_amount, 6)
  );

  await HardhatHelper.ATEN_transfer(
    await liquidityProvider1.getAddress(),
    ethers.utils.parseEther(ATEN_amount)
  );

  await HardhatHelper.ATEN_approve(
    liquidityProvider1,
    ProtocolHelper.getStakedAtenContract().address,
    ethers.utils.parseUnits(ATEN_amount, 18)
  );

  await ProtocolHelper.getAthenaContract()
    .connect(liquidityProvider1)
    .deposit(USDT_amount, ATEN_amount, [0, 2, 5, 7, 1]);

  console.log("Fin deposit");
}

async function buyPolicies() {
  await HardhatHelper.initSigners();
  const allSigners = await HardhatHelper.allSigners();
  let policyTaker1 = allSigners[101];
  console.log("policy taker:", await policyTaker1.getAddress());

  await HardhatHelper.USDT_maxApprove(
    policyTaker1,
    ProtocolHelper.getAthenaContract().address
  );

  const capital = "109500";
  const premium = "2190";
  const atensLocked = "0";
  await HardhatHelper.USDT_transfer(
    await policyTaker1.getAddress(),
    ethers.utils.parseUnits(premium, 6)
  );

  await ProtocolHelper.getAthenaContract()
    .connect(policyTaker1)
    .buyPolicies([capital], [premium], [atensLocked], [2]);

  console.log("Fin buy policies");
}

async function run() {
  await initProtocol(10);
  await deposit();
  await buyPolicies();
}

run();
