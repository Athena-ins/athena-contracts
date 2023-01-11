// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/ERC20withSnapshot.sol";

import "./interfaces/IStakedAten.sol";
import "./interfaces/IPositionsManager.sol";

// @notice Staking Pool Contract: General Pool (GP)
contract StakingGeneralPool is IStakedAten, ERC20WithSnapshot {
  using SafeERC20 for IERC20;
  address public immutable underlyingAssetAddress;
  address public immutable core;
  IPositionsManager public immutable positionManagerInterface;

  /**
   * @notice Stakeholder is a staker that has a stake
   */
  struct Stakeholder {
    address user;
    uint256 amount;
    uint256 since;
    uint256 accruedRewards;
    uint128 rate;
  }

  /**
   * @notice
   * stakes is used to keep track of the INDEX for the stakers in the stakes array
   */
  mapping(address => Stakeholder) public stakes;

  /**
     * @notice
      Structure for getting fixed rewards depending on amount staked
      Need to be set before use !
     */
  /// Available staking reward levels (10_000 = 100% APR)
  RewardRateLevel[] public stakingRewardRates;

  /**
   * @notice constructs Pool LP Tokens for staking, decimals defaults to 18
   * @param underlyingAsset_ is the address of the staked token
   * @param core_ is the address of the core contract
   */
  constructor(
    address underlyingAsset_,
    address core_,
    address positionManager_
  ) ERC20WithSnapshot("ATEN General Pool Staking", "ATENgps") {
    underlyingAssetAddress = underlyingAsset_;
    IERC20(underlyingAssetAddress).approve(core_, type(uint256).max);
    core = core_;
    positionManagerInterface = IPositionsManager(positionManager_);
  }

  /// ============================ ///
  /// ========== EVENTS ========== ///
  /// ============================ ///

  /**
   * @notice Staked event is triggered whenever a user stakes tokens, address is indexed to make it filterable
   */
  event Staked(address indexed user, uint256 amount, uint256 timestamp);

  /// =============================== ///
  /// ========== MODIFIERS ========== ///
  /// =============================== ///

  modifier onlyCore() {
    require(msg.sender == core, "SGP: only Core");
    _;
  }

  /// ============================= ///
  /// ========== HELPERS ========== ///
  /// ============================= ///

  /**
   * @notice
   * calculateStakeReward is used to calculate how much a user should be rewarded for their stakes
   * and the duration the stake has been active
   */
  function calculateStakeReward(Stakeholder memory userStake_)
    internal
    view
    returns (uint256)
  {
    if (userStake_.amount == 0 || userStake_.rate == 0) return 0;
    uint256 divRewardPerSecond = ((365 days) * 10_000) / userStake_.rate;

    return
      ((block.timestamp - userStake_.since) * userStake_.amount) /
      divRewardPerSecond;
  }

  /// =========================== ///
  /// ========== VIEWS ========== ///
  /// =========================== ///

  /**
   * @notice
   * public function to view rewards available for a stake
   */
  function rewardsOf(address staker_) public view returns (uint256 rewards) {
    Stakeholder memory _userStake = stakes[staker_];
    rewards = calculateStakeReward(_userStake);
    return rewards + _userStake.accruedRewards;
  }

  /**
   * @notice
   * Returns the full amount of an account's staked ATEN including rewards.
   * @param account_ the account whose balance is read
   */
  function positionOf(address account_) public view returns (uint256) {
    Stakeholder storage userStake = stakes[account_];
    uint256 reward = calculateStakeReward(userStake);

    return userStake.amount + reward + userStake.accruedRewards;
  }

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

  /// ============================= ///
  /// ======= USER FEATURES ======= ///
  /// ============================= ///

  function stake(address account_, uint256 amount_) external override onlyCore {
    require(amount_ > 0, "SGP: cannot stake 0");

    Stakeholder storage userStake = stakes[account_];

    uint256 usdCapitalSupplied;
    // We only get the user's capital if he is staking for the first time
    /// @dev After this the movements in position update the rate
    if (userStake.amount == 0) {
      usdCapitalSupplied = positionManagerInterface.allCapitalSuppliedByAccount(
          account_
        );
    }

    // If the user already have tokens staked then we must save his accrued rewards
    if (0 < userStake.amount) {
      uint256 accruedRewards = calculateStakeReward(userStake);
      userStake.accruedRewards += accruedRewards;
    }
    // If the user had no staking position we need to get his staking APR
    else {
      userStake.rate = getStakingRewardRate(usdCapitalSupplied);
    }

    userStake.amount += amount_;
    userStake.since = block.timestamp;

    emit Staked(account_, amount_, block.timestamp);

    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(address(0), account_, amount_);
  }

  function claimRewards(address account_)
    external
    override
    onlyCore
    returns (uint256 totalRewards)
  {
    Stakeholder storage userStake = stakes[account_];
    uint256 newRewards = calculateStakeReward(userStake);

    // Returns the full amount of rewards
    totalRewards = userStake.accruedRewards + newRewards;

    // We need to remove all user rewards
    userStake.accruedRewards = 0;
    userStake.since = block.timestamp;
  }

  function withdraw(address account_, uint256 amount_)
    external
    override
    onlyCore
  {
    Stakeholder storage userStake = stakes[account_];
    require(amount_ <= userStake.amount, "SGP: amount too big");

    // Save accred rewards before updating the amount staked
    uint256 accruedRewards = calculateStakeReward(userStake);
    userStake.accruedRewards += accruedRewards;

    // Remove token from user position
    userStake.amount -= amount_;

    // We reset the timer with the new amount of tokens staked
    userStake.since = block.timestamp;

    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(account_, address(0), amount_);
  }

  /// =========================== ///
  /// ======= UPDATE RATE ======= ///
  /// =========================== ///

  /** @notice
   * Updates the reward rate for a user when the amount of capital supplied changes.
   * @param account_ the account whose reward rate is updated
   */
  function updateUserRewardRate(address account_) external override onlyCore {
    uint256 usdCapitalSupplied = positionManagerInterface
      .allCapitalSuppliedByAccount(account_);

    Stakeholder storage userStake = stakes[account_];

    // We only update the rate if the user has staked tokens
    if (0 < userStake.amount) {
      uint128 newRewardRate = getStakingRewardRate(usdCapitalSupplied);

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
  }

  /// ========================= ///
  /// ========= ADMIN ========= ///
  /// ========================= ///

  // @bw change to onlycore and add to core contract
  function setStakingRewards(RewardRateLevel[] calldata stakingLevels_)
    external
    onlyCore
  {
    // First clean the storage
    delete stakingRewardRates;

    // Set all cover supply fee levels
    for (uint256 index = 0; index < stakingLevels_.length; index++) {
      RewardRateLevel calldata level = stakingLevels_[index];

      if (index == 0) {
        // Require that the first level indicates fees for atenAmount 0
        require(level.amountSupplied == 0, "SGP: must specify base rate");
      } else {
        // If it isn't the first item check that items are ascending
        require(
          stakingLevels_[index - 1].amountSupplied < level.amountSupplied,
          "SGP: sort in ascending order"
        );
      }

      // Check that APR is not higher than 100%
      require(level.aprStaking <= 10_000, "SGP: 100% < APR");

      // save to storage
      stakingRewardRates.push(level);
    }
  }
}
