// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IPositionsManager is IERC721Enumerable {
  struct Position {
    address owner;
    uint256 providedLiquidity;
    //AAVE scaled balance to redeem
    uint256 aaveScaledBalance;
    //Aten to stake with position in stable
    uint256 atens;
    uint128 discount;
    // alternative would be mapping id to protocol data
    // like amount for Protocol, ...
    uint128[] protocolsId;
  }

  function position(uint256 tokenId) external view returns (Position memory);

  function positions(uint256 tokenId)
    external
    view
    returns (
      uint256 liquidity,
      uint128[] memory protocolsId,
      uint256 aaveScaledBalance,
      uint128 discount
    );

  function mint(
    address to,
    uint128 discount,
    uint256 amount,
    uint256 aaveScaledBalance,
    uint256 atenStake,
    uint128[] calldata protocolsIds
  ) external;

  function burn(address to) external;

  function update(
    uint256 tokenId,
    uint256 amount,
    uint256 aaveScaledBalance,
    uint256 atenStake,
    uint128 discount,
    uint128[] calldata protocolsIds
  ) external;

  function updateUserCapital(
    uint256 tokenId,
    uint256 amount,
    uint256 aaveScaledBalanceToRemove
  ) external;

  function removeProtocolId(uint256 tokenId, uint128 protocolId) external;

  function hasPositionOf(address to) external returns (bool);

  function deposit(
    address account,
    uint256 amount,
    uint256 atenToStake,
    uint128[] calldata protocolIds
  ) external;

  function updatePosition(
    address account,
    uint256 tokenId,
    uint256 addingAmount,
    uint256 addingAtens
  ) external;

  function takeInterest(
    address account,
    uint256 tokenIndex,
    uint128 protocolId
  ) external;
}
