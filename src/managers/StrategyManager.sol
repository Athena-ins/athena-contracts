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
import { IAaveLendingPoolV3 } from "../interfaces/IAaveLendingPoolV3.sol";

//======== ERRORS ========//

error NotAValidStrategy();
error NotLiquidityManager();
error OnlyWhitelistCanDepositLiquidity();
error RateAboveMax();
error ArgumentLengthMismatch();

/**
 * @title Athena Strategy Manager
 * @author vblackwhale
 *
 * This contract manages the assets deposited in Athena pools as liquidity.
 * It is responsible for depositing and withdrawing assets from various DeFi protocols.
 * It also computes the rewards and performance fees for the DAO.
 *
 * @dev For the v0 of the strategy manager, the only supported protocol is Aave v3 USDC.
 *
 */
contract StrategyManager is IStrategyManager, Ownable {
  using SafeERC20 for IERC20;
  using RayMath for uint256;

  uint256 constant PERCENTAGE_BASE = 100;
  uint256 constant HUNDRED_PERCENT = PERCENTAGE_BASE * RayMath.RAY;
  uint256 constant FIFTHY_PERCENT = HUNDRED_PERCENT / 2;

  //======== STORAGE ========//
  ILiquidityManager public liquidityManager;
  IEcclesiaDao public ecclesiaDao;
  // Address of the buyback & burn wallet
  address public buybackWallet;

  // Amount of underlying to be deducted from payout in RAY
  uint256 public payoutDeductibleRate;
  // Amount of performance fee to be paid to ecclesiaDao in RAY
  uint256 public performanceFeeRate;

  IAaveLendingPoolV3 public aaveLendingPool;
  address public USDC; // underlyingAsset
  address public aUSDC; // wrappedAsset

  bool public isWhitelistEnabled;
  mapping(address account_ => bool isWhiteListed_)
    public whiteListedLiquidityProviders;

  //======== CONSTRCUTOR ========//

  constructor(
    ILiquidityManager liquidityManager_,
    IEcclesiaDao ecclesiaDao_,
    IAaveLendingPoolV3 aaveLendingPool_,
    address reserveAsset_, // USDC for Strategy Manager v0
    address buybackWallet_,
    uint256 payoutDeductibleRate_, // in rays
    uint256 performanceFee_ // in rays
  ) Ownable(msg.sender) {
    liquidityManager = liquidityManager_;
    ecclesiaDao = ecclesiaDao_;
    aaveLendingPool = aaveLendingPool_;

    USDC = reserveAsset_;
    buybackWallet = buybackWallet_;

    if (
      FIFTHY_PERCENT < payoutDeductibleRate_ ||
      FIFTHY_PERCENT < performanceFee_
    ) revert RateAboveMax();

    payoutDeductibleRate = payoutDeductibleRate_;
    performanceFeeRate = performanceFee_;

    aUSDC = aaveLendingPool.getReserveData(USDC).aTokenAddress;
  }

  //======== MODIFIERS ========//

  modifier onlyLiquidityManager() {
    if (msg.sender != address(liquidityManager))
      revert NotLiquidityManager();
    _;
  }

  modifier onlyWhiteListedLiquidityProviders() {
    if (
      // @dev using tx origin since the contract is called by the liquidity manager
      isWhitelistEnabled && !whiteListedLiquidityProviders[tx.origin]
    ) revert OnlyWhitelistCanDepositLiquidity();
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
    return aaveLendingPool.getReserveNormalizedIncome(USDC);
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
    return aaveLendingPool.getReserveData(USDC).currentLiquidityRate;
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
    return USDC;
  }

  /**
   * @notice Returns the wrapped asset token address for a strategy
   * @param strategyId_ The ID of the strategy
   * @return The address of the wrapped asset
   */
  function wrappedAsset(
    uint256 strategyId_
  ) external view checkId(strategyId_) returns (address) {
    return aUSDC;
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
    underlying = USDC;
    wrapped = aUSDC;
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
  )
    external
    checkId(strategyId_)
    onlyLiquidityManager
    onlyWhiteListedLiquidityProviders
  {
    IERC20(USDC).forceApprove(
      address(aaveLendingPool),
      amountUnderlying_
    );

    aaveLendingPool.deposit(
      USDC,
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
  )
    external
    checkId(strategyId_)
    onlyLiquidityManager
    onlyWhiteListedLiquidityProviders
  {
    uint256 amountToWithdraw = amountCapitalUnderlying_ +
      amountRewardsUnderlying_;

    // If the strategy has performance fees then compute the DAO share
    // @dev the bonus is subtracted from the performance fee
    if (
      performanceFeeRate != 0 &&
      amountRewardsUnderlying_ != 0 &&
      yieldBonus_ < performanceFeeRate
    ) {
      uint256 daoShare = ((amountRewardsUnderlying_ *
        performanceFeeRate) -
        (amountRewardsUnderlying_ * yieldBonus_)) / HUNDRED_PERCENT;

      if (daoShare != 0) {
        // Deduct the daoShare from the amount to withdraw
        amountToWithdraw -= daoShare;
        _accrueToDao(USDC, daoShare);
      }
    }

    // Since we remove 1 for rounding errors
    if (amountToWithdraw <= 1) return;

    // @dev No need to approve aToken since they are burned in pool
    // @dev Remove 1 for rounding errors
    aaveLendingPool.withdraw(USDC, amountToWithdraw - 1, account_);
  }

  //======== WRAPPED I/O ========//

  /**
   * @notice Deposits wrapped tokens into the strategy
   * @param strategyId_ The ID of the strategy
   */
  function depositWrappedToStrategy(
    uint256 strategyId_
  )
    external
    checkId(strategyId_)
    onlyLiquidityManager
    onlyWhiteListedLiquidityProviders
  {
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
  )
    external
    checkId(strategyId_)
    onlyLiquidityManager
    onlyWhiteListedLiquidityProviders
  {
    // Compute amount of wrapped to send to account
    uint256 amountToWithdraw = underlyingToWrapped(
      strategyId_,
      amountCapitalUnderlying_
    ) + underlyingToWrapped(strategyId_, amountRewardsUnderlying_);

    // If the strategy has performance fees then compute the DAO share
    if (performanceFeeRate != 0 && amountRewardsUnderlying_ != 0) {
      uint256 daoShare = (amountRewardsUnderlying_ *
        (performanceFeeRate - yieldBonus_)) / RayMath.RAY;

      if (daoShare != 0) {
        // Deduct the daoShare from the amount to withdraw
        amountToWithdraw -= daoShare;
        _accrueToDao(USDC, daoShare);
      }
    }

    // Since we remove 1 for rounding errors
    if (amountToWithdraw <= 1) return;

    // @dev Remove 1 for rounding errors
    IERC20(aUSDC).safeTransfer(account_, amountToWithdraw - 1);
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
      HUNDRED_PERCENT;

    // If there is a deductible, withdraw it from the pool to buy back & burn wallet
    if (0 < deductible)
      aaveLendingPool.withdraw(USDC, deductible, buybackWallet);

    // @dev No need to approve aToken since they are burned in pool
    // @dev Remove 1 for rounding errors
    uint256 amountToPayout = (amountUnderlying_ - deductible);

    // Since we remove 1 for rounding errors
    if (amountToPayout <= 1) return;

    aaveLendingPool.withdraw(USDC, amountToPayout - 1, account_);
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
   * @param rate_ The new performance fee rate in RAY
   */
  function updatePerformanceFeeRate(
    uint256 rate_ // in rays
  ) external onlyOwner {
    if (FIFTHY_PERCENT < rate_) revert RateAboveMax();
    performanceFeeRate = rate_;
  }

  /**
   * @notice Updates the deductible rate for compensations
   * @param rate_ The new deductible rate in RAY
   */
  function updatePayoutDeductibleRate(
    uint256 rate_ // in rays
  ) external onlyOwner {
    if (FIFTHY_PERCENT < rate_) revert RateAboveMax();
    payoutDeductibleRate = rate_;
  }

  /**
   * @notice Turns the whitelist on or off
   * @param isEnabled_ The new whitelist status
   */
  function setWhitelistStatus(bool isEnabled_) external onlyOwner {
    isWhitelistEnabled = isEnabled_;
  }

  /**
   * @notice Adds or removes addresses from the whitelist
   * @param address_ The addresses to add or remove
   * @param status_ The status of the addresses
   */
  function editWhitelistAddresses(
    address[] calldata address_,
    bool[] calldata status_
  ) external onlyOwner {
    uint256 length = address_.length;

    if (length != status_.length) revert ArgumentLengthMismatch();

    for (uint256 i; i < length; i++) {
      whiteListedLiquidityProviders[address_[i]] = status_[i];
    }
  }

  /**
   * @notice Rescue and transfer tokens locked in this contract
   * @param token The address of the token
   * @param to The address of the recipient
   * @param amount The amount of token to transfer
   *
   * @dev This function is for emergency use only in case of a critical bug in
   * the v0 strategy manager
   */
  function rescueTokens(
    address token,
    address to,
    uint256 amount
  ) external onlyOwner {
    if (token == address(0)) {
      payable(to).transfer(amount);
    } else {
      IERC20(token).safeTransfer(to, amount);
    }
  }
}
