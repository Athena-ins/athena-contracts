// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

import { TransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract StrategyManagerProxy is TransparentUpgradeableProxy {
  constructor(
    address _logic,
    address initialOwner,
    bytes memory /* _data */
  ) TransparentUpgradeableProxy(_logic, initialOwner, "") {
    // Copy all the important storage slots from the implementation

    // Slot for liquidityManager
    copyStorageSlot(_logic, 0);

    // Slot for ecclesiaDao
    copyStorageSlot(_logic, 1);

    // Slot for buybackWallet
    copyStorageSlot(_logic, 2);

    // Slot for payoutDeductibleRate
    copyStorageSlot(_logic, 3);

    // Slot for strategyFeeRate
    copyStorageSlot(_logic, 4);

    // Slots for immutable variables will be accessed directly from implementation
    // aaveLendingPool, USDC, aUSDC, wstETH, amphrETH, amphrLRT,
    // morphoMevVaultUnderlying, morphoMevVault are all immutable
  }

  function copyStorageSlot(address _source, uint256 _slot) internal {
    assembly {
      sstore(_slot, sload(add(_source, _slot)))
    }
  }
}
