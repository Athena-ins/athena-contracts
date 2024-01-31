// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Interfaces
import { IERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

interface IAthenaCoverToken is IERC721Enumerable {
  function mint(address to, uint256 tokenId) external;

  function burn(uint256 tokenId) external;
}
