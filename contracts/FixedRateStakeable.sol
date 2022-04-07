// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

/**
 * @notice Stakeable is a contract who is ment to be inherited by other contract that wants Staking capabilities
 * @dev initially inspired from @percybolmer/DevToken
 */
contract FixedRateStakeable {
    /**
     * @notice
     * A stake struct is used to represent the way we store stakes,
     * A Stake will contain the users address, the amount staked and a timestamp,
     * Since which is when the stake was made
     */
    struct Stake {
        address user;
        uint256 amount;
        uint256 since;
        uint256 claimable;
    }
    /**
     * @notice Stakeholder is a staker that has active stakes
     */
    struct Stakeholder {
        address user;
        Stake[] addressStakes;
    }
    /**
     * @notice
     * StakingSummary is a struct that is used to contain all stakes performed by a certain account
     */
    struct StakingSummary {
        uint256 total_amount;
        Stake[] stakes;
    }

    /**
     * @notice
     *   This is a array where we store all Stakes that are performed on the Contract
     *   The stakes for each address are stored at a certain index, the index can be found using the stakes mapping
     */
    Stakeholder[] internal stakeholders;
    /**
     * @notice
     * stakes is used to keep track of the INDEX for the stakers in the stakes array
     */
    mapping(address => uint256) internal stakes;
    /**
     * @notice Staked event is triggered whenever a user stakes tokens, address is indexed to make it filterable
     */
    event Staked(
        address indexed user,
        uint256 amount,
        uint256 index,
        uint256 timestamp
    );

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
     * @notice Constructor since this contract is not ment to be used without inheritance
     * push once to stakeholders for it to work proplerly
     */
    constructor() {
        // This push is needed so we avoid index 0 causing bug of index-1
        stakeholders.push();
    }

    /**
     * @notice _addStakeholder takes care of adding a stakeholder to the stakeholders array
     */
    function _addStakeholder(address staker) internal returns (uint256) {
        // Push a empty item to the Array to make space for our new stakeholder
        stakeholders.push();
        // Calculate the index of the last item in the array by Len-1
        uint256 userIndex = stakeholders.length - 1;
        // Assign the address to the new index
        stakeholders[userIndex].user = staker;
        // Add index to the stakeHolders
        stakes[staker] = userIndex;
        return userIndex;
    }

    /**
     * @notice
     * _Stake is used to make a stake for an sender. It will remove the amount staked from the stakers account and place those tokens inside a stake container
     * StakeID
     */
    function _stake(uint256 _amount) internal {
        // Simple check so that user does not stake 0
        require(_amount > 0, "Cannot stake nothing");

        // Mappings in solidity creates all values, but empty, so we can just check the address
        uint256 index = stakes[msg.sender];
        // block.timestamp = timestamp of the current block in seconds since the epoch
        uint256 timestamp = block.timestamp;
        // See if the staker already has a staked index or if its the first time
        if (index == 0) {
            // This stakeholder stakes for the first time
            // We need to add him to the stakeHolders and also map it into the Index of the stakes
            // The index returned will be the index of the stakeholder in the stakeholders array
            index = _addStakeholder(msg.sender);
        }

        // Use the index to push a new Stake
        // push a newly created Stake with the current block timestamp.
        stakeholders[index].addressStakes.push(
            Stake(msg.sender, _amount, timestamp, 0)
        );
        // Emit an event that the stake has occured
        emit Staked(msg.sender, _amount, index, timestamp);
    }

    function _setStakeRewards(RewardRate[] calldata _rewardToSet)
        internal
    {
         for (uint256 index = 0; index < _rewardToSet.length; index++) {
            rewardRates.push(_rewardToSet[index]);
        }
    }

    /**
     * @notice
     * calculateStakeReward is used to calculate how much a user should be rewarded for their stakes
     * and the duration the stake has been active
     */
    function calculateStakeReward(Stake memory _currentStake)
        internal
        view
        returns (uint256)
    {
        if (_currentStake.amount == 0) return 0;
        return ((
            ((block.timestamp - _currentStake.since) * _currentStake.amount)
        ) / getRate(_currentStake.amount));
    }

    function getRate(uint256 _amount) public view returns (uint128) {
        for (uint256 index = 0; index < rewardRates.length; index++) {
            if (_amount < rewardRates[index].amount)
                return index == 0 ? 0 : rewardRates[index - 1].rate;
        }
        // Else we are above max discount, so give it max discount
        return rewardRates[rewardRates.length - 1].rate;
    }

    /**
     * @notice
     * withdrawStake takes in an amount and a index of the stake and will remove tokens from that stake
     * Notice index of the stake is the users stake counter, starting at 0 for the first stake
     * Will return the amount to MINT onto the acount
     * Will also calculateStakeReward and reset timer
     */
    function _withdrawStake(uint256 amount, uint256 index)
        internal
        returns (uint256)
    {
        // Grab userIndex which is the index to use to grab the Stake[]
        uint256 userIndex = stakes[msg.sender];
        Stake memory currentStake = stakeholders[userIndex].addressStakes[
            index
        ];
        require(
            currentStake.amount >= amount,
            "Staking: Cannot withdraw more than you have staked"
        );

        // Calculate available Reward first before we start modifying data
        uint256 reward = calculateStakeReward(currentStake);
        // Remove by subtracting the money unstaked
        currentStake.amount = currentStake.amount - amount;
        // If stake is empty, 0, then remove it from the array of stakes
        if (currentStake.amount == 0) {
            delete stakeholders[userIndex].addressStakes[index];
        } else {
            // If not empty then replace the value of it
            stakeholders[userIndex].addressStakes[index].amount = currentStake
                .amount;
            // Reset timer of stake
            stakeholders[userIndex].addressStakes[index].since = block
                .timestamp;
        }

        return amount + reward;
    }

    /**
     * @notice
     * hasStake is used to check if an account has stakes and the total amount along with all the seperate stakes
     */
    function hasStake(address _staker)
        public
        view
        returns (StakingSummary memory)
    {
        // totalStakeAmount is used to count total staked amount of the address
        uint256 totalStakeAmount;
        // Keep a summary in memory since we need to calculate this
        StakingSummary memory summary = StakingSummary(
            0,
            stakeholders[stakes[_staker]].addressStakes
        );
        // Iterate all stakes and grab amount of stakes
        for (uint256 s = 0; s < summary.stakes.length; s += 1) {
            uint256 availableReward = calculateStakeReward(summary.stakes[s]);
            summary.stakes[s].claimable = availableReward;
            totalStakeAmount = totalStakeAmount + summary.stakes[s].amount;
        }
        // Assign calculated amount to summary
        summary.total_amount = totalStakeAmount;
        return summary;
    }
}
