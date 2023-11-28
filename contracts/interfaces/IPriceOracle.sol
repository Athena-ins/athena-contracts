// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IPriceOracle {
  function getAtenPrice() external view returns (uint256);
}
