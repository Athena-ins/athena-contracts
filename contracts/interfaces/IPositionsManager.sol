// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IPositionsManager is IERC721Enumerable {
  //Thao@TODO: il faut changer atokens en aaveScaledBalance
  function positions(uint256 _tokenId)
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
    uint128 discount,
    uint256 amount,
    uint256 aaveScaledBalance,
    uint256 atenStake,
    uint128[] calldata protocolsIds,
    uint256 tokenId
  ) external;

  function updateUserCapital(
    uint256 tokenId,
    uint256 amount,
    uint256 aaveScaledBalance
  ) external;

  function removeProtocolId(uint256 tokenId, uint128 protocolId) external;
}
