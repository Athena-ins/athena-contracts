// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/ERC20withSnapshot.sol";

/// @notice Staking Pool Contract: Policy
contract StakingPolicy is ERC20WithSnapshot {
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
  // @bw this could all be optimized by abstracting away the user address out of this staking pool
  // we just need staking pos by policy id and a getter for all policy ids of a user (with policyTokenIds)
  struct StakeAccount {
    uint256[] policyTokenIds;
    // Maps a policy token ID to a staking position
    mapping(uint256 => StakingPosition) positions;
  }

  // Mapping of stakers addresses to their staking accounts
  mapping(address => StakeAccount) private _stakes;

  /**
   * @notice constructs Pool LP Tokens for staking, decimals defaults to 18
   * @param underlyingAsset_ is the address of ATEN token
   * @param core_ is the address of the core contract
   */
  constructor(address underlyingAsset_, address core_)
    ERC20WithSnapshot("ATEN Policy Staking", "ATENps")
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
  event Stake(
    address indexed user,
    uint256 indexed tokenId,
    uint256 amountStaked
  );

  /**
   * @notice
   * Triggered whenever a user unstakes tokens
   * @dev isEarlyUnstake is true if the user unstakes before the policy is expired
   */
  event Unstake(
    address indexed user,
    uint256 indexed tokenId,
    uint256 amountUnstaked,
    uint256 amountRewards,
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
    require(msg.sender == coreAddress, "SP: Only Core");
    _;
  }

  /// =========================== ///
  /// ========== VIEWS ========== ///
  /// =========================== ///

  /**
   * @notice
   * Returns a user's staking position for a specific policy.
   * @param account_ is the address of the user
   * @param policyId_ is the id of the policy
   * @return _ the corresponding staking position if it exists
   */
  function accountStakingPositions(address account_, uint256 policyId_)
    external
    view
    returns (StakingPosition memory)
  {
    return _stakes[account_].positions[policyId_];
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
    StakeAccount storage userStakingPositions = _stakes[account_];

    for (uint256 i = 0; i < userStakingPositions.policyTokenIds.length; i++) {
      uint256 tokenId = userStakingPositions.policyTokenIds[i];

      _stakingPositions[i] = userStakingPositions.positions[tokenId];
    }
  }

  /**
   * @notice
   * Returns the amount of rewards a user has earned for a specific staking position.
   * @dev The rewards are capped at 365 days of staking at the specified APR.
   * @param account_ is the address of the user
   * @param policyId_ is the id of the policy
   * @ @return _ the amount of rewards earned
   */
  function rewardsOf(address account_, uint256 policyId_)
    external
    view
    returns (uint256)
  {
    StakingPosition storage pos = _stakes[account_].positions[policyId_];

    // If the staking position is empty return 0
    if (pos.amount == 0) return 0;

    uint256 timeElapsed;
    require(pos.timestamp < block.timestamp, "SP: timestamp is in the future");
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
   * @param policyId_ is the id of the policy
   * @param amount_ is the amount of tokens to stake
   */
  function stake(
    address account_,
    uint256 policyId_,
    uint256 amount_
  ) external onlyCore {
    require(amount_ > 0, "SP: cannot stake 0 ATEN");

    // Make a snapshot of the user's balance
    // @bw is this really useful ?
    _beforeTokenTransfer(address(0), account_, amount_);

    // Get tokens from user to staking pool
    IERC20(underlyingAssetAddress).safeTransferFrom(
      account_,
      address(this),
      amount_
    );

    // Calc the max rewards and check there is enough rewards left
    uint256 maxReward = (amount_ * rewardsAnnualRate) / 10_000;
    require(maxReward <= rewardsRemaining, "SP: not enough rewards left");
    unchecked {
      // unchecked because we know that rewardsRemaining is always bigger than maxReward
      rewardsRemaining -= maxReward;
    }

    StakeAccount storage stakingAccount = _stakes[account_];

    // Save the user's staking position
    uint128 timestamp = uint128(block.timestamp);
    stakingAccount.positions[policyId_] = StakingPosition(
      amount_,
      timestamp,
      rewardsAnnualRate,
      false
    );
    stakingAccount.policyTokenIds.push(policyId_);

    emit Stake(account_, policyId_, amount_);
  }

  /// ============================== ///
  /// ========== WITHDRAW ========== ///
  /// ============================== ///

  /**
   * @notice
   * Used when a user closes his policy before a year has elapsed.
   * @param account_ address of the user
   * @param policyId_ id of the policy
   */
  function earlyWithdraw(address account_, uint256 policyId_)
    external
    onlyCore
  {
    StakingPosition storage pos = _stakes[account_].positions[policyId_];

    require(!pos.withdrawn, "SP: already withdrawn");
    // Close staking position by setting withdrawn to true
    pos.withdrawn = true;

    // Get the amount of ATEN initially deposited for staking
    uint256 initialAmount = pos.amount;

    // Calc the amount of rewards the position had reserved
    uint256 maxReward = (pos.amount * pos.rate) / 10_000;
    // Add back the allocated rewards to the rewards pool
    rewardsRemaining += maxReward;

    // Make a snapshot of the user's balance
    // @bw is this really useful ?
    _beforeTokenTransfer(account_, address(0), initialAmount);

    // Send initial staked tokens to user
    IERC20(underlyingAssetAddress).safeTransfer(account_, initialAmount);

    emit Unstake(account_, policyId_, initialAmount, 0, true);
  }

  /**
   * @notice
   * Used when a user claims his staking rewards after a year has elapsed.
   * @param account_ address of the user
   * @param policyId_ id of the policy
   * @return _ the amount of rewards to send to user
   */
  function withdraw(address account_, uint256 policyId_)
    external
    onlyCore
    returns (uint256)
  {
    StakingPosition storage pos = _stakes[account_].positions[policyId_];

    require(!pos.withdrawn, "SP: already withdrawn");
    // Close staking position by setting withdrawn to true
    pos.withdrawn = true;

    // Check that a year has elapsed since staking position creation
    require(
      365 days <= block.timestamp - pos.timestamp,
      "SP: year has not elapsed"
    );

    // Get the amount of ATEN initially deposited for staking
    uint256 initialAmount = pos.amount;

    // Make a snapshot of the user's balance
    _beforeTokenTransfer(account_, address(0), initialAmount);

    // Send initial staked tokens to user
    IERC20(underlyingAssetAddress).safeTransfer(account_, pos.amount);

    // Max reward is 365 days of rewards at specified APR
    uint256 maxReward = (pos.amount * pos.rate) / 10_000;

    emit Unstake(account_, policyId_, initialAmount, maxReward, false);

    // Return 365 days of rewards at specified APR
    return maxReward;
  }

  /// =========================== ///
  /// ========== ADMIN ========== ///
  /// =========================== ///

  /**
   * @notice
   * Used to add more rewards to the staking pool.
   * @param amount_ amount of rewards to add
   */
  // @bw need to call method when adding to vault
  function addAvailableRewards(uint256 amount_) external onlyCore {
    // Add rewards to existing rewards balance
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
