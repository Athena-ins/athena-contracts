// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IStakedAten } from "./interfaces/IStakedAten.sol";
import { IPositionsManager } from "./interfaces/IPositionsManager.sol";

// @notice Staking Pool Contract: General Pool (GP)
contract StakingGeneralPool is IStakedAten, Ownable {
  using SafeERC20 for IERC20;
  address public immutable atenTokenAddress;
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

  struct RewardRateLevel {
    uint256 amountSupplied;
    uint128 aprStaking; // (10_000 = 100% APR)
  }
  // Available staking reward levels
  RewardRateLevel[] public stakingRewardRates;

  struct AtenFeeLevel {
    uint256 atenAmount;
    uint128 feeRate; // (10_000 = 100% fee)
  }
  // Performance fee levels
  AtenFeeLevel[] public supplyFeeLevels;

  /**
   * @notice constructs Pool LP Tokens for staking, decimals defaults to 18
   * @param atenTokenAddress_ is the address of the staked token
   * @param core_ is the address of the core contract
   */
  constructor(
    address atenTokenAddress_,
    address core_,
    address positionManager_
  ) {
    atenTokenAddress = atenTokenAddress_;
    core = core_;
    positionManagerInterface = IPositionsManager(positionManager_);

    IERC20(atenTokenAddress).safeApprove(core, type(uint256).max);
  }

  /// ============================ ///
  /// ========== ERRORS ========== ///
  /// ============================ ///

  error MissingBaseRate();
  error MustSortInAscendingOrder();
  error GreaterThan100Percent();

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
  function calculateStakeReward(
    Stakeholder memory userStake_
  ) internal view returns (uint256) {
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
  function rewardsOf(address staker_) public view returns (uint256) {
    Stakeholder memory _userStake = stakes[staker_];
    uint256 newRewards = calculateStakeReward(_userStake);
    return newRewards + _userStake.accruedRewards;
  }

  /**
   * @notice
   * Returns the full amount of an account's staked ATEN including rewards.
   * @param account_ the account whose balance is read
   */
  function positionOf(address account_) public view returns (uint256) {
    Stakeholder storage userStake = stakes[account_];
    uint256 newRewards = calculateStakeReward(userStake);

    return userStake.amount + newRewards + userStake.accruedRewards;
  }

  function getUserStakingPosition(
    address account_
  ) external view returns (Stakeholder memory userStake) {
    userStake = stakes[account_];

    userStake.user = account_;
    uint256 newRewards = calculateStakeReward(userStake);
    userStake.accruedRewards += newRewards;
  }

  // ====== STAKING REWARD LEVELS ====== //

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

    levels = new RewardRateLevel[](nbLevels);

    for (uint256 i = 0; i < nbLevels; i++) {
      levels[i] = stakingRewardRates[i];
    }
  }

  /** @notice
   * Retrieves the fee rate according to amount of staked ATEN.
   * @dev Returns displays warning but levels require an amountSupplied of 0
   * @param suppliedCapital_ USD amount of the user's cover positions
   * @return uint128 staking APR of user in GP
   **/
  function getStakingRewardRate(
    uint256 suppliedCapital_
  ) public view returns (uint128) {
    // Lazy check to avoid loop if user doesn't supply
    if (suppliedCapital_ == 0) return stakingRewardRates[0].aprStaking;

    // Inversed loop starts with the end to find adequate level
    for (uint256 i = stakingRewardRates.length - 1; 0 <= i; i--) {
      // Rate level with amountSupplied of 0 will always be true
      if (stakingRewardRates[i].amountSupplied <= suppliedCapital_)
        return stakingRewardRates[i].aprStaking;
    }

    return stakingRewardRates[0].aprStaking;
  }

  // ====== SUPPLY FEE LEVELS ====== //

  /** @notice
   * Gets all the cover supply fee levels according to the amount of staked ATEN.
   * @return levels all the fee levels
   **/
  function getSupplyFeeLevels()
    public
    view
    returns (AtenFeeLevel[] memory levels)
  {
    uint256 nbLevels = supplyFeeLevels.length;
    levels = new AtenFeeLevel[](nbLevels);

    for (uint256 i = 0; i < nbLevels; i++) {
      levels[i] = supplyFeeLevels[i];
    }
  }

  /** @notice
   * Retrieves the fee rate according to amount of staked ATEN.
   * @dev Returns displays warning but levels require an amountAten of 0
   * @param stakedAten_ amount of ATEN the user stakes in GP
   * @return _ amount of fees applied to cover supply interests
   **/
  function getFeeRateWithAten(
    uint256 stakedAten_
  ) public view returns (uint128) {
    // Lazy check to avoid loop if user doesn't stake
    if (stakedAten_ == 0) return supplyFeeLevels[0].feeRate;

    // Inversed loop starts with the end to find adequate level
    for (uint256 i = supplyFeeLevels.length - 1; 0 <= i; i--) {
      // Rate level with atenAmount of 0 will always be true
      if (supplyFeeLevels[i].atenAmount <= stakedAten_)
        return supplyFeeLevels[i].feeRate;
    }

    return supplyFeeLevels[0].feeRate;
  }

  function getUserFeeRate(address account_) public view returns (uint128) {
    uint256 stakedAten = positionOf(account_);
    return getFeeRateWithAten(stakedAten);
  }

  /// ============================= ///
  /// ======= USER FEATURES ======= ///
  /// ============================= ///

  function stake(address account_, uint256 amount_) external override onlyCore {
    require(amount_ > 0, "SGP: cannot stake 0");

    Stakeholder storage userStake = stakes[account_];

    /// @dev After this the movements in position update the rate
    if (userStake.amount == 0) {
      // If the user had no staking position we need to get his staking APR
      uint256 usdCapitalSupplied = positionManagerInterface
        .allCapitalSuppliedByAccount(account_);
      userStake.rate = getStakingRewardRate(usdCapitalSupplied);
    } else {
      // If the user already has stake then we save his accrued rewards
      uint256 newRewards = calculateStakeReward(userStake);
      userStake.accruedRewards += newRewards;
    }

    userStake.amount += amount_;
    userStake.since = block.timestamp;

    emit Staked(account_, amount_, block.timestamp);
  }

  function claimRewards(
    address account_
  ) external override onlyCore returns (uint256 totalRewards) {
    Stakeholder storage userStake = stakes[account_];
    uint256 newRewards = calculateStakeReward(userStake);

    // Returns the full amount of rewards
    totalRewards = userStake.accruedRewards + newRewards;

    // We need to remove all user rewards
    userStake.accruedRewards = 0;
    userStake.since = block.timestamp;
  }

  function withdraw(
    address account_,
    uint256 amount_
  ) external override onlyCore {
    Stakeholder storage userStake = stakes[account_];
    require(amount_ <= userStake.amount, "SGP: amount too big");

    // Save accred rewards before updating the amount staked
    uint256 newRewards = calculateStakeReward(userStake);
    userStake.accruedRewards += newRewards;

    // Remove token from user position
    userStake.amount -= amount_;

    // We reset the timer with the new amount of tokens staked
    userStake.since = block.timestamp;
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
        uint256 newRewards = calculateStakeReward(userStake);
        userStake.accruedRewards += newRewards;

        // Reset the staking having saved the accrued rewards
        userStake.rate = newRewardRate;
        userStake.since = block.timestamp;
      }
    }
  }

  /// ========================= ///
  /// ========= ADMIN ========= ///
  /// ========================= ///

  function setStakingRewardRates(
    RewardRateLevel[] calldata stakingLevels_
  ) external onlyOwner {
    // First clean the storage
    delete stakingRewardRates;

    // Set all cover supply fee levels
    uint256 previousAmountSupplied = 0;
    for (uint256 i = 0; i < stakingLevels_.length; i++) {
      RewardRateLevel calldata level = stakingLevels_[i];

      if (i == 0) {
        // Require that the first level indicates fees for atenAmount 0
        if (level.amountSupplied != 0) revert MissingBaseRate();
      } else {
        // If it isn't the first item check that items are ascending
        if (level.amountSupplied < previousAmountSupplied)
          revert MustSortInAscendingOrder();

        previousAmountSupplied = level.amountSupplied;
      }

      // Check that APR is not higher than 100%
      if (10_000 < level.aprStaking) revert GreaterThan100Percent();

      // save to storage
      stakingRewardRates.push(level);
    }
  }

  /** @notice
   * Set the fee levels on cover interests according to amount of staked ATEN in general pool.
   * @dev Levels must be in ascending order of atenAmount
   * @dev The atenAmount indicates the upper limit for the level
   * @param levels_ array of fee level structs
   **/
  function setFeeLevelsWithAten(
    AtenFeeLevel[] calldata levels_
  ) public onlyOwner {
    // First clean the storage
    delete supplyFeeLevels;

    // Set all cover supply fee levels
    uint256 previousAtenAmount = 0;
    for (uint256 i = 0; i < levels_.length; i++) {
      AtenFeeLevel calldata level = levels_[i];

      if (i == 0) {
        // Require that the first level indicates fees for atenAmount 0
        if (level.atenAmount != 0) revert MissingBaseRate();
      } else {
        // If it isn't the first item check that items are ascending
        if (level.atenAmount < previousAtenAmount)
          revert MustSortInAscendingOrder();

        previousAtenAmount = level.atenAmount;
      }

      // Check that fee rate is not higher than 100%
      if (10_000 < level.feeRate) revert GreaterThan100Percent();

      // save to storage
      supplyFeeLevels.push(level);
    }
  }
}
