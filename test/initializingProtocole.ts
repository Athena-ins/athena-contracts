import { ethers } from "ethers";

import HardhatHelper from "./helpers/HardhatHelper";
import ProtocolHelper from "./helpers/ProtocolHelper";

let owner: ethers.Signer;

async function initProtocol(poolNumber: number) {
  await HardhatHelper.reset();
  const allSigners = await HardhatHelper.allSigners();
  owner = allSigners[0];

  await ProtocolHelper.deployAllContractsAndInitializeProtocol(owner);
  for (let i = 0; i < poolNumber; i++)
    await ProtocolHelper.addNewProtocolPool(`Pool ${poolNumber}`);

  const stablecoin = await ProtocolHelper.getAthenaContract().stablecoin();
  console.log("stablecoin:", stablecoin);
  console.log("Athena:", ProtocolHelper.getAthenaContract().address);
  console.log("Athena view:", ProtocolHelper.getAthenaViewContract().address);
}

initProtocol(20);
