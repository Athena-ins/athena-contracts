// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.19;

/**
 * @title LendingPoolAddressesProvider contract
 * @dev Main registry of addresses part of or connected to the protocol, including permissioned roles
 * - Acting also as factory of proxies and admin of those, so with right to change its implementations
 * - Owned by the Aave Governance
 * @author Aave
 **/
interface ILendingPoolAddressesProvider {
  function getMarketId() external view returns (string memory);

  function getAddress(bytes32 id) external view returns (address);

  function getLendingPool() external view returns (address);

  function getLendingPoolConfigurator() external view returns (address);

  function getLendingPoolCollateralManager() external view returns (address);

  function getPoolAdmin() external view returns (address);

  function getEmergencyAdmin() external view returns (address);

  function getPriceOracle() external view returns (address);

  function getLendingRateOracle() external view returns (address);
}
