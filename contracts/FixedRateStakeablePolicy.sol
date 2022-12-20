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
  // Address of ATEN token
  address public immutable underlyingAssetAddress;
  // Address of the core Athena contract
  address public immutable coreAddress;
  // The current APR of the staking pool
  // @dev 10_000 = 100% APR
  uint128 public rewardsAnnualRate = 10_000;

  // A staking position of a user
  struct StakingPosition {
    uint256 amount;
    uint128 timestamp;
    uint128 rate;
    bool withdrawn;
  }

  // Staking account data of user
  struct StakeAccount {
    address user;
    mapping(uint256 => StakingPosition) positions;
    uint256[] tokenIds;
  }

  // Mapping of stakers addresses to their staking accounts
  mapping(address => StakeAccount) public stakes;

  /**
   * @notice constructs Pool LP Tokens for staking, decimals defaults to 18
   * @param underlyingAsset_ is the address of the staked token
   * @param core_ is the address of the core contract
   */
  constructor(address underlyingAsset_, address core_)
    ERC20WithSnapshot("ATEN Policy Staking Token", "psATEN")
  {
    underlyingAssetAddress = underlyingAsset_;
    coreAddress = core_;
  }

  /// ============================ ///
  /// ========== EVENTS ========== ///
  /// ============================ ///

  /**
   * @notice
   * Triggered whenever a user stakes tokens
   */
  event Stake(address indexed user, uint256 indexed tokenId, uint256 amount);

  /**
   * @notice
   * Triggered whenever a user unstakes tokens
   * @dev isEarlyUnstake is true if the user unstakes before the policy is expired
   */
  event Unstake(
    address indexed user,
    uint256 indexed tokenId,
    uint256 amount,
    bool indexed isEarlyUnstake
  );

  /**
   * @notice
   * Triggered whenever the rewards rate is updated
   */
  event RewardsRateUpdated(uint256 newRewardsAnnualRate);

  /**
   * @notice
   * Triggered whenever rewards are added to the staking pool
   */
  event RewardsAdded(uint256 newTotalRewards);

  /// =============================== ///
  /// ========== MODIFIERS ========== ///
  /// =============================== ///

  modifier onlyCore() {
    require(msg.sender == coreAddress, "Only Core");
    _;
  }

  /// ================================ ///
  /// ========== READ FUNCS ========== ///
  /// ================================ ///

  /**
   * @notice
   * Returns a user's staking position for a specific policy.
   * @param account_ is the address of the user
   * @param tokenId_ is the id of the policy
   * @return StakingPosition the corresponding staking position if it exists
   */
  function accountStakingPositions(address account_, uint256 tokenId_)
    external
    view
    returns (StakingPosition memory)
  {
    return stakes[account_].positions[tokenId_];
  }

  /**
   * @notice
   * Returns all staking position of a user.
   * @param account_ is the address of the user
   * @return _stakingPositions all staking positions if there are any
   */
  function allAccountStakingPositions(address account_)
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
   * Returns the amount of rewards a user has earned for a specific staking position.
   * @dev The rewards are capped at 365 days of staking at the specified APR.
   * @param account_ is the address of the user
   * @param tokenId_ is the id of the policy
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

  /**
   * @notice
   * Deposit a policy holder's ATEN so they can earn staking rewards.
   * @param account_ is the address of the user
   * @param tokenId_ is the id of the policy
   * @param amount_ is the amount of tokens to stake
   */
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

    emit Stake(account_, tokenId_, amount_);
  }

  /// ============================== ///
  /// ========== WITHDRAW ========== ///
  /// ============================== ///

  /**
   * @notice
   * Used when a user closes his policy before a year has elapsed.
   * @param account_ address of the user
   * @param tokenId_ id of the policy
   */
  function earlyWithdraw(address account_, uint256 tokenId_) external onlyCore {
    StakingPosition storage pos = stakes[account_].positions[tokenId_];

    // Get the amount of ATEN initially deposited for staking
    uint256 amountWithdrawal = pos.amount;

    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(account_, address(0), amountWithdrawal);

    // Send tokens to user
    IERC20(underlyingAssetAddress).safeTransfer(account_, amountWithdrawal);

    emit Unstake(account_, tokenId_, amountWithdrawal, true);
  }

  /**
   * @notice
   * Used when a user claims his staking rewards after a year has elapsed.
   * @param account_ address of the user
   * @param tokenId_ id of the policy
   */
  function withdraw(address account_, uint256 tokenId_) external onlyCore {
    StakingPosition storage pos = stakes[account_].positions[tokenId_];

    require(!pos.withdrawn, "FRSP: already withdrawn");

    // Check that a year has elapsed since staking position creation
    require(
      365 days <= block.timestamp - pos.timestamp,
      "FRSP: year has not elapsed"
    );

    // Max reward is 365 days of rewards at specified APR
    uint256 maxReward = (pos.amount * pos.rate) / 10_000;
    // Total reward is the amount initially deposited + the max reward
    uint256 amountWithdrawal = pos.amount + maxReward;

    // Close staking position by setting withdrawn to true
    pos.withdrawn = true;

    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(account_, address(0), amountWithdrawal);

    // Send tokens to user
    IERC20(underlyingAssetAddress).safeTransfer(account_, amountWithdrawal);

    emit Unstake(account_, tokenId_, amountWithdrawal, false);
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

    emit RewardsAdded(rewardsRemaining);
  }

  /**
   * @notice
   * Sets the new staking rewards APR for newly created policies.
   * @param newRate_ the new reward rate (100% APR = 10_000)
   */
  function setRewardsPerYear(uint128 newRate_) external onlyCore {
    rewardsAnnualRate = newRate_;

    emit RewardsRateUpdated(newRate_);
  }
}
