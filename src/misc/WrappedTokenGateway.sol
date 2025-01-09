// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// Contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "../libs/ReentrancyGuard.sol";

// Libraries
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IWETH } from "../interfaces/IWETH.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IAthenaPositionToken } from "../interfaces/IAthenaPositionToken.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";

error InsufficientETHSent();
error ETHTransferFailed();
error OnlyWETHCanSendETH();
error DirectETHTransfersNotAllowed();

/**
 * @title WrappedTokenGateway
 * @notice Gateway contract to interact with LiquidityManager using native ETH
 * @dev This contract wraps ETH to WETH for interactions with the LiquidityManager
 */
contract WrappedTokenGateway is Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  // Immutable addresses
  IWETH public immutable WETH;
  ILiquidityManager public immutable LIQUIDITY_MANAGER;
  IAthenaPositionToken public immutable POSITION_TOKEN;
  IAthenaCoverToken public immutable COVER_TOKEN;

  /**
   * @notice Sets the WETH address and the LiquidityManager address
   * @param weth Address of the Wrapped Ether contract
   * @param liquidityManager Address of the LiquidityManager contract
   * @param positionToken Address of the Position NFT contract
   * @param coverToken Address of the Cover NFT contract
   */
  constructor(
    address weth,
    address liquidityManager,
    address positionToken,
    address coverToken
  ) Ownable(msg.sender) {
    WETH = IWETH(weth);
    LIQUIDITY_MANAGER = ILiquidityManager(liquidityManager);
    POSITION_TOKEN = IAthenaPositionToken(positionToken);
    COVER_TOKEN = IAthenaCoverToken(coverToken);

    // Approve WETH for LiquidityManager
    IWETH(weth).approve(liquidityManager, type(uint256).max);
  }

  /**
   * @notice Opens a new position using ETH
   * @param poolIds The IDs of the pools to provide liquidity to
   */
  function openPositionETH(
    uint64[] calldata poolIds
  ) external payable nonReentrant {
    // Convert ETH to WETH
    WETH.deposit{ value: msg.value }();

    // Open position with WETH
    LIQUIDITY_MANAGER.openPosition(msg.value, false, poolIds);
  }

  /**
   * @notice Adds liquidity to an existing position using ETH
   * @param positionId The ID of the position
   */
  function addLiquidityETH(
    uint256 positionId
  ) external payable nonReentrant {
    // Store current owner
    address positionOwner = POSITION_TOKEN.ownerOf(positionId);

    // Transfer position NFT to this contract
    POSITION_TOKEN.transferFrom(
      positionOwner,
      address(this),
      positionId
    );

    // Convert ETH to WETH
    WETH.deposit{ value: msg.value }();

    // Add liquidity
    LIQUIDITY_MANAGER.addLiquidity(positionId, msg.value, false);

    // Return position NFT
    POSITION_TOKEN.transferFrom(
      address(this),
      positionOwner,
      positionId
    );
  }

  /**
   * @notice Removes liquidity from a position and returns ETH
   * @param positionId The ID of the position
   * @param amount The amount of liquidity to remove
   */
  function removeLiquidityETH(
    uint256 positionId,
    uint256 amount
  ) external nonReentrant {
    // Store current owner
    address positionOwner = POSITION_TOKEN.ownerOf(positionId);

    // Transfer position NFT to this contract
    POSITION_TOKEN.transferFrom(
      positionOwner,
      address(this),
      positionId
    );

    // Remove liquidity and get WETH
    LIQUIDITY_MANAGER.removeLiquidity(positionId, amount, false);

    // Convert WETH to ETH and send to user
    WETH.withdraw(amount);
    _safeTransferETH(positionOwner, amount);

    // Return position NFT
    POSITION_TOKEN.transferFrom(
      address(this),
      positionOwner,
      positionId
    );
  }

  /**
   * @notice Buys cover using ETH as payment
   * @param poolId The ID of the pool
   * @param coverAmount The amount of cover to buy
   * @param premiums The amount of premiums to pay
   */
  function openCoverETH(
    uint64 poolId,
    uint256 coverAmount,
    uint256 premiums
  ) external payable nonReentrant {
    if (msg.value < premiums) revert InsufficientETHSent();

    // Convert ETH to WETH
    WETH.deposit{ value: premiums }();

    // Buy cover with WETH
    LIQUIDITY_MANAGER.openCover(poolId, coverAmount, premiums);

    // Return excess ETH if any
    if (msg.value > premiums) {
      _safeTransferETH(msg.sender, msg.value - premiums);
    }
  }

  /**
   * @notice Updates or closes a cover using ETH for additional premiums
   * @param coverId The ID of the cover
   * @param coverToAdd The amount of cover to add
   * @param coverToRemove The amount of cover to remove
   * @param premiumsToAdd The amount of premiums to add
   * @param premiumsToRemove The amount of premiums to remove
   */
  function updateCoverETH(
    uint256 coverId,
    uint256 coverToAdd,
    uint256 coverToRemove,
    uint256 premiumsToAdd,
    uint256 premiumsToRemove
  ) external payable nonReentrant {
    if (msg.value < premiumsToAdd) revert InsufficientETHSent();

    // Store current owner
    address coverOwner = COVER_TOKEN.ownerOf(coverId);

    // Transfer cover NFT to this contract
    COVER_TOKEN.transferFrom(coverOwner, address(this), coverId);

    // Convert ETH to WETH if adding premiums
    if (premiumsToAdd > 0) {
      WETH.deposit{ value: premiumsToAdd }();
    }

    // Update cover
    LIQUIDITY_MANAGER.updateCover(
      coverId,
      coverToAdd,
      coverToRemove,
      premiumsToAdd,
      premiumsToRemove
    );

    // Return cover NFT
    COVER_TOKEN.transferFrom(address(this), coverOwner, coverId);

    // Return excess ETH if any
    if (msg.value > premiumsToAdd) {
      _safeTransferETH(msg.sender, msg.value - premiumsToAdd);
    }

    // If removing premiums, convert returned WETH to ETH and send to user
    if (premiumsToRemove > 0) {
      WETH.withdraw(premiumsToRemove);
      _safeTransferETH(coverOwner, premiumsToRemove);
    }
  }

  /**
   * @notice Helper function to transfer ETH to an address
   * @param to Address to transfer ETH to
   * @param value Amount of ETH to transfer
   */
  function _safeTransferETH(address to, uint256 value) internal {
    (bool success, ) = to.call{ value: value }(new bytes(0));
    if (!success) revert ETHTransferFailed();
  }

  /**
   * @notice Recovers ERC20 tokens accidentally sent to this contract
   * @param token The token contract address
   * @param to Address to send the tokens to
   * @param amount Amount of tokens to send
   */
  function saveTokens(
    address token,
    address to,
    uint256 amount
  ) external onlyOwner {
    if (token == address(0)) {
      _safeTransferETH(to, amount);
    } else {
      IERC20(token).safeTransfer(to, amount);
    }
  }

  /**
   * @notice Recovers ERC721 tokens accidentally sent to this contract
   * @param token The token contract address
   * @param to Address to send the tokens to
   * @param tokenId ID of the token to send
   */
  function saveERC721(
    address token,
    address to,
    uint256 tokenId
  ) external onlyOwner {
    IERC721(token).safeTransferFrom(address(this), to, tokenId);
  }
}
