// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

// Interfaces
import { IERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

interface IAthenaCoverToken is IERC721Enumerable {
  function nextCoverId() external returns (uint256 coverId);

  function mint(address to) external returns (uint256 coverId);

  function burn(uint256 tokenId) external;

  function tokensOf(
    address account_
  ) external view returns (uint256[] memory);
}
