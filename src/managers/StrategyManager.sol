// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

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
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { ILendingPool } from "../interfaces/ILendingPool.sol";

import { console } from "hardhat/console.sol";

// @bw implement LP whitelist for v0

//======== ERRORS ========//

// Not a valid strategy
error NotAValidStrategy();
error NotLiquidityManager();
error RateAboveMax();

contract StrategyManager is IStrategyManager, Ownable {
  using SafeERC20 for IERC20;
  using RayMath for uint256;

  //======== STORAGE ========//
  ILiquidityManager public liquidityManager;
  IEcclesiaDao public ecclesiaDao;
  // Address of the buyback & burn wallet
  address public buybackWallet;

  // Amount of underlying to be deducted from payout in RAY
  uint256 public payoutDeductibleRate;
  // Amount of performance fee to be paid to ecclesiaDao in RAY
  uint256 public performanceFee;

  ILendingPool public aaveLendingPool =
    ILendingPool(0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9); // AAVE lending pool v2
  address public usdt = 0xdAC17F958D2ee523a2206206994597C13D831ec7; // underlyingAsset (USDT)
  address public ausdt = 0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811; // wrappedAsset (aUSDT v2)

  //======== CONSTRCUTOR ========//

  constructor(
    ILiquidityManager liquidityManager_,
    IEcclesiaDao ecclesiaDao_,
    address buybackWallet_,
    uint256 payoutDeductibleRate_,
    uint256 performanceFee_
  ) Ownable(msg.sender) {
    liquidityManager = liquidityManager_;
    ecclesiaDao = ecclesiaDao_;
    buybackWallet = buybackWallet_;

    if (
      RayMath.halfRAY < payoutDeductibleRate_ ||
      RayMath.halfRAY < performanceFee_
    ) revert RateAboveMax();

    payoutDeductibleRate = payoutDeductibleRate_;
    performanceFee = performanceFee_;
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
   * @notice Returns true if a strategy compounds yield
   * @param strategyId_ The ID of the strategy
   * @return True if the strategy compounds
   */
  function itCompounds(
    uint256 strategyId_
  ) external pure checkId(strategyId_) returns (bool) {
    return true;
  }

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

  /**
   * @notice Returns the current reward rate for the strategy
   * @param strategyId_ The ID of the strategy
   * @return uint256 The reward rate in RAY
   *
   * @dev A reward rate of 1e28 means 100% APR
   */
  function getRewardRate(
    uint256 strategyId_
  ) public view checkId(strategyId_) returns (uint256) {
    return aaveLendingPool.getReserveData(usdt).currentLiquidityRate;
  }

  /**
   * @notice Computes rewards given their amount of underlying & start and end reward indexes
   * @param strategyId_ The ID of the strategy
   * @param amount_ The amount of underlying tokens
   * @param startRewardIndex_ The reward index at the time of deposit
   * @param endRewardIndex_ The reward index at the time of withdrawal
   * @return uint256 The amount of rewards in underlying tokens
   */
  function computeReward(
    uint256 strategyId_,
    uint256 amount_,
    uint256 startRewardIndex_,
    uint256 endRewardIndex_
  ) external pure checkId(strategyId_) returns (uint256) {
    return
      amount_.rayMul(endRewardIndex_).rayDiv(startRewardIndex_) -
      amount_;
  }

  /**
   * @notice Returns the underlying asset token address for a strategy
   * @param strategyId_ The ID of the strategy
   * @return The address of the underlying asset
   */
  function underlyingAsset(
    uint256 strategyId_
  ) external view checkId(strategyId_) returns (address) {
    return usdt;
  }

  /**
   * @notice Returns the wrapped asset token address for a strategy
   * @param strategyId_ The ID of the strategy
   * @return The address of the wrapped asset
   */
  function wrappedAsset(
    uint256 strategyId_
  ) external view checkId(strategyId_) returns (address) {
    return ausdt;
  }

  /**
   * @notice Returns the underlying and wrapped asset token addresses for a strategy
   * @param strategyId_ The ID of the strategy
   * @return underlying The address of the underlying asset
   * @return wrapped The address of the wrapped asset
   */
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

  /**
   * @notice Returns the amount of underlying tokens for a given amount of wrapped tokens
   * @param strategyId_ The ID of the strategy
   * @param amountWrapped_ The amount of wrapped tokens
   * @return The amount of underlying tokens
   */
  function wrappedToUnderlying(
    uint256 strategyId_,
    uint256 amountWrapped_
  ) public pure checkId(strategyId_) returns (uint256) {
    // Underlying === wrapped for aave as the aToken balance is increased as interests sum up
    return amountWrapped_;
  }

  /**
   * @notice Returns the amount of wrapped tokens for a given amount of underlying tokens
   * @param strategyId_ The ID of the strategy
   * @param amountUnderlying_ The amount of underlying tokens
   * @return The amount of wrapped tokens
   */
  function underlyingToWrapped(
    uint256 strategyId_,
    uint256 amountUnderlying_
  ) public pure checkId(strategyId_) returns (uint256) {
    // Underlying === wrapped for aave as the aToken balance is increased as interests sum up
    return amountUnderlying_;
  }

  //======== HELPERS ========//

  /**
   * @notice Withdraws DAO revenue from the strategy and accrues it in the DAO
   * @param token_ The address of the token
   * @param amount_ The amount of tokens to accrue
   */
  function _accrueToDao(address token_, uint256 amount_) private {
    // Since we remove 1 for rounding errors
    if (amount_ <= 1) return;

    // Withdraw the revenue from the strategy to the DAO contract
    aaveLendingPool.withdraw(
      token_,
      amount_ - 1,
      address(ecclesiaDao)
    );

    // This will register the revenue in the DAO for distribution
    ecclesiaDao.accrueRevenue(token_, amount_, 0);
  }

  //======== UNDERLYING I/O ========//

  /**
   * @notice Deposits underlying tokens into the strategy
   * @param strategyId_ The ID of the strategy
   * @param amountUnderlying_ The amount of underlying tokens to deposit
   */
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

  /**
   * @notice Withdraws underlying tokens from the strategy
   * @param strategyId_ The ID of the strategy
   * @param amountCapitalUnderlying_ The amount of capital underlying tokens to withdraw
   * @param amountRewardsUnderlying_ The amount of rewards underlying tokens to withdraw
   * @param account_ The address to send the underlying tokens to
   * @param yieldBonus_ The yield bonus in RAY
   */
  function withdrawFromStrategy(
    uint256 strategyId_,
    uint256 amountCapitalUnderlying_,
    uint256 amountRewardsUnderlying_,
    address account_,
    uint256 yieldBonus_
  ) external checkId(strategyId_) onlyLiquidityManager {
    uint256 amountToWithdraw = amountCapitalUnderlying_ +
      amountRewardsUnderlying_;

    // If the strategy has performance fees then compute the DAO share
    if (
      performanceFee != 0 &&
      amountRewardsUnderlying_ != 0 &&
      yieldBonus_ < performanceFee
    ) {
      uint256 daoShare = ((amountRewardsUnderlying_ *
        performanceFee) - (amountRewardsUnderlying_ * yieldBonus_)) /
        RayMath.RAY;

      if (daoShare != 0) {
        // Deduct the daoShare from the amount to withdraw
        amountToWithdraw -= daoShare;
        _accrueToDao(usdt, daoShare);
      }
    }

    // Since we remove 1 for rounding errors
    if (amountToWithdraw <= 1) return;

    // @dev No need to approve aToken since they are burned in pool
    // @dev Remove 1 for rounding errors
    aaveLendingPool.withdraw(usdt, amountToWithdraw - 1, account_);
  }

  //======== WRAPPED I/O ========//

  /**
   * @notice Deposits wrapped tokens into the strategy
   * @param strategyId_ The ID of the strategy
   */
  function depositWrappedToStrategy(
    uint256 strategyId_
  ) external checkId(strategyId_) onlyLiquidityManager {
    // No need to deposit wrapped asset into strategy as they already compound by holding
  }

  /**
   * @notice Withdraws wrapped tokens from the strategy
   * @param strategyId_ The ID of the strategy
   * @param amountCapitalUnderlying_ The amount of capital underlying tokens to withdraw
   * @param amountRewardsUnderlying_ The amount of rewards underlying tokens to withdraw
   * @param account_ The address to send the underlying tokens to
   * @param yieldBonus_ The yield bonus in RAY
   */
  function withdrawWrappedFromStrategy(
    uint256 strategyId_,
    uint256 amountCapitalUnderlying_,
    uint256 amountRewardsUnderlying_,
    address account_,
    uint256 yieldBonus_
  ) external checkId(strategyId_) onlyLiquidityManager {
    // Compute amount of wrapped to send to account
    uint256 amountToWithdraw = underlyingToWrapped(
      strategyId_,
      amountCapitalUnderlying_
    ) + underlyingToWrapped(strategyId_, amountRewardsUnderlying_);

    // If the strategy has performance fees then compute the DAO share
    if (performanceFee != 0 && amountRewardsUnderlying_ != 0) {
      uint256 daoShare = (amountRewardsUnderlying_ *
        (performanceFee - yieldBonus_)) / RayMath.RAY;

      if (daoShare != 0) {
        // Deduct the daoShare from the amount to withdraw
        amountToWithdraw -= daoShare;
        _accrueToDao(usdt, daoShare);
      }
    }

    // Since we remove 1 for rounding errors
    if (amountToWithdraw <= 1) return;

    // @dev Remove 1 for rounding errors
    IERC20(ausdt).safeTransfer(account_, amountToWithdraw - 1);
  }

  //======== CLAIMS ========//

  /**
   * @notice Pay a valid claim compensation from the strategy
   * @param strategyId_ The ID of the strategy
   * @param amountUnderlying_ The amount of underlying tokens to payout
   * @param account_ The address to send the underlying tokens to
   */
  function payoutFromStrategy(
    uint256 strategyId_,
    uint256 amountUnderlying_,
    address account_
  ) external checkId(strategyId_) onlyLiquidityManager {
    uint256 deductible = (amountUnderlying_ * payoutDeductibleRate) /
      RayMath.RAY;

    // If there is a deductible, withdraw it from the pool to buy back & burn wallet
    if (0 < deductible)
      aaveLendingPool.withdraw(usdt, deductible, buybackWallet);

    // @dev No need to approve aToken since they are burned in pool
    // @dev Remove 1 for rounding errors
    uint256 amountToPayout = (amountUnderlying_ - deductible);

    // Since we remove 1 for rounding errors
    if (amountToPayout <= 1) return;

    aaveLendingPool.withdraw(usdt, amountToPayout - 1, account_);
  }

  //======== ADMIN ========//

  /**
   * @notice Updates the addresses of the liquidity manager, ecclesiaDao, and buyback wallet
   * @param liquidityManager_ The address of the liquidity manager
   * @param ecclesiaDao_ The address of the ecclesiaDao
   * @param buybackWallet_ The address of the buyback & burn wallet
   */
  function updateAddressList(
    ILiquidityManager liquidityManager_,
    IEcclesiaDao ecclesiaDao_,
    address buybackWallet_
  ) external onlyOwner {
    if (address(liquidityManager_) != address(0))
      liquidityManager = liquidityManager_;
    if (address(ecclesiaDao_) != address(0))
      ecclesiaDao = ecclesiaDao_;
    if (address(buybackWallet_) != address(0))
      buybackWallet = buybackWallet_;
  }

  /**
   * @notice Updates the performance fee for the strategy
   * @param fee_ The new performance fee in RAY
   */
  function updatePerformanceFee(uint256 fee_) external onlyOwner {
    if (RayMath.halfRAY < fee_) revert RateAboveMax();
    performanceFee = fee_;
  }

  /**
   * @notice Updates the deductible rate for compensations
   * @param rate_ The new deductible rate in RAY
   */
  function updatePayoutDeductibleRate(
    uint256 rate_
  ) external onlyOwner {
    if (RayMath.halfRAY < rate_) revert RateAboveMax();
    payoutDeductibleRate = rate_;
  }
}
