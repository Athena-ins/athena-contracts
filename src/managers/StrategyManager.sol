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
import { ILendingPool } from "../interfaces/ILendingPool.sol";

//======== ERRORS ========//

// Not a valid strategy
error NotAValidStrategy();
error NotLiquidityManager();

contract StrategyManagerV0 is Ownable {
  using SafeERC20 for IERC20;

  //======== STORAGE ========//
  address public liquidityManager;

  ILendingPool public aaveLendingPool =
    ILendingPool(0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9); // AAVE lending pool v2
  address public usdt = 0xdAC17F958D2ee523a2206206994597C13D831ec7; // USDT
  address public ausdt = 0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811; // aUSDT v2

  struct PositionData {
    uint256 amountUnderlying;
    uint256 startRewardRate;
    uint256 accumulatedRewards;
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

  /**
   * @notice Returns the current rate between aToken and underlying token
   * @return uint256 The current reward index in rays
   *
   * @dev A reward rate of 1e27 means 1 aToken = 1 underlying token
   */
  function getRewardRate() public view returns (uint256) {
    return aaveLendingPool.getReserveNormalizedIncome(usdt);
  }

  function depositToStrategy(
    uint256 strategyId_,
    uint256 tokenId_,
    uint256 amountUnderlying_
  ) external onlyLiquidityManager {
    if (strategyId_ != 0) revert NotAValidStrategy();

    IERC20(usdt).forceApprove(address(this), amountUnderlying_);

    aaveLendingPool.deposit(
      usdt,
      amountUnderlying_,
      address(this),
      0
    );
  }

  function withdrawFromStrategy(
    uint256 strategyId_,
    uint256 tokenId_,
    uint256 amountUnderlying_,
    address account_,
    uint256 feeDiscount_
  ) external onlyLiquidityManager {
    if (strategyId_ != 0) revert NotAValidStrategy();

    // No need to approve aToken since they are burned in pool
    aaveLendingPool.withdraw(usdt, amountUnderlying_, account_);
  }

  function payoutFromStrategy(
    uint256 strategyId_,
    uint256 amountUnderlying_,
    address account_
  ) external onlyLiquidityManager {
    if (strategyId_ != 0) revert NotAValidStrategy();

    // No need to approve aToken since they are burned in pool
    aaveLendingPool.withdraw(usdt, amountUnderlying_, account_);
  }

  //======== ADMIN ========//

  function updateLiquidityManager(
    address liquidityManager_
  ) external onlyOwner {
    liquidityManager = liquidityManager_;
  }
}
