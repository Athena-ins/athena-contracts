// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Interfaces
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

interface IAthenaPositionToken is IERC721 {
  function mint(address to, uint256 tokenId) external;

  function burn(uint256 tokenId) external;
}
