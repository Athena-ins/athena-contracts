// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/ERC20withSnapshot.sol";

import "hardhat/console.sol";

/**
 * @notice Staking Pool Contract: Policy
 * @notice Stakeable is a contract who is ment to be inherited by other contract that wants Staking capabilities
 * @dev initially inspired from @percybolmer/DevToken
 */
contract FixedRateStakeablePolicy is ERC20WithSnapshot {
  using SafeERC20 for IERC20;

  // The amount of ATEN tokens still available for staking rewards
  uint256 public rewardsRemaining;

  address public immutable underlyingAssetAddress;
  address public immutable core;
  uint128 public rewardsAnnualRate = 10_000; // 10_000 = 100% APR

  struct StakingPosition {
    uint256 amount;
    uint128 timestamp;
    uint128 rate;
    bool withdrawn;
  }

  /**
   * @notice StakeAccount is a staker that has a stake
   */
  struct StakeAccount {
    address user;
    mapping(uint256 => StakingPosition) positions;
    uint256[] tokenIds;
  }

  /**
   * @notice
   * stakes is used to keep track of the INDEX for the stakers in the stakes array
   */
  mapping(address => StakeAccount) public stakes;

  /**
   * @notice Staked event is triggered whenever a user stakes tokens, address is indexed to make it filterable
   */
  event Staked(address indexed user, uint256 amount, uint128 timestamp);

  /**
   * @notice constructs Pool LP Tokens for staking, decimals defaults to 18
   * @param underlyingAsset_ is the address of the staked token
   * @param core_ is the address of the core contract
   */
  constructor(address underlyingAsset_, address core_)
    ERC20WithSnapshot("ATEN Policy Staking Token", "psATEN")
  {
    underlyingAssetAddress = underlyingAsset_;
    core = core_;
  }

  modifier onlyCore() {
    require(msg.sender == core, "Only Core");
    _;
  }

  /// ================================ ///
  /// ========== READ FUNCS ========== ///
  /// ================================ ///

  function accountStakingPositions(address account_)
    external
    view
    returns (StakingPosition[] memory _stakingPositions)
  {
    StakeAccount storage userStakingPositions = stakes[account_];

    for (uint256 i = 0; i < userStakingPositions.tokenIds.length; i++) {
      uint256 tokenId = userStakingPositions.tokenIds[i];
      _stakingPositions[i] = userStakingPositions.positions[tokenId];
    }
  }

  /**
   * @notice
   * calculateStakeReward is used to calculate how much a user should be rewarded for their stakes
   * and the duration the stake has been active
   * Currently the reward is 100% APR per year
   */
  function rewardsOf(address account_, uint256 tokenId_)
    public
    view
    returns (uint256)
  {
    StakingPosition storage pos = stakes[account_].positions[tokenId_];

    // If the staking position is empty return 0
    if (pos.amount == 0) return 0;

    require(
      pos.timestamp < block.timestamp,
      "FRSP: timestamp is in the future"
    );

    uint256 timeElapsed;
    unchecked {
      // Unckecked because we know that block.timestamp is always bigger than pos.timestamp
      timeElapsed = block.timestamp - pos.timestamp;
    }

    // Max reward is 365 days of rewards at specified APR
    uint256 maxReward = (pos.amount * pos.rate) / 10_000;

    if (365 days <= timeElapsed) {
      // Cap rewards at 365 days
      return maxReward;
    } else {
      // Else return proportional rewards
      uint256 yearPercentage = (timeElapsed * 10_000) / 365 days;
      return (yearPercentage * maxReward) / 10_000;
    }
  }

  /// ============================= ///
  /// ========== DEPOSIT ========== ///
  /// ============================= ///

  function stake(
    address account_,
    uint256 tokenId_,
    uint256 amount_
  ) external onlyCore {
    require(amount_ > 0, "FRSP: cannot stake 0 ATEN");

    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(address(0), account_, amount_);

    // Get tokens from user to staking pool
    IERC20(underlyingAssetAddress).safeTransferFrom(
      account_,
      address(this),
      amount_
    );

    // Calc the max rewards and check there is enough rewards left
    uint256 maxReward = (amount_ * rewardsAnnualRate) / 10_000;
    require(maxReward <= rewardsRemaining, "FRSP: not enough rewards left");
    unchecked {
      // unchecked because we know that rewardsRemaining is always bigger than maxReward
      rewardsRemaining -= maxReward;
  }

    StakeAccount storage stakingAccount = stakes[account_];

    // Save the user's staking position
    uint128 timestamp = uint128(block.timestamp);
    stakingAccount.positions[tokenId_] = StakingPosition(
      amount_,
      timestamp,
      rewardsAnnualRate,
      false
    );
    stakingAccount.tokenIds.push(tokenId_);

    // Mint tokens to user's wallet
    _mint(account_, amount_);

    emit Staked(account_, amount_, timestamp);
  }

  /// ============================== ///
  /// ========== WITHDRAW ========== ///
  /// ============================== ///

  function withdraw(
    address account_,
    uint256 tokenId_,
    uint256 amount_
  ) external onlyCore returns (uint256) {
    uint256 __rewards = _withdrawStake(account_, tokenId_, amount_);
    // we put from & to opposite so as token owner has a Snapshot balance when staking

    _beforeTokenTransfer(account_, address(0), __rewards);
    //@dev TODO do not modify staking date for user is not enough balance

    IERC20(underlyingAssetAddress).safeTransfer(account_, __rewards);
  }

  function _withdrawStake(
    address account_,
    uint256 tokenId_,
    uint256 amount_
  ) internal returns (uint256) {
    StakeAccount storage __userStake = stakes[account_];
    require(
      __userStake.positions[tokenId_].amount >= amount_,
      "Invalid amount"
    );
    require(
      block.timestamp - __userStake.positions[tokenId_].timestamp >= 365 days,
      "FRSP: ATEN still locked"
    );

    // Calculate available Reward first before we start modifying data
    uint256 reward = rewardsOf(account_, tokenId_);
    // Remove by subtracting the money unstaked
    __userStake.positions[tokenId_].amount -= amount_;

    // Reset timer of stake
    __userStake.positions[tokenId_].timestamp = uint128(block.timestamp);

    return reward;
  }

  /// =========================== ///
  /// ========== ADMIN ========== ///
  /// =========================== ///

  /**
   * @notice
   * Used to add more rewards to the staking pool.
   * @param amount_ amount of rewards to add
   */
  function addAvailableRewards(uint256 amount_) external onlyCore {
    rewardsRemaining += amount_;
  }

  /**
   * @notice
   * Sets the new staking rewards APR for newly created policies.
   * @param newRate_ the new reward rate (100% APR = 10_000)
   */
  function setRewardsPerYear(uint128 newRate_) external onlyCore {
    rewardsAnnualRate = newRate_;
  }
}
