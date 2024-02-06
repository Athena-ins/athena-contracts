// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Contracts
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Interfaces
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";

// ======= ERRORS ======= //
error NotLiquidtyManager();

/**
 * @title AthenaCoverToken
 * @notice ERC-721 token representing a cover in the Athena protocol
 * @dev The Athena cover ID is equivalent to the ERC-721 token ID
 */
contract AthenaCoverToken is
  IAthenaCoverToken,
  ERC721Enumerable,
  Ownable
{
  // ======= STORAGE ======= //

  ILiquidityManager public liquidityManager;
  string public baseDataURI;

  // ======= CONSTRUCTOR ======= //

  constructor(
    ILiquidityManager liquidityManager_
  ) ERC721("Athena Cover Token", "ACTv1") Ownable(msg.sender) {
    liquidityManager = liquidityManager_;
  }

  /// ======= OVERRIDES ======= ///

  function _baseURI() internal view override returns (string memory) {
    return baseDataURI;
  }

  /// ======= MODIFIERS ======= ///

  modifier onlyLiquidityManager() {
    if (msg.sender != address(liquidityManager))
      revert NotLiquidtyManager();
    _;
  }

  /// ======= VIEWS ======= ///

  function tokensOf(
    address account_
  ) external view returns (uint256[] memory) {
    uint256[] memory tokens = new uint256[](balanceOf(account_));
    for (uint256 i = 0; i < tokens.length; i++) {
      tokens[i] = tokenOfOwnerByIndex(account_, i);
    }
    return tokens;
  }

  /// ======= ERC-721 FUNCTIONS ======= ///

  function mint(
    address to,
    uint256 coverId // equivalent to tokenId
  ) external onlyLiquidityManager {
    _mint(to, coverId);
  }

  function burn(uint256 coverId) external onlyLiquidityManager {
    _burn(coverId);
  }

  /// ======= ADMIN ======= ///

  function updateBaseDataURI(
    string calldata baseDataURI_
  ) external onlyOwner {
    baseDataURI = baseDataURI_;
  }

  function updateLiquidityManager(
    ILiquidityManager liquidityManager_
  ) external onlyOwner {
    liquidityManager = liquidityManager_;
  }
}
