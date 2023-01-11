// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./libraries/ERC20withSnapshot.sol";

import "./FixedRateStakeable.sol";
import "./interfaces/IStakedAten.sol";

// @notice Staking Pool Contract: General Pool (GP)
contract StakingGeneralPool is
  IStakedAten,
  ERC20WithSnapshot,
  FixedRateStakeable
{
  using SafeERC20 for IERC20;
  address public immutable underlyingAssetAddress;
  address public immutable core;

  /**
   * @notice constructs Pool LP Tokens for staking, decimals defaults to 18
   * @param _underlyingAsset is the address of the staked token
   * @param _core is the address of the core contract
   */
  constructor(address _underlyingAsset, address _core)
    ERC20WithSnapshot("ATEN General Pool Staking", "ATENgps")
  {
    underlyingAssetAddress = _underlyingAsset;
    core = _core;
  }

  /// =========================== ///
  /// ========== MODIFIERS ========== ///
  /// =========================== ///

  modifier onlyCore() {
    require(msg.sender == core, "SGP: Only Core");
    _;
  }

  /// =========================== ///
  /// ========== VIEWS ========== ///
  /// =========================== ///

  /**
   * @notice
   * Returns the full amount of an account's staked ATEN including rewards.
   * @param account_ the account whose balance is read
   */
  function positionOf(address account_) public view returns (uint256) {
    Stakeholder storage userStake = stakes[account_];
    uint256 reward = calculateStakeReward(userStake);

    return userStake.amount + reward;
  }

  /** @notice
   * Gets all the ATEN staking reward levels according to the amount of capital supplied.
   * @return levels all the fee levels
   **/
  function getStakingRewardsLevels()
    public
    view
    returns (RewardRateLevel[] memory levels)
  {
    uint256 nbLevels = stakingRewardRates.length;

    for (uint256 i = 0; i < nbLevels; i++) {
      levels[i] = stakingRewardRates[i];
    }
  }

  /// =============================== ///
  /// ======= STAKE / UNSTAKE ======= ///
  /// =============================== ///

  function stake(
    address _account,
    uint256 _amount,
    uint256 _usdCapitalSupplied
  ) external override onlyCore {
    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(address(0), _account, _amount);
    IERC20(underlyingAssetAddress).safeTransferFrom(
      _account,
      address(this),
      _amount
    );
    _stake(_account, _amount, _usdCapitalSupplied);
  }

  function claimRewards(address account_)
    external
    override
    onlyCore
    returns (uint256)
  {
    return _claimRewards(account_);
  }

  function withdraw(address _account, uint256 _amount)
    external
    override
    onlyCore
  {
    uint256 amountToReturn = _withdrawStake(_account, _amount);
    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(_account, address(0), _amount);

    // @bw should handle only staked amount and have rewards paid out by vault in Athena
  }

  /// =========================== ///
  /// ======= UPDATE RATE ======= ///
  /// =========================== ///

  /** @notice
   * Updates the reward rate for a user when the amount of capital supplied changes.
   * @param account_ the account whose reward rate is updated
   * @param newUsdCapital_ the new amount of capital supplied by the user
   */
  function updateUserRewardRate(address account_, uint256 newUsdCapital_)
    external
    override
    onlyCore
  {
    uint128 newRewardRate = getStakingRewardRate(newUsdCapital_);
    Stakeholder storage userStake = stakes[account_];

    // Check if the change in the amount of capital causes a change in reward rate
    if (newRewardRate != userStake.rate) {
      // Save the rewards already earned by staker
      uint256 accruedReward = calculateStakeReward(userStake);
      userStake.accruedRewards += accruedReward;

      // Reset the staking having saved the accrued rewards
      userStake.rate = newRewardRate;
      userStake.since = block.timestamp;
    }
  }

  /// ========================= ///
  /// ========= ADMIN ========= ///
  /// ========================= ///

  // @bw change to onlycore and add to core contract
  function setStakingRewards(RewardRateLevel[] calldata stakingLevels_)
    external
    onlyCore
  {
    _setStakingRewards(stakingLevels_);
  }
}
