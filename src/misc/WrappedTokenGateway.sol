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
import { IStETH } from "../interfaces/IStETH.sol";
import { IWstETH } from "../interfaces/IWstETH.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IAthenaPositionToken } from "../interfaces/IAthenaPositionToken.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";

error WrongEthAmountSent();
error ETHTransferFailed();
error DirectETHTransfersNotAllowed();
error OnlyWETHCanSendETH();

/**
 * @title WrappedTokenGateway
 * @notice Gateway contract to interact with LiquidityManager using native ETH
 * @dev This contract wraps ETH to WETH for interactions with the LiquidityManager
 */
contract WrappedTokenGateway is Ownable, ReentrancyGuard {
  /// ======= LIBS ======= ///
  using SafeERC20 for IERC20;

  /// ======= STORAGE ======= ///

  // Immutable addresses
  IWETH public immutable WETH;
  IStETH public immutable STETH;
  IWstETH public immutable WSTETH;
  ILiquidityManager public LIQUIDITY_MANAGER;
  IStrategyManager public STRATEGY_MANAGER;
  IAthenaPositionToken public immutable POSITION_TOKEN;
  IAthenaCoverToken public immutable COVER_TOKEN;

  // @dev We add 1 to the strategy ID to know if the value is set
  mapping(uint256 poolId => uint256 strategyIdPlusOne)
    private _poolIdToStrategyIdPlusOne;

  /// ======= CONSTRUCTOR ======= ///

  /**
   * @notice Sets the token and manager addresses
   * @param weth Address of the Wrapped Ether contract
   * @param wsteth Address of the Lido wstETH contract
   * @param liquidityManager Address of the LiquidityManager contract
   * @param positionToken Address of the Position NFT contract
   * @param coverToken Address of the Cover NFT contract
   */
  constructor(
    address weth,
    address wsteth,
    address liquidityManager,
    address positionToken,
    address coverToken
  ) Ownable(msg.sender) {
    WETH = IWETH(weth);
    WSTETH = IWstETH(wsteth);
    // Fetch address of the Lido stETH contract from wstETH
    address steth = WSTETH.stETH();
    STETH = IStETH(steth);

    LIQUIDITY_MANAGER = ILiquidityManager(liquidityManager);
    STRATEGY_MANAGER = IStrategyManager(
      LIQUIDITY_MANAGER.strategyManager()
    );
    POSITION_TOKEN = IAthenaPositionToken(positionToken);
    COVER_TOKEN = IAthenaCoverToken(coverToken);

    // Approve tokens for LiquidityManager
    IWETH(weth).approve(liquidityManager, type(uint256).max);
    IERC20(wsteth).approve(liquidityManager, type(uint256).max);
    IERC20(steth).approve(liquidityManager, type(uint256).max);
    IERC20(steth).approve(wsteth, type(uint256).max);
  }

  /// ======= DEFAULTS ======= ///

  // Required to receive ETH from WETH withdrawals
  receive() external payable {
    if (msg.sender != address(WETH)) revert OnlyWETHCanSendETH();
  }

  // Prevent accidental ETH transfers
  fallback() external payable {
    revert DirectETHTransfersNotAllowed();
  }

  /// ======= MODIFIERS ======= ///

  /**
   * @notice Modifier to handle borrowing position NFT from user for operations
   * @param positionId The ID of the position token
   * @param isMint Whether the position is being minted (true) or already exists (false)
   * @dev If not minting, transfers position from user to contract, executes operation, then returns it
   */
  modifier borrowPositionFromUser(uint256 positionId, bool isMint) {
    if (!isMint) {
      POSITION_TOKEN.transferFrom(
        msg.sender,
        address(this),
        positionId
      );
    }
    _;
    POSITION_TOKEN.transferFrom(
      address(this),
      msg.sender,
      positionId
    );
  }

  /**
   * @notice Modifier to handle borrowing cover NFT from user for operations
   * @param coverId The ID of the cover token
   * @param isMint Whether the cover is being minted (true) or already exists (false)
   * @dev If not minting, transfers cover from user to contract, executes operation, then returns it
   */
  modifier borrowCoverFromUser(uint256 coverId, bool isMint) {
    if (!isMint) {
      COVER_TOKEN.transferFrom(msg.sender, address(this), coverId);
    }
    _;
    COVER_TOKEN.transferFrom(address(this), msg.sender, coverId);
  }

  /**
   * @notice Modifier to handle sending earned rewards to user after operations
   */
  modifier sendReceivedWethToUser() {
    _;
    // Convert any earned WETH to ETH and send to user
    uint256 wethBalance = WETH.balanceOf(address(this));
    if (wethBalance > 0) {
      WETH.withdraw(wethBalance);
      _safeTransferETH(msg.sender, wethBalance);
    }
  }

  /**
   * @notice Modifier to handle sending earned rewards to user after operations
   * @param positionId The ID of the position
   */
  modifier sendReceivedRewardsToUser(uint256 positionId) {
    _;
    uint64 poolIdZero = LIQUIDITY_MANAGER
      .positions(positionId)
      .poolIds[0];

    uint256 strategyId;

    if (_poolIdToStrategyIdPlusOne[poolIdZero] != 0) {
      strategyId = _poolIdToStrategyIdPlusOne[poolIdZero] - 1;
    } else {
      strategyId = LIQUIDITY_MANAGER.poolInfo(poolIdZero).strategyId;
      _poolIdToStrategyIdPlusOne[poolIdZero] = strategyId + 1;
    }

    (address underlying, address wrapped) = STRATEGY_MANAGER.assets(
      strategyId
    );

    uint256 underlyingBalance = underlying == address(WETH)
      ? 0
      : IERC20(underlying).balanceOf(address(this));
    uint256 wrappedBalance = IERC20(wrapped).balanceOf(address(this));

    if (0 < underlyingBalance) {
      IERC20(underlying).safeTransfer(msg.sender, underlyingBalance);
    }
    if (0 < wrappedBalance) {
      IERC20(wrapped).safeTransfer(msg.sender, wrappedBalance);
    }
  }

  /// ======= INTERNAL ======= ///

  /**
   * @notice Helper function to transfer ETH to an address
   * @param to Address to transfer ETH to
   * @param value Amount of ETH to transfer
   */
  function _safeTransferETH(address to, uint256 value) internal {
    (bool success, ) = to.call{ value: value }("");
    if (!success) revert ETHTransferFailed();
  }

  /**
   * @dev Converts ETH to wstETH through stETH
   * @param amount Amount of ETH to convert
   * @return Amount of wstETH received
   */
  function _convertEthToWrappedLidoETH(
    uint256 amount
  ) internal returns (uint256) {
    bool isEth = 0 < msg.value;
    uint256 selectedAmount = isEth ? msg.value : amount;

    if (!isEth) {
      WETH.transferFrom(msg.sender, address(this), selectedAmount);
      WETH.withdraw(selectedAmount);
    }

    // Submit ETH to Lido and receive stETH
    uint256 stETHAmount = STETH.submit{ value: selectedAmount }(
      address(0)
    );
    // Wrap stETH to wstETH
    return WSTETH.wrap(stETHAmount);
  }

  /// ======= POSITIONS WSTETH ======= ///

  /**
   * @notice Opens a new position using ETH, converting to wstETH
   * @param amount The amount of WETH to add (ignored if sending ETH)
   * @param isWrapped Whether the position is using the wrapped asset
   * @param poolIds The IDs of the pools to provide liquidity to
   */
  function openPositionETHToWstETH(
    uint256 amount,
    bool isWrapped,
    uint64[] calldata poolIds
  )
    external
    payable
    nonReentrant
    borrowPositionFromUser(POSITION_TOKEN.nextPositionId(), true)
  {
    // Convert ETH to wstETH
    uint256 wstETHAmount = _convertEthToWrappedLidoETH(amount);
    // Open position with wstETH
    LIQUIDITY_MANAGER.openPosition(wstETHAmount, isWrapped, poolIds);
  }

  /**
   * @notice Adds liquidity to an existing position using ETH, converting to wstETH
   * @param positionId The ID of the position
   * @param amount The amount of WETH to add (ignored if sending ETH)
   * @param isWrapped Whether the position is using the wrapped asset
   */
  function addLiquidityETHToWstETH(
    uint256 positionId,
    uint256 amount,
    bool isWrapped
  )
    external
    payable
    nonReentrant
    borrowPositionFromUser(positionId, false)
    sendReceivedWethToUser
    sendReceivedRewardsToUser(positionId)
  {
    // Convert ETH to wstETH
    uint256 wstETHAmount = _convertEthToWrappedLidoETH(amount);
    // Add liquidity using wstETH
    LIQUIDITY_MANAGER.addLiquidity(
      positionId,
      wstETHAmount,
      isWrapped
    );
  }

  /// ======= POSITIONS ETH ======= ///

  /**
   * @notice Opens a new position using ETH
   * @param poolIds The IDs of the pools to provide liquidity to
   */
  function openPositionETH(
    uint64[] calldata poolIds
  )
    external
    payable
    nonReentrant
    borrowPositionFromUser(POSITION_TOKEN.nextPositionId(), true)
  {
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
  )
    external
    payable
    nonReentrant
    borrowPositionFromUser(positionId, false)
    sendReceivedWethToUser
    sendReceivedRewardsToUser(positionId)
  {
    // Convert ETH to WETH
    WETH.deposit{ value: msg.value }();

    // Add liquidity
    LIQUIDITY_MANAGER.addLiquidity(positionId, msg.value, false);
  }

  /**
   * @notice Takes interests from a position and converts them to ETH
   * @param positionId The ID of the position
   * @dev After taking interests, converts any WETH earned to ETH and sends to user
   */
  function takeInterestsETH(
    uint256 positionId
  )
    external
    nonReentrant
    borrowPositionFromUser(positionId, false)
    sendReceivedWethToUser
    sendReceivedRewardsToUser(positionId)
  {
    // Take interests using the LiquidityManager
    LIQUIDITY_MANAGER.takeInterests(positionId);
  }

  /**
   * @notice Commits to remove liquidity from a position (starts withdrawal delay)
   * @param positionId The ID of the position
   */
  function commitRemoveLiquidityETH(
    uint256 positionId
  )
    external
    nonReentrant
    borrowPositionFromUser(positionId, false)
    sendReceivedWethToUser
    sendReceivedRewardsToUser(positionId)
  {
    // Commit to remove liquidity using the LiquidityManager
    LIQUIDITY_MANAGER.commitRemoveLiquidity(positionId);
  }

  /**
   * @notice Cancels a pending liquidity removal commitment
   * @param positionId The ID of the position
   */
  function uncommitRemoveLiquidityETH(
    uint256 positionId
  )
    external
    nonReentrant
    borrowPositionFromUser(positionId, false)
    sendReceivedWethToUser
    sendReceivedRewardsToUser(positionId)
  {
    // Uncommit liquidity removal using the LiquidityManager
    LIQUIDITY_MANAGER.uncommitRemoveLiquidity(positionId);
  }

  /**
   * @notice Removes liquidity from a position and returns ETH
   * @param positionId The ID of the position
   * @param amount The amount of liquidity to remove
   */
  function removeLiquidityETH(
    uint256 positionId,
    uint256 amount
  )
    external
    nonReentrant
    borrowPositionFromUser(positionId, false)
    sendReceivedWethToUser
    sendReceivedRewardsToUser(positionId)
  {
    // Remove liquidity and get WETH
    LIQUIDITY_MANAGER.removeLiquidity(positionId, amount, false);
  }

  /// ======= COVERS ======= ///

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
  )
    external
    payable
    nonReentrant
    borrowCoverFromUser(COVER_TOKEN.nextCoverId(), true)
  {
    if (msg.value != premiums) revert WrongEthAmountSent();

    // Convert ETH to WETH
    WETH.deposit{ value: premiums }();

    // Buy cover with WETH
    LIQUIDITY_MANAGER.openCover(poolId, coverAmount, premiums);
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
  )
    external
    payable
    nonReentrant
    borrowCoverFromUser(coverId, false)
    sendReceivedWethToUser
  {
    if (msg.value != premiumsToAdd) revert WrongEthAmountSent();

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
  }

  /// ======= ADMIN ======= ///

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

  /**
   * @notice Updates the LiquidityManager contract address
   * @param newLiquidityManager Address of the new LiquidityManager contract
   */
  function updateLiquidityManager(
    address newLiquidityManager
  ) external onlyOwner {
    LIQUIDITY_MANAGER = ILiquidityManager(newLiquidityManager);
  }

  /**
   * @notice Updates the StrategyManager contract address
   * @param newStrategyManager Address of the new StrategyManager contract
   */
  function updateStrategyManager(
    address newStrategyManager
  ) external onlyOwner {
    STRATEGY_MANAGER = IStrategyManager(newStrategyManager);
  }
}
