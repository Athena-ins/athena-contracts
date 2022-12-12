// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// @notice DELETE this contract is not used and considered for deletion !!!

contract StakingRewards is ReentrancyGuard {
  IERC20 public rewardsToken;
  IERC20 public stakingToken;

  uint256 public rewardRate = 0;
  uint256 public lastUpdateTime;
  uint256 public rewardPerTokenStored;
  uint256 public precision = 1e18;

  mapping(address => uint256) public userRewardPerTokenPaid;
  mapping(address => uint256) public rewards;

  uint256 public totalShares;
  mapping(address => uint256) private _balances;

  constructor(address _stakingToken, address _rewardsToken) {
    stakingToken = IERC20(_stakingToken);
    rewardsToken = IERC20(_rewardsToken);
  }

  function balanceOfPremiums(address account) external view returns (uint256) {
    return _balances[account];
  }

  function rewardPerToken() public view returns (uint256) {
    if (totalShares == 0) {
      return 0;
    }
    return
      rewardPerTokenStored +
      (((block.timestamp - lastUpdateTime) * rewardRate * precision) /
        totalShares);
  }

  function earned(address account) public view returns (uint256) {
    return
      (
        (_balances[account] *
          (rewardPerToken() - userRewardPerTokenPaid[account]))
      ) + rewards[account];
  }

  modifier updateReward(address account) {
    rewardPerTokenStored = rewardPerToken();
    lastUpdateTime = block.timestamp;
    rewards[account] = earned(account);
    userRewardPerTokenPaid[account] = rewardPerTokenStored;
    _;
  }

  modifier updateRewardNoAccount() {
    rewardPerTokenStored = rewardPerToken();
    lastUpdateTime = block.timestamp;
    _;
  }

  function _stake(uint256 _amount)
    internal
    updateReward(msg.sender)
    nonReentrant
  {
    totalShares += _amount;
    _balances[msg.sender] += _amount;
    stakingToken.transferFrom(msg.sender, address(this), _amount);
  }

  function withdraw(uint256 _amount)
    external
    updateReward(msg.sender)
    nonReentrant
  {
    totalShares -= _amount;
    _balances[msg.sender] -= _amount;
    stakingToken.transfer(msg.sender, _amount);
  }

  function claim() external updateReward(msg.sender) nonReentrant {
    uint256 reward = rewards[msg.sender];
    rewards[msg.sender] = 0;
    rewardsToken.transfer(msg.sender, reward);
  }
}
