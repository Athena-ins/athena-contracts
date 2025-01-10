// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// Contracts
import { TransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract BasicProxy is TransparentUpgradeableProxy {
  constructor(
    address implementation,
    address owner
  ) TransparentUpgradeableProxy(implementation, owner, "") {
    // Get owner from implementation
    address implementationOwner = Ownable(implementation).owner();

    // Copy owner to proxy's storage slot 0
    assembly {
      sstore(0, implementationOwner)
    }
  }
}
