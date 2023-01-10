// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IFixedRateStakeable.sol";

/**
 * @notice Staking Pool Parent: General Pool (GP)
 * @notice Stakeable is a contract who is ment to be inherited by other contract that wants Staking capabilities
 * @dev initially inspired from @percybolmer/DevToken
 */
contract FixedRateStakeable is IFixedRateStakeable {
  /**
   * @notice Stakeholder is a staker that has a stake
   */
  struct Stakeholder {
    address user;
    uint256 amount;
    uint256 since;
    uint256 claimable;
    uint128 rate;
  }
  /**
   * @notice
   * stakes is used to keep track of the INDEX for the stakers in the stakes array
   */
  mapping(address => Stakeholder) internal stakes;
  /**
   * @notice Staked event is triggered whenever a user stakes tokens, address is indexed to make it filterable
   */
  event Staked(address indexed user, uint256 amount, uint256 timestamp);

  /**
     * @notice
      Structure for getting fixed rewards depending on amount staked
      Need to be set before use !
     */
  /// Available staking reward levels (10_000 = 100% APR)
  RewardRateLevel[] internal stakingRewardRates;

  /// =========================== ///
  /// ========== VIEWS ========== ///
  /// =========================== ///

  /** @notice
   * Retrieves the fee rate according to amount of staked ATEN.
   * @dev Returns displays warning but levels require an amountSupplied of 0
   * @param suppliedCapital_ USD amount of the user's cover positions
   * @return uint128 staking APR of user in GP
   **/
  function getStakingRewardRate(uint256 suppliedCapital_)
    public
    view
    returns (uint128)
  {
    // Lazy check to avoid loop if user doesn't supply
    if (suppliedCapital_ == 0) return stakingRewardRates[0].aprStaking;

    // Inversed loop starts with the end to find adequate level
    for (uint256 index = stakingRewardRates.length - 1; index >= 0; index--) {
      // Rate level with amountSupplied of 0 will always be true
      if (stakingRewardRates[index].amountSupplied <= suppliedCapital_)
        return stakingRewardRates[index].aprStaking;
    }
  }

  /**
   * @notice
   * calculateStakeReward is used to calculate how much a user should be rewarded for their stakes
   * and the duration the stake has been active
   */
  function calculateStakeReward(Stakeholder memory _userStake)
    internal
    view
    returns (uint256)
  {
    if (_userStake.amount == 0 || _userStake.rate == 0) return 0;
    uint256 divRewardPerSecond = ((365 days) * 10_000) / _userStake.rate;
    return
      ((block.timestamp - _userStake.since) * _userStake.amount) /
      divRewardPerSecond;
  }

  /**
   * @notice
   * public function to view rewards available for a stake
   */
  function rewardsOf(address _staker)
    public
    view
    returns (uint256 rewards, uint128 rate)
  {
    Stakeholder memory _userStake = stakes[_staker];
    rewards = calculateStakeReward(_userStake);
    return (rewards, _userStake.rate);
  }

  /// =============================== ///
  /// ======= STAKE / UNSTAKE ======= ///
  /// =============================== ///

  /**
   * @notice
   * _Stake is used to make a stake for an sender. It will remove the amount staked from the stakers account and place those tokens inside a stake container
   * StakeID
   */
  function _stake(
    address _account,
    uint256 _amount,
    uint256 _usdCapitalSupplied // in USD
  ) internal {
    require(_amount > 0, "SGP: cannot stake 0");
    uint256 timestamp = block.timestamp;
    Stakeholder storage _userStake = stakes[_account];
    _userStake.amount += _amount;
    _userStake.since = timestamp;
    _userStake.rate = getStakingRewardRate(_usdCapitalSupplied);

    emit Staked(_account, _amount, timestamp);
  }

  /**
   * @notice
   * withdrawStake takes in an amount and a index of the stake and will remove tokens from that stake
   * Notice index of the stake is the users stake counter, starting at 0 for the first stake
   * Will return the amount to MINT onto the acount
   * Will also calculateStakeReward and reset timer
   */
  function _withdrawStake(address _account, uint256 amount)
    internal
    returns (uint256)
  {
    Stakeholder storage userStake = stakes[_account];
    require(userStake.amount >= amount, "Invalid amount");

    // Calculate available Reward first before we start modifying data
    uint256 reward = calculateStakeReward(userStake);
    // Remove by subtracting the money unstaked
    userStake.amount = userStake.amount - amount;

    // Reset timer of stake
    userStake.since = block.timestamp;
    // stakeholders[userIndex].addressStakes[index].since = block.timestamp;

    return amount + reward;
  }

  /// ========================= ///
  /// ========= ADMIN ========= ///
  /// ========================= ///

  /** @notice
   * Setter for staking rewards according to supplied cover capital.
   * @dev Levels must be in ascending order of amountSupplied
   * @dev The amountSupplied indicates the upper limit for the level
   * @param levels_ array of staking reward levels structs
   **/
  function _setStakingRewards(RewardRateLevel[] calldata levels_) internal {
    // First clean the storage
    delete stakingRewardRates;

    // Set all cover supply fee levels
    for (uint256 index = 0; index < levels_.length; index++) {
      RewardRateLevel calldata level = levels_[index];

      if (index == 0) {
        // Require that the first level indicates fees for atenAmount 0
        require(level.amountSupplied == 0, "SA: Must specify base rate");
      } else {
        // If it isn't the first item check that items are ascending
        require(
          levels_[index - 1].amountSupplied < level.amountSupplied,
          "SA: Sort in ascending order"
        );
      }

      // Check that APR is not higher than 100%
      require(level.aprStaking <= 10_000, "SA: APR > 100%");

      // save to storage
      stakingRewardRates.push(level);
    }
  }
}
