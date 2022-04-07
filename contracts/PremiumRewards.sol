// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PremiumRewards is ReentrancyGuard {
    IERC20 public rewardsToken;

    uint256 public rewardRate = 1;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public precision = 1e18;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 public totalShares;
    uint256 public premiumSupply;
    mapping(address => uint256) private _balances;

    constructor(address _rewardsToken) {
        rewardsToken = IERC20(_rewardsToken);
    }

    function depositPremium(uint256 _amount) internal {
        premiumSupply += _amount;
    }

    function balanceOfPremiums(address _account) external view returns (uint256) {
        return _balances[_account];
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalShares == 0) {
            return 0;
        }
        return
            rewardPerTokenStored +
            (((block.timestamp - lastUpdateTime) * rewardRate * precision) / totalShares);
    }

    function earned(address account) public view returns (uint256) {
        return
            ((_balances[account] *
                (rewardPerToken() - userRewardPerTokenPaid[account]))) +
            rewards[account];
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        rewards[account] = earned(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
        _;
    }

    function _stake(uint256 _amount) internal updateReward(msg.sender) nonReentrant {
        totalShares += _amount;
        _balances[msg.sender] += _amount;
    }

    function withdraw(uint256 _amount) external updateReward(msg.sender) nonReentrant {
        totalShares -= _amount;
        _balances[msg.sender] -= _amount;
    }

    function claim() external updateReward(msg.sender) nonReentrant {
        uint256 reward = rewards[msg.sender];
        rewards[msg.sender] = 0;
        rewardsToken.transfer(msg.sender, reward);
    }
}