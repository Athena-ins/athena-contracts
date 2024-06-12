import hre from "hardhat";
import { ProtocolContracts } from "../../test/helpers/deployers";

export type ProtocolContractsAddresses = {
  [K in keyof ProtocolContracts]: string;
};

function fromFork() {
  const forkTarget = process.env.HARDHAT_FORK_TARGET?.toLowerCase();

  if (!forkTarget || forkTarget !== "arbitrum") {
    throw Error("Missing or erroneous fork target");
  }

  return forkTarget === "arbitrum" ? "arbitrum" : "";
}

const networkAddresses: {
  [key: string]: ProtocolContractsAddresses;
} = {
  // arbitrum: {
  // },
};

export function getNetworkAddresses() {
  const networkName = hre.network.name;
  const addresses =
    networkName === "hardhat"
      ? networkAddresses[fromFork()]
      : networkAddresses[networkName];

  if (!addresses) throw Error(`Missing addresses for network ${networkName}`);

  return addresses;
}
