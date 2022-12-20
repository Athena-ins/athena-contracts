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

  struct StakingPosition {
    uint256 amount;
    uint128 timestamp;
    uint128 rate;
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

  function stake(
    address account_,
    uint256 tokenId_,
    uint256 amount_
  ) external onlyCore {
    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(address(0), account_, amount_);

    // Send tokens from user to staking pool
    IERC20(underlyingAssetAddress).safeTransferFrom(
      account_,
      address(this),
      amount_
    );

    _stake(account_, tokenId_, amount_);
    _mint(account_, amount_);
  }

  /**
   * @notice
   * _Stake is used to make a stake for an sender.
   */
  function _stake(
    address account_,
    uint256 tokenId_,
    uint256 amount_
  ) internal {
    require(amount_ > 0, "Cannot stake nothing");
    uint128 timestamp = uint128(block.timestamp);
    StakeAccount storage __userStake = stakes[account_];

    __userStake.positions[tokenId_] = StakingPosition(
      amount_,
      timestamp,
      divRewardPerYear
    );

    __userStake.tokenIds.push(tokenId_);

    emit Staked(account_, amount_, timestamp);
  }

  /**
   * @notice
   * Sets the new staking rewards APR for newly created policies.
   * @param newRate_ the new reward rate (100% APR = 10_000)
   */
  function setRewardsPerYear(uint128 newRate_) external onlyCore {
    divRewardPerYear = (365 days) * newRate_;
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

    return ((block.timestamp - pos.timestamp) * pos.amount * 10000) / pos.rate;
  }

  function withdraw(
    address account_,
    uint256 tokenId_,
    uint256 amount_
  ) external onlyCore returns (uint256) {
    uint256 __rewards = _withdrawStake(account_, amount_, tokenId_);
    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(account_, address(0), amount_);
    //@dev TODO do not modify staking date for user is not enough balance
    console.log("Rewards : ", __rewards);
    console.log(
      "balance here : ",
      IERC20(underlyingAssetAddress).balanceOf(address(this))
    );
    IERC20(underlyingAssetAddress).safeTransfer(account_, amount_);
    return __rewards;
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

  function userStakes(address account_)
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
}
