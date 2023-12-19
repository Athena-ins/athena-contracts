// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

// contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// libraries
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { RayMath } from "../libs/RayMath.sol";

// interfaces
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";

//======== ERRORS ========//

// Not a valid strategy
error NotAValidStrategy();
error NotLiquidityManager();

contract StrategyManagerV0 is Ownable {
  using SafeERC20 for IERC20;

  //======== STORAGE ========//
  address public liquidityManager;

  address public depositContract =
    0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9; // AAVE lending pool v2
  address public underlyingAsset =
    0xdAC17F958D2ee523a2206206994597C13D831ec7; // USDT
  address public liquidityAsset =
    0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811; // aUSDT v2

  struct PositionData {
    uint256 amountUnderlying;
  }

  mapping(uint256 _tokenId => PositionData _data) public positionData;

  //======== CONSTRCUTOR ========//

  constructor(address liquidityManager_) Ownable(msg.sender) {
    liquidityManager = liquidityManager_;
  }

  //======== MODIFIERS ========//

  modifier onlyLiquidityManager() {
    if (msg.sender != liquidityManager) revert NotLiquidityManager();
    _;
  }

  //======== FUNCTIONS ========//

  function depositToStrategy(
    uint256 strategyId_,
    uint256 tokenId_,
    uint256 amountUnderlying_
  ) external onlyLiquidityManager {
    if (strategyId_ != 0) revert NotAValidStrategy();
  }

  function withdrawFromStrategy(
    uint256 strategyId_,
    uint256 tokenId_,
    uint256 amountUnderlying_,
    address account_,
    uint256 feeDiscount_
  ) external onlyLiquidityManager {
    if (strategyId_ != 0) revert NotAValidStrategy();
  }

  function payoutFromStrategy(
    uint256 strategyId_,
    uint256 amountUnderlying_,
    address account_
  ) external onlyLiquidityManager {
    if (strategyId_ != 0) revert NotAValidStrategy();
  }

  //======== ADMIN ========//

  function updateLiquidityManager(
    address liquidityManager_
  ) external onlyOwner {
    liquidityManager = liquidityManager_;
  }
}
