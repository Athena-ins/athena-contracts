// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// Contracts
import { TransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract BasicProxy is TransparentUpgradeableProxy {
  constructor(
    address implementation,
    address owner
  ) TransparentUpgradeableProxy(implementation, owner, "") {}
}
