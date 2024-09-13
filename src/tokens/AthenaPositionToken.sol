// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

// Contracts
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Interfaces
import { IAthenaPositionToken } from "../interfaces/IAthenaPositionToken.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";

// ======= ERRORS ======= //
error NotLiquidtyManager();

/**
 * @title AthenaPositionToken
 * @notice ERC-721 token representing a LP position in the Athena protocol
 * @dev The Athena position ID is equivalent to the ERC-721 token ID
 */
contract AthenaPositionToken is
  IAthenaPositionToken,
  ERC721Enumerable,
  Ownable
{
  // ======= STORAGE ======= //

  /// The address of the liquidity manager contract
  ILiquidityManager public liquidityManager;
  /// The base data URI for querying position metadata
  string public baseDataURI;

  /// The ID of the next position to be minted
  uint256 public nextPositionId;

  // ======= CONSTRUCTOR ======= //

  constructor(
    ILiquidityManager liquidityManager_
  )
    ERC721("Athena Liquidity Position Token", "AthenaLPT")
    Ownable(msg.sender)
  {
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
   * @notice Mints a new position token
   * @param to The account to receive the position token
   * @return positionId The ID of the minted position token
   *
   * @dev Only the liquidity manager can mint position tokens
   */
  function mint(
    address to
  ) external onlyLiquidityManager returns (uint256 positionId) {
    // Save new position ID and update for next
    positionId = nextPositionId;
    nextPositionId++;

    _mint(to, positionId);
  }

  /**
   * @notice Burns a position token
   * @param positionId The ID of the position token to burn
   *
   * @dev Only the liquidity manager can burn position tokens
   */
  function burn(uint256 positionId) external onlyLiquidityManager {
    _burn(positionId);
  }

  /// ======= ADMIN ======= ///

  /**
   * @notice Updates the base data URI for position tokens
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
