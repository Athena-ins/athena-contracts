// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

library IsContract {
  /**
   * @notice Checks if address is a contract
   * @param address_ address to check
   * @return true if address is a contract
   *
   * @dev This function will return false if the address is:
   * - an externally-owned account
   * - a contract in construction
   * - an address where a contract will be created
   * - an address where a contract lived, but was destroyed
   * All this is considered acceptable for the intended use cases.
   *
   */
  function _isContract(
    address address_
  ) internal view returns (bool) {
    uint32 size;
    assembly {
      size := extcodesize(address_)
    }
    return (size > 0);
  }
}
