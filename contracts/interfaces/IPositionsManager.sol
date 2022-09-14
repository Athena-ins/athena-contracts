// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IPositionsManager {
  function positions(address _owner)
    external
    view
    returns (
      uint256 liquidity,
      uint128[] memory protocolsId,
      uint256 aaveScaledBalance,
      uint128 discount
    );

  function createPosition(
    address to,
    uint128 discount,
    uint256 amount,
    uint256 aaveScaledBalance,
    uint256 atenStake,
    uint128[] calldata protocolsIds
  ) external;

  function removePosition(address to) external;

  function update(
    address to,
    uint128 discount,
    uint256 amount,
    uint256 aaveScaledBalance,
    uint256 atenStake,
    uint128[] calldata protocolsIds
  ) external;

  function updateUserCapital(
    address to,
    uint256 amount,
    uint256 aaveScaledBalance
  ) external;

  function removeProtocolId(address to, uint128 protocolId) external;

  function hasPositionOf(address to) external returns (bool);
}
