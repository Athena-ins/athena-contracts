// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

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

  ILiquidityManager public liquidityManager;
  string public baseDataURI;

  // ======= CONSTRUCTOR ======= //

  constructor(
    ILiquidityManager liquidityManager_
  ) ERC721("Athena Position Token", "APTv1") Ownable(msg.sender) {
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
    uint256 positionId
  ) external onlyLiquidityManager {
    _mint(to, positionId);
  }

  function burn(uint256 positionId) external onlyLiquidityManager {
    _burn(positionId);
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
