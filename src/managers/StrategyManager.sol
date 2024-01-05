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
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { ILendingPool } from "../interfaces/ILendingPool.sol";

//======== ERRORS ========//

// Not a valid strategy
error NotAValidStrategy();
error NotLiquidityManager();

contract StrategyManager is Ownable {
  using SafeERC20 for IERC20;
  using RayMath for uint256;

  //======== STORAGE ========//
  ILiquidityManager public liquidityManager;

  ILendingPool public aaveLendingPool =
    ILendingPool(0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9); // AAVE lending pool v2
  address public usdt = 0xdAC17F958D2ee523a2206206994597C13D831ec7; // underlyingAsset (USDT)
  address public ausdt = 0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811; // wrappedAsset (aUSDT v2)

  struct PositionData {
    // uint256 strategyId; // Unused in StrategyManager v0
    uint256 startRewardIndex;
    uint256 accumulatedRewards;
  }

  mapping(uint256 _tokenId => PositionData _data) public positionData;

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

  function rewardsOf(
    uint256 strategyId_,
    uint256 tokenId_
  ) public view checkId(strategyId_) returns (uint256) {
    PositionData storage data = positionData[tokenId_];

    uint256 startIndex = data.startRewardIndex;
    uint256 currentIndex = getRewardIndex(strategyId_);

    if (startIndex < currentIndex) {
      uint256 supplied = liquidityManager.positionSize(tokenId_);

      uint256 indexDelta = currentIndex - startIndex;
      uint256 newRewards = (supplied * indexDelta) / RayMath.RAY;

      return newRewards + data.accumulatedRewards;
    } else {
      return data.accumulatedRewards;
    }
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
  ) external view checkId(strategyId_) returns (address, address) {
    return (usdt, ausdt);
  }

  // To be called by liq manager to compute how many underlying the user has supplied
  function wrappedToUnderlying(
    uint256 strategyId_,
    uint256 amountWrapped_
  ) public view checkId(strategyId_) returns (uint256) {
    uint256 index = getRewardIndex(strategyId_);
    // @bw to be checked
    return (amountWrapped_ * index) / RayMath.RAY;
  }

  function underlyingToWrapped(
    uint256 strategyId_,
    uint256 amountUnderlying_
  ) public view checkId(strategyId_) returns (uint256) {
    uint256 index = getRewardIndex(strategyId_);
    // @bw to be checked
    return (amountUnderlying_ * RayMath.RAY) / index;
  }

  //======== UNDERLYING I/O ========//

  function depositToStrategy(
    uint256 strategyId_,
    uint256 tokenId_,
    uint256 amountUnderlying_
  ) external checkId(strategyId_) onlyLiquidityManager {
    PositionData storage data = positionData[tokenId_];

    // If there is already a position then save current rewards
    if (data.startRewardIndex != 0) {
      data.accumulatedRewards = rewardsOf(strategyId_, tokenId_);
    }

    // Set the reward index to track future rewards
    data.startRewardIndex = getRewardIndex(strategyId_);

    // Deposit underlying into strategy
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
    uint256 /*feeDiscount_*/
  ) external checkId(strategyId_) onlyLiquidityManager {
    PositionData storage data = positionData[tokenId_];

    // Compute latest rewards
    uint256 rewards = rewardsOf(strategyId_, tokenId_);
    uint256 total = amountUnderlying_ + rewards;
    // @dev No need to approve aToken since they are burned in pool
    aaveLendingPool.withdraw(usdt, total, account_);

    // Reset accumulated rewards
    data.startRewardIndex = getRewardIndex(strategyId_);
    data.accumulatedRewards = 0;
  }

  //======== WRAPPED I/O ========//

  function depositWrappedToStrategy(
    uint256 strategyId_,
    uint256 tokenId_
  ) external checkId(strategyId_) onlyLiquidityManager {
    PositionData storage data = positionData[tokenId_];

    // If there is already a position then save current rewards
    if (data.startRewardIndex != 0) {
      data.accumulatedRewards = rewardsOf(strategyId_, tokenId_);
    }

    // Set the reward index to track future rewards
    data.startRewardIndex = getRewardIndex(strategyId_);

    // No need to deposit wrapped asset into strategy
  }

  function withdrawWrappedFromStrategy(
    uint256 strategyId_,
    uint256 tokenId_,
    uint256 amountUnderlying_,
    address account_,
    uint256 /*feeDiscount_*/
  ) external checkId(strategyId_) onlyLiquidityManager {
    PositionData storage data = positionData[tokenId_];

    // Compute latest rewards
    uint256 rewards = rewardsOf(strategyId_, tokenId_);
    uint256 total = amountUnderlying_ + rewards;

    // Compute amount of wrapped to send to account
    uint256 amountWrapped = underlyingToWrapped(strategyId_, total);
    IERC20(ausdt).safeTransfer(account_, amountWrapped);

    // Reset accumulated rewards
    data.startRewardIndex = getRewardIndex(strategyId_);
    data.accumulatedRewards = 0;
  }

  //======== TAKE INTERESTS ========//

  function lockRewardsPostWithdrawalCommit(
    uint256 strategyId_,
    uint256 tokenId_
  ) external checkId(strategyId_) onlyLiquidityManager {
    // @bw should lock rewards in strategy to avoid commiting upon deposit
  }

  function withdrawRewards(
    uint256 strategyId_,
    uint256 tokenId_,
    address account_,
    uint256 /*feeDiscount_*/
  ) external checkId(strategyId_) onlyLiquidityManager {
    PositionData storage data = positionData[tokenId_];

    // Compute latest rewards
    uint256 rewards = rewardsOf(strategyId_, tokenId_);
    // Transfer rewards to account
    // @dev No need to approve aToken since they are burned in pool
    aaveLendingPool.withdraw(usdt, rewards, account_);

    // Reset accumulated rewards
    data.startRewardIndex = getRewardIndex(strategyId_);
    data.accumulatedRewards = 0;
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
