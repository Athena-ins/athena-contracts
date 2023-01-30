// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @notice
 * PriceOracleV1 is a temporary oracle for the ATEN token price.
 * This contract will be upgraded to the Uniswap v3 TWAP price oracle method when the ATEN/USDT pool
 * has reached a trustworthy amounts of liquidity and registered enough price observations.
 */

contract PriceOracleV1 is Ownable {
  uint256 public referencePrice;
  uint256 public lastUpdate;

  constructor(uint256 initialPrice) {
    if (initialPrice == 0) revert PriceOfZero();

    referencePrice = initialPrice;
    lastUpdate = block.timestamp;
  }

  error PriceOfZero();

  /**
   * @notice
   * Get the lastest price from the temporary oracle.
   * @return _ amount of ATEN in wei for 1 USDT.
   */
  function getAtenPrice() external view returns (uint256) {
    if (referencePrice == 0) revert PriceOfZero();

    return referencePrice;
  }

  /**
   * @notice
   * Update the reference price for the oracle.
   * @param newPrice the amount of ATEN in wei for 1 USDT.
   */
  function updateReferencePrice(uint256 newPrice) external onlyOwner {
    if (newPrice == 0) revert PriceOfZero();

    referencePrice = newPrice;
    lastUpdate = block.timestamp;
  }
}
