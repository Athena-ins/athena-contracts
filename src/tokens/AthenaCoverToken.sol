// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

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

  /// The address of the liquidity manager contract
  ILiquidityManager public liquidityManager;
  /// The base data URI for querying cover metadata
  string public baseDataURI;

  /// The ID of the next cover to be minted
  uint256 public nextCoverId;

  // ======= CONSTRUCTOR ======= //

  constructor(
    ILiquidityManager liquidityManager_
  ) ERC721("Athena Cover Token", "AthenaCT") Ownable(msg.sender) {
    liquidityManager = liquidityManager_;
  }

  /// ======= OVERRIDES ======= ///

  /**
   * @dev See {ERC721-_baseURI}.
   */
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

  /**
   * @notice Returns the token IDs owned by an account
   * @param account_ The account to query
   * @return tokens The token IDs owned by the account
   */
  function tokensOf(
    address account_
  ) external view returns (uint256[] memory tokens) {
    tokens = new uint256[](balanceOf(account_));
    for (uint256 i = 0; i < tokens.length; i++) {
      tokens[i] = tokenOfOwnerByIndex(account_, i);
    }
    return tokens;
  }

  /// ======= ERC-721 FUNCTIONS ======= ///

  /**
   * @notice Mints a new cover token
   * @param to The account to receive the cover token
   * @return coverId The ID of the minted cover token
   *
   * @dev Only the liquidity manager can mint cover tokens
   */
  function mint(
    address to
  ) external onlyLiquidityManager returns (uint256 coverId) {
    // Save new cover ID and update for next
    coverId = nextCoverId;
    nextCoverId++;

    _mint(to, coverId);
  }

  /**
   * @notice Burns a cover token
   * @param coverId The ID of the cover token to burn
   *
   * @dev Only the liquidity manager can burn cover tokens
   */
  function burn(uint256 coverId) external onlyLiquidityManager {
    _burn(coverId);
  }

  /// ======= ADMIN ======= ///

  /**
   * @notice Updates the base data URI for cover tokens
   * @param baseDataURI_ The new base data URI
   */
  function updateBaseDataURI(
    string calldata baseDataURI_
  ) external onlyOwner {
    baseDataURI = baseDataURI_;
  }

  /**
   * @notice Updates the liquidity manager contract
   * @param liquidityManager_ The new liquidity manager contract
   */
  function updateLiquidityManager(
    ILiquidityManager liquidityManager_
  ) external onlyOwner {
    liquidityManager = liquidityManager_;
  }
}
