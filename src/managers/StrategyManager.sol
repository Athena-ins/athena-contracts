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
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { ILendingPool } from "../interfaces/ILendingPool.sol";
// @bw seems underlying === wrapped as the aToken balance is increased as interests sum up

//======== ERRORS ========//

// Not a valid strategy
error NotAValidStrategy();
error NotLiquidityManager();

contract StrategyManager is IStrategyManager, Ownable {
  using SafeERC20 for IERC20;
  using RayMath for uint256;

  //======== STORAGE ========//
  ILiquidityManager public liquidityManager;

  ILendingPool public aaveLendingPool =
    ILendingPool(0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9); // AAVE lending pool v2
  address public usdt = 0xdAC17F958D2ee523a2206206994597C13D831ec7; // underlyingAsset (USDT)
  address public ausdt = 0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811; // wrappedAsset (aUSDT v2)

  //======== CONSTRCUTOR ========//

  constructor(
    ILiquidityManager liquidityManager_
  ) Ownable(msg.sender) {
    liquidityManager = liquidityManager_;
  }

  //======== MODIFIERS ========//

  modifier onlyLiquidityManager() {
    if (msg.sender != address(liquidityManager))
      revert NotLiquidityManager();
    _;
  }

  modifier checkId(uint256 strategyId_) {
    if (strategyId_ != 0) revert NotAValidStrategy();
    _;
  }

  //======== VIEWS ========//

  /**
   * @notice Returns the current index between aToken and underlying token
   * @return uint256 The current reward index in rays
   *
   * @dev A reward index of 1e27 means 1 aToken = 1 underlying token
   */
  function getRewardIndex(
    uint256 strategyId_
  ) public view checkId(strategyId_) returns (uint256) {
    return aaveLendingPool.getReserveNormalizedIncome(usdt);
  }

  function underlyingAsset(
    uint256 strategyId_
  ) external view checkId(strategyId_) returns (address) {
    return usdt;
  }

  function wrappedAsset(
    uint256 strategyId_
  ) external view checkId(strategyId_) returns (address) {
    return ausdt;
  }

  function assets(
    uint256 strategyId_
  )
    external
    view
    checkId(strategyId_)
    returns (address underlying, address wrapped)
  {
    underlying = usdt;
    wrapped = ausdt;
  }

  // To be called by liq manager to compute how many underlying the user has supplied
  function wrappedToUnderlying(
    uint256 strategyId_,
    uint256 amountWrapped_
  ) public pure checkId(strategyId_) returns (uint256) {
    // Underlying === wrapped as the aToken balance is increased as interests sum up
    return amountWrapped_;
  }

  function underlyingToWrapped(
    uint256 strategyId_,
    uint256 amountUnderlying_
  ) public pure checkId(strategyId_) returns (uint256) {
    // Underlying === wrapped as the aToken balance is increased as interests sum up
    return amountUnderlying_;
  }

  //======== UNDERLYING I/O ========//

  function depositToStrategy(
    uint256 strategyId_,
    uint256 amountUnderlying_
  ) external checkId(strategyId_) onlyLiquidityManager {
    // Deposit underlying into strategy
    IERC20(usdt).forceApprove(
      address(aaveLendingPool),
      amountUnderlying_
    );
    aaveLendingPool.deposit(
      usdt,
      amountUnderlying_,
      address(this),
      0
    );
  }

  function withdrawFromStrategy(
    uint256 strategyId_,
    uint256 amountUnderlying_,
    address account_,
    uint256 /*feeDiscount_*/
  ) external checkId(strategyId_) onlyLiquidityManager {
    uint256 bal = IERC20(ausdt).balanceOf(address(this));
    console.log("bal rew: ", bal);

    // @dev No need to approve aToken since they are burned in pool
    aaveLendingPool.withdraw(usdt, amountUnderlying_, account_);
  }

  //======== WRAPPED I/O ========//

  function depositWrappedToStrategy(
    uint256 strategyId_
  ) external checkId(strategyId_) onlyLiquidityManager {
    // No need to deposit wrapped asset into strategy
  }

  function withdrawWrappedFromStrategy(
    uint256 strategyId_,
    uint256 amountUnderlying_,
    address account_,
    uint256 /*feeDiscount_*/
  ) external checkId(strategyId_) onlyLiquidityManager {
    // Compute amount of wrapped to send to account
    uint256 amountWrapped = underlyingToWrapped(
      strategyId_,
      amountUnderlying_
    );
    IERC20(ausdt).safeTransfer(account_, amountWrapped);
  }

  //======== CLAIMS ========//

  function payoutFromStrategy(
    uint256 strategyId_,
    uint256 amountUnderlying_,
    address account_
  ) external checkId(strategyId_) onlyLiquidityManager {
    // @dev No need to approve aToken since they are burned in pool
    aaveLendingPool.withdraw(usdt, amountUnderlying_, account_);
  }

  //======== ADMIN ========//

  function updateLiquidityManager(
    ILiquidityManager liquidityManager_
  ) external onlyOwner {
    liquidityManager = liquidityManager_;
  }
}
