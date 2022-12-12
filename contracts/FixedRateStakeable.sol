// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

/**
 * @notice Staking Pool Parent: General Pool (GP)
 * @notice Stakeable is a contract who is ment to be inherited by other contract that wants Staking capabilities
 * @dev initially inspired from @percybolmer/DevToken
 */
contract FixedRateStakeable {
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
  RewardRate[] internal rewardRates;

  struct RewardRate {
    uint256 amount;
    uint128 rate;
  }

  /**
   * @notice
   * _Stake is used to make a stake for an sender. It will remove the amount staked from the stakers account and place those tokens inside a stake container
   * StakeID
   */
  function _stake(
    address _account,
    uint256 _amount,
    uint256 _usdDeposit
  ) internal {
    require(_amount > 0, "Cannot stake nothing");
    uint256 timestamp = block.timestamp;
    Stakeholder storage _userStake = stakes[_account];
    _userStake.amount += _amount;
    _userStake.since = timestamp;
    _userStake.rate = getRate(_usdDeposit);

    emit Staked(_account, _amount, timestamp);
  }

  function _setStakeRewards(RewardRate[] calldata _rewardToSet) internal {
    for (uint256 index = 0; index < _rewardToSet.length - 1; index++) {
      require(
        _rewardToSet[index].amount < _rewardToSet[index + 1].amount,
        "Rate must be in ascending order"
      );

      rewardRates.push(_rewardToSet[index]);
    }

    rewardRates.push(_rewardToSet[_rewardToSet.length - 1]);
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
    uint256 divRewardPerSecond = ((365 days) * 100 * 100) / _userStake.rate;
    return
      ((block.timestamp - _userStake.since) * _userStake.amount) /
      divRewardPerSecond;
  }

  function getRate(uint256 _amount) public view returns (uint128) {
    for (uint256 index = 0; index < rewardRates.length; index++) {
      if (_amount < rewardRates[index].amount)
        return index == 0 ? 0 : rewardRates[index - 1].rate;
    }
    // Else we are above max, so give it last rate
    return rewardRates[rewardRates.length - 1].rate;
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
}
