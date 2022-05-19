// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IPositionsManager is IERC721Enumerable {
  function positions(uint256 _tokenId)
    external
    view
    returns (
      uint256 liquidity,
      uint128[] memory protocolsId,
      uint256 atokens,
      uint128 discount
    );

  function mint(
    address to,
    uint128 discount,
    uint256 amount,
    uint256 _atokenBalance,
    uint256 atenStake,
    uint128[] calldata _protocolsIds
  ) external;

  function burn(address to) external;

  function update(
    uint128 _discount,
    uint256 amount,
    uint256 _atokenBalance,
    uint256 atenStake,
    uint128[] calldata _protocolsIds,
    uint256 tokenId
  ) external;
}
