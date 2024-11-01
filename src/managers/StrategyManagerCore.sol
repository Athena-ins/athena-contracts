// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// libraries
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { RayMath } from "../libs/RayMath.sol";
import { IsContract } from "../libs/IsContract.sol";

// interfaces
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IAaveLendingPoolV3 } from "../interfaces/IAaveLendingPoolV3.sol";
import { IAaveRewardsController } from "../interfaces/IAaveRewardsController.sol";

//======== ERRORS ========//

error NotAValidStrategy();
error NotLiquidityManager();
error UseOfUnderlyingAssetNotSupported();
error RateAboveMax();
error ArgumentLengthMismatch();
error TransferCallFailed();

/**
 * @title Athena Strategy Manager
 * @author vblackwhale
 *
 * This contract manages the assets deposited in Athena pools as liquidity.
 * It is responsible for depositing and withdrawing assets from various DeFi protocols.
 * It also computes the rewards and performance fees for the DAO.
 *
 * @dev This version is an upgraded version of the v0 allowing for Core Staking strategies
 * on top of the Colend v3 USDC strategy.
 *
 */
contract StrategyManagerCore is IStrategyManager, Ownable {
  using SafeERC20 for IERC20;
  using RayMath for uint256;

  uint256 constant PERCENTAGE_BASE = 100;
  uint256 constant HUNDRED_PERCENT = PERCENTAGE_BASE * RayMath.RAY;

  //======== STORAGE ========//
  ILiquidityManager public liquidityManager;
  IEcclesiaDao public ecclesiaDao;
  // Address of the buyback & burn wallet
  address public buybackWallet;

  // Amount of underlying to be deducted from payout in RAY
  uint256 public payoutDeductibleRate;
  // Amount of performance fee to be paid to ecclesiaDao in RAY
  uint256 public strategyFeeRate;

  // (((Strategy 0))) - Colend v3 USDC
  IAaveLendingPoolV3 public colendLendingPool;
  address public USDC = 0xa4151B2B3e269645181dCcF2D426cE75fcbDeca9; // underlyingAsset
  address public sUSDC = 0x8f9d6649C4ac1d894BB8A26c3eed8f1C9C5f82Dd; // wrappedAsset

  // Wrapped Core
  address public wCORE = 0x40375C92d9FAf44d2f9db9Bd9ba41a3317a2404f;
  // (((Strategy 1))) - Core Liquid Staking
  address public stCORE = 0xb3A8F0f0da9ffC65318aA39E55079796093029AD;

  //======== CONSTRCUTOR ========//

  constructor(
    ILiquidityManager liquidityManager_,
    IEcclesiaDao ecclesiaDao_,
    IAaveLendingPoolV3 colendLendingPool_,
    address reserveAsset_, // USDC for Strategy Manager v0
    address buybackWallet_,
    uint256 payoutDeductibleRate_, // in rays
    uint256 performanceFee_ // in rays
  ) Ownable(msg.sender) {
    liquidityManager = liquidityManager_;
    ecclesiaDao = ecclesiaDao_;

    buybackWallet = buybackWallet_;

    if (
      HUNDRED_PERCENT < payoutDeductibleRate_ ||
      HUNDRED_PERCENT < performanceFee_
    ) revert RateAboveMax();

    payoutDeductibleRate = payoutDeductibleRate_;
    strategyFeeRate = performanceFee_;
  }

  //======== MODIFIERS ========//

  modifier onlyLiquidityManager() {
    if (msg.sender != address(liquidityManager))
      revert NotLiquidityManager();
    _;
  }

  modifier checkId(uint256 strategyId_) {
    if (1 < strategyId_) revert NotAValidStrategy();
    _;
  }

  //======== VIEWS ========//

  /**
   * @notice Returns true if a strategy compounds yield through the balance
   * @param strategyId_ The ID of the strategy
   * @return True if the strategy compounds
   */
  function itCompounds(
    uint256 strategyId_
  ) external pure checkId(strategyId_) returns (bool) {
    if (strategyId_ == 0) {
      // Colend v3 USDC
      return true;
    } else {
      // Core Staking
      return false;
    }
  }

  /**
   * @notice Returns the current index between wrapped and underlying token
   * @return uint256 The current reward index in rays
   *
   * @dev A reward index of 1e27 means 1 wrapped = 1 underlying token
   */
  function getRewardIndex(
    uint256 strategyId_
  ) public view checkId(strategyId_) returns (uint256) {
    if (strategyId_ == 0) {
      // Colend v3 USDC
      return colendLendingPool.getReserveNormalizedIncome(USDC);
    } else {
      // Core Staking
      /// @dev The token compounds in value so amount is constant
      return RayMath.RAY;
    }
  }

  /**
   * @notice Returns the current reward rate for the strategy
   * @param strategyId_ The ID of the strategy
   * @return uint256 The reward rate in RAY
   *
   * @dev A reward rate of 1e28 means 100% APR
   * @dev This is used for UI display purposes only
   */
  function getRewardRate(
    uint256 strategyId_
  ) public view checkId(strategyId_) returns (uint256) {
    if (strategyId_ == 0) {
      // Colend v3 USDC
      return
        colendLendingPool.getReserveData(USDC).currentLiquidityRate;
    } else {
      // Core Staking
      /// @dev Retrieving the reward rate is not supported for Core Staking strategies
      return 0;
    }
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
    if (strategyId_ == 0) {
      // Colend v3 USDC
      return
        amount_.rayMul(endRewardIndex_).rayDiv(startRewardIndex_) -
        amount_;
    } else {
      // Core Staking
      /// @dev For value compounding strategies rewards are not computed
      return 0;
    }
  }

  /**
   * @notice Returns the underlying asset token address for a strategy
   * @param strategyId_ The ID of the strategy
   * @return The address of the underlying asset
   */
  function underlyingAsset(
    uint256 strategyId_
  ) public view checkId(strategyId_) returns (address) {
    if (strategyId_ == 0) {
      // Colend v3 USDC
      return USDC;
    } else {
      // Core Staking
      /// @dev deposits/withdrawals in underlying are not supported for Core Staking strategies
      return wCORE;
    }
  }

  /**
   * @notice Returns the wrapped asset token address for a strategy
   * @param strategyId_ The ID of the strategy
   * @return The address of the wrapped asset
   */
  function wrappedAsset(
    uint256 strategyId_
  ) public view checkId(strategyId_) returns (address) {
    if (strategyId_ == 0) {
      // Colend v3 USDC
      return sUSDC;
    } else if (strategyId_ == 1) {
      // Core Staking Restaked ETH
      return stCORE;
    }
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
    public
    view
    checkId(strategyId_)
    returns (address underlying, address wrapped)
  {
    underlying = underlyingAsset(strategyId_);
    wrapped = wrappedAsset(strategyId_);
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
    // For Colend underlying === wrapped since aToken amounts autocompound
    // For Core Staking underlying === wrapped since underlying is not supported
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
    // For Colend underlying === wrapped since aToken amounts autocompound
    // For Core Staking underlying === wrapped since underlying is not supported
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
    if (amount_ < 1) return;

    if (token_ == USDC) {
      // Colend v3 USDC
      // Withdraw the revenue from the strategy to the DAO contract
      colendLendingPool.withdraw(
        token_,
        amount_ - 1,
        address(ecclesiaDao)
      );
    } else {
      // Core Staking
      IERC20(token_).safeTransfer(address(ecclesiaDao), amount_ - 1);
    }

    // This will register the revenue in the DAO for distribution
    if (IsContract._isContract(address(ecclesiaDao))) {
      ecclesiaDao.accrueRevenue(token_, amount_, 0);
    }
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
    if (strategyId_ == 0) {
      // Colend v3 USDC
      IERC20(USDC).forceApprove(
        address(colendLendingPool),
        amountUnderlying_
      );

      colendLendingPool.deposit(
        USDC,
        amountUnderlying_,
        address(this),
        0
      );
    } else {
      // Core Staking
      revert UseOfUnderlyingAssetNotSupported();
    }
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
    if (strategyId_ == 0) {
      // Colend v3 USDC
      uint256 amountToWithdraw = amountCapitalUnderlying_ +
        amountRewardsUnderlying_;

      // If the strategy has performance fees then compute the DAO share
      // @dev the bonus is subtracted from the performance fee
      if (
        strategyFeeRate != 0 &&
        amountRewardsUnderlying_ != 0 &&
        yieldBonus_ < strategyFeeRate
      ) {
        // @bw simplify by deduction bonus from fee rate ?
        uint256 daoShare = ((amountRewardsUnderlying_ *
          strategyFeeRate) -
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
      colendLendingPool.withdraw(
        USDC,
        amountToWithdraw - 1,
        account_
      );
    } else {
      // Core Staking
      // @dev deposits/withdrawals in underlying are not supported for Core Staking strategies
      return
        withdrawWrappedFromStrategy(
          strategyId_,
          underlyingToWrapped(strategyId_, amountCapitalUnderlying_),
          underlyingToWrapped(strategyId_, amountRewardsUnderlying_),
          account_,
          yieldBonus_
        );
    }
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
  ) public checkId(strategyId_) onlyLiquidityManager {
    /// @dev override underlying for Core Staking strategies since it is not supported
    (address underlying, address wrapped) = strategyId_ == 0
      ? assets(strategyId_) // Colend v3 USDC
      : (wrappedAsset(strategyId_), wrappedAsset(strategyId_)); // Core Staking

    // Compute amount of wrapped to send to account
    uint256 amountToWithdraw = underlyingToWrapped(
      strategyId_,
      amountCapitalUnderlying_
    ) + underlyingToWrapped(strategyId_, amountRewardsUnderlying_);

    // If the strategy has performance fees then compute the DAO share
    if (strategyFeeRate != 0 && amountRewardsUnderlying_ != 0) {
      uint256 daoShare = (amountRewardsUnderlying_ *
        (strategyFeeRate - yieldBonus_)) / RayMath.RAY;

      if (daoShare != 0) {
        // Deduct the daoShare from the amount to withdraw
        amountToWithdraw -= daoShare;
        _accrueToDao(underlying, daoShare);
      }
    }

    // Since we remove 1 for rounding errors
    if (amountToWithdraw <= 1) return;

    // @dev Remove 1 for rounding errors
    IERC20(wrapped).safeTransfer(account_, amountToWithdraw - 1);
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

    // @dev No need to approve aToken since they are burned in pool
    // @dev Remove 1 for rounding errors
    uint256 amountToPayout = (amountUnderlying_ - deductible);

    if (strategyId_ == 0) {
      // Colend v3 USDC

      // If there is a deductible, withdraw it from the pool to buy back & burn wallet
      if (0 < deductible)
        colendLendingPool.withdraw(USDC, deductible, buybackWallet);

      // Since we remove 1 for rounding errors
      if (amountToPayout <= 1) return;

      colendLendingPool.withdraw(USDC, amountToPayout - 1, account_);
    } else {
      // Core Staking
      address asset = wrappedAsset(strategyId_);

      // If there is a deductible, withdraw it from the pool to buy back & burn wallet
      if (0 < deductible)
        IERC20(asset).safeTransfer(buybackWallet, deductible);

      // Since we remove 1 for rounding errors
      if (amountToPayout <= 1) return;

      IERC20(asset).safeTransfer(account_, amountToPayout - 1);
    }
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
  function updateStrategyFeeRate(
    uint256 rate_ // in rays
  ) external onlyOwner {
    if (HUNDRED_PERCENT < rate_) revert RateAboveMax();
    strategyFeeRate = rate_;
  }

  /**
   * @notice Updates the deductible rate for compensations
   * @param rate_ The new deductible rate in RAY
   */
  function updatePayoutDeductibleRate(
    uint256 rate_ // in rays
  ) external onlyOwner {
    if (HUNDRED_PERCENT < rate_) revert RateAboveMax();
    payoutDeductibleRate = rate_;
  }

  /**
   * @notice Claims extra Colend rewards
   * @param rewardsController The address of the rewards controller
   * @param rewardableAssets The list of assets to check eligible distributions
   * @param amount The amount of rewards to claim
   * @param reward The address of the reward token
   */
  function claimColendRewards(
    address rewardsController,
    address[] calldata rewardableAssets,
    uint256 amount,
    address reward
  ) external onlyOwner {
    IAaveRewardsController(rewardsController).claimRewards(
      rewardableAssets,
      amount,
      msg.sender,
      reward
    );
  }

  /**
   * @notice Claims all extra Colend rewards
   * @param rewardsController The address of the rewards controller
   * @param rewardableAssets The list of assets to check eligible distributions
   */
  function claimAllColendRewards(
    address rewardsController,
    address[] calldata rewardableAssets
  ) external onlyOwner {
    IAaveRewardsController(rewardsController).claimAllRewards(
      rewardableAssets,
      msg.sender
    );
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
      (bool success, ) = payable(to).call{ value: amount }("");
      if (!success) revert TransferCallFailed();
    } else {
      IERC20(token).safeTransfer(to, amount);
    }
  }
}
