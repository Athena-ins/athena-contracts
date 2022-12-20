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
  address public immutable underlyingAssetAddress;
  address public immutable core;
  uint128 public divRewardPerYear = (365 days) * 10_000; // 10_000 = 100% APR

  struct PolicyStake {
    uint256 amount;
    uint128 timestamp;
    uint128 rate;
  }

  /**
   * @notice Stakeholder is a staker that has a stake
   */
  struct Stakeholder {
    address user;
    mapping(uint256 => PolicyStake) userStakes;
    uint256[] tokenIds;
  }

  /**
   * @notice
   * stakes is used to keep track of the INDEX for the stakers in the stakes array
   */
  mapping(address => Stakeholder) public stakes;

  /**
   * @notice Staked event is triggered whenever a user stakes tokens, address is indexed to make it filterable
   */
  event Staked(address indexed user, uint256 amount, uint128 timestamp);

  /**
   * @notice constructs Pool LP Tokens for staking, decimals defaults to 18
   * @param _underlyingAsset is the address of the staked token
   * @param _core is the address of the core contract
   */
  constructor(address _underlyingAsset, address _core)
    ERC20WithSnapshot("ATEN Policy Holders Token", "ATEN_PO_LP")
  {
    underlyingAssetAddress = _underlyingAsset;
    core = _core;
  }

  modifier onlyCore() {
    require(msg.sender == core, "Only Core");
    _;
  }

  function stake(
    address _account,
    uint256 tokenId_,
    uint256 _amount
  ) external onlyCore {
    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(address(0), _account, _amount);

    // Send tokens from user to staking pool
    IERC20(underlyingAssetAddress).safeTransferFrom(
      _account,
      address(this),
      _amount
    );

    _stake(_account, tokenId_, _amount);
    _mint(_account, _amount);
  }

  /**
   * @notice
   * _Stake is used to make a stake for an sender.
   */
  function _stake(
    address _account,
    uint256 tokenId_,
    uint256 _amount
  ) internal {
    require(_amount > 0, "Cannot stake nothing");
    uint128 timestamp = uint128(block.timestamp);
    Stakeholder storage __userStake = stakes[_account];

    __userStake.userStakes[tokenId_] = PolicyStake(
      _amount,
      timestamp,
      divRewardPerYear
    );

    __userStake.tokenIds.push(tokenId_);

    emit Staked(_account, _amount, timestamp);
  }

  /**
   * @notice
   * Sets the new staking rewards APR for newly created policies.
   * @param newRate the new reward rate (100% APR = 10_000)
   */
  function setRewardsPerYear(uint128 newRate) external onlyCore {
    divRewardPerYear = (365 days) * newRate;
  }

  /**
   * @notice
   * calculateStakeReward is used to calculate how much a user should be rewarded for their stakes
   * and the duration the stake has been active
   * Currently the reward is 100% APR per year
   */
  function calculateStakeReward(
    Stakeholder storage userStake_,
    uint256 tokenId_
  ) internal view returns (uint256) {
    if (userStake_.tokenIds.length == 0) return 0;

    return
      ((block.timestamp - userStake_.userStakes[tokenId_].timestamp) *
        userStake_.userStakes[tokenId_].amount *
        10000) / userStake_.userStakes[tokenId_].rate;
  }

  function withdraw(
    address _account,
    uint256 tokenId_,
    uint256 _amount
  ) external onlyCore returns (uint256) {
    uint256 __rewards = _withdrawStake(_account, _amount, tokenId_);
    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(_account, address(0), _amount);
    //@dev TODO do not modify staking date for user is not enough balance
    console.log("Rewards : ", __rewards);
    console.log(
      "balance here : ",
      IERC20(underlyingAssetAddress).balanceOf(address(this))
    );
    IERC20(underlyingAssetAddress).safeTransfer(_account, _amount);
    return __rewards;
  }

  function _withdrawStake(
    address _account,
    uint256 tokenId_,
    uint256 _amount
  ) internal returns (uint256) {
    Stakeholder storage __userStake = stakes[_account];
    require(
      __userStake.userStakes[tokenId_].amount >= _amount,
      "Invalid amount"
    );
    require(
      block.timestamp - __userStake.userStakes[tokenId_].timestamp >= 365 days,
      "FRSP: ATEN still locked"
    );

    // Calculate available Reward first before we start modifying data
    uint256 reward = calculateStakeReward(__userStake, tokenId_);
    // Remove by subtracting the money unstaked
    __userStake.userStakes[tokenId_].amount -= _amount;

    // Reset timer of stake
    __userStake.userStakes[tokenId_].timestamp = uint128(block.timestamp);

    return reward;
  }

  function userStakes(address _account)
    external
    view
    returns (PolicyStake[] memory stakingPositions)
  {
    Stakeholder storage userStakingPositions = stakes[_account];

    for (uint256 i = 0; i < userStakingPositions.tokenIds.length; i++) {
      uint256 tokenId = userStakingPositions.tokenIds[i];
      stakingPositions[i] = userStakingPositions.userStakes[tokenId];
    }
  }

  /**
   * @notice
   * public function to view rewards available for a stake
   */
  function rewardsOf(address _staker, uint256 tokenId_)
    public
    view
    returns (uint256 rewards)
  {
    Stakeholder storage _userStake = stakes[_staker];
    rewards = calculateStakeReward(_userStake, tokenId_);
    return rewards;
  }
}
