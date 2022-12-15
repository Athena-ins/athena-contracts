// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IPositionsManager is IERC721Enumerable {
  struct Position {
    uint256 createdAt;
    uint256 amountSupplied;
    uint256 aaveScaledBalance;
    uint128 discount;
    uint128[] protocolIds;
  }

  struct PositionInfo {
    uint256 positionId;
    uint256 premiumReceived;
    Position position;
  }

  function position(uint256 tokenId) external view returns (Position memory);

  // @bw fn is redundant with deposit in this contrat
  // should be deleted
  // function mint(
  //   address to,
  //   uint128 discount,
  //   uint256 amount,
  //   uint256 aaveScaledBalance,
  //   uint256 atenStake,
  //   uint128[] calldata protocolsIds
  // ) external;

  function burn(uint256 tokenId) external;

  function update(
    uint256 tokenId,
    uint256 amount,
    uint256 aaveScaledBalance,
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
    uint128 stakingDiscount,
    uint128[] calldata protocolIds
  ) external;

  // function updatePosition(
  //   address account,
  //   uint256 tokenId,
  //   uint256 addingAmount,
  //   uint256 addingAtens
  // ) external;

  function takeInterest(
    address account,
    uint256 tokenId,
    uint128 protocolId
  ) external;
}
