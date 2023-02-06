// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IPriceOracle.sol";
import "./interfaces/IVaultERC20.sol";
import "./interfaces/IPolicyManager.sol";

/**
 * @notice
 * Cover Refund Staking Pool
 **/
contract StakingPolicy is Ownable {
  using SafeERC20 for IERC20;

  // Address of the core Athena contract
  address public immutable coreAddress;

  IERC20 public atenTokenInterface;
  IPriceOracle public priceOracleInterface;
  IVaultERC20 public atensVaultInterface;
  IPolicyManager public policyManagerInterface;

  // The amount of ATEN tokens still available for staking rewards
  uint256 public unpaidRewards;

  // The current refund rate & penalty rate of the staking pool
  // @dev 10_000 = 100% APR
  uint64 public refundRate = 10_000;
  uint64 public basePenaltyRate = 1_000;
  uint64 public durationPenaltyRate = 5_000;
  uint64 public shortCoverDuration = 300 days;

  // A premium refund position of a user
  struct RefundPosition {
    uint256 coverId;
    uint256 earnedRewards;
    uint256 stakedAmount;
    uint256 lastPremiumSpent;
    uint256 atenPrice;
    uint64 initTimestamp;
    uint64 rewardsSinceTimestamp;
    uint64 endTimestamp;
    uint64 rate;
  }

  // Maps a cover ID to its premium refund
  mapping(uint256 => RefundPosition) public positions;

  /**
   * @notice constructs Pool LP Tokens for staking, decimals defaults to 18
   * @param core_ is the address of the core contract
   * @param atenToken_ is the address of ATEN token
   * @param priceOracle_ is the address of ATEN price oracle
   * @param atensVault_ is the address of ATEN rewards vault
   * @param policyManager_ is the address of cover manager
   */
  constructor(
    address core_,
    address atenToken_,
    address priceOracle_,
    address atensVault_,
    address policyManager_
  ) {
    coreAddress = core_;

    atenTokenInterface = IERC20(atenToken_);
    priceOracleInterface = IPriceOracle(priceOracle_);
    atensVaultInterface = IVaultERC20(atensVault_);
    policyManagerInterface = IPolicyManager(policyManager_);
  }

  /// ============================ ///
  /// ========== ERRORS ========== ///
  /// ============================ ///

  error OnlyCore();
  error TimestampIsInTheFuture();
  error NotEnoughRewardsLeft();
  error NotEnoughUnpaidRewards();
  error CannotStakeZero();
  error PositionAlreadyExists();
  error PositionClosedOrExpired();
  error PositionDoesNotExist();
  error DurationOfZero();
  error PenaltyRatesTooHigh();

  /// ============================ ///
  /// ========== EVENTS ========== ///
  /// ============================ ///

  /// @notice Triggered whenever a user creates a position
  event Stake(uint256 indexed coverId, uint256 amount);
  /// @notice Triggered whenever a user updates a position
  event AddStake(uint256 indexed coverId, uint256 amount);
  /// @notice Triggered whenever a user unstakes tokens
  event Unstake(uint256 indexed coverId, uint256 amount);
  /// @notice Triggered whenever a user unstakes tokens
  event WithdrawRewards(uint256 indexed coverId, uint256 amount);
  /// @notice Triggered whenever a cover expires
  event EndStake(uint256 indexed coverId);
  /// @notice Triggered whenever a staking position is closed by the user
  event CloseStake(uint256 indexed coverId);

  /// @notice Triggered whenever the refund and/or penalty rates are updated
  event RatesUpdated(
    uint256 newRewardsRate,
    uint64 newMinPenaltyRate,
    uint256 newFullPenaltyRate
  );
  /// @notice Triggered whenever the short cover duration is updated
  event ShortCoverDurationUpdated(uint64 newShortCoverDuration);

  /// =============================== ///
  /// ========== MODIFIERS ========== ///
  /// =============================== ///

  modifier onlyCore() {
    if (msg.sender != coreAddress) revert OnlyCore();
    _;
  }

  /// ============================= ///
  /// ========== HELPERS ========== ///
  /// ============================= ///

  function _getSpentPremium(uint256 coverId)
    internal
    view
    returns (uint256 premiumSpent)
  {
    return policyManagerInterface.getCoverPremiumSpent(coverId);
  }

  function _computeRewards(RefundPosition memory pos, uint256 premiumSpent)
    internal
    view
    returns (uint256 rewards)
  {
    uint64 rewardsSinceTimestamp = pos.rewardsSinceTimestamp;
    uint64 endTimestamp = pos.endTimestamp;
    uint64 rate = pos.rate;

    uint256 timeElapsed;
    // We want to cap the rewards to the covers expiration
    uint256 upTo = endTimestamp != 0 ? endTimestamp : block.timestamp;
    if (upTo < rewardsSinceTimestamp) revert TimestampIsInTheFuture();
    unchecked {
      // Unckecked because we checked that upTo is bigger
      timeElapsed = upTo - rewardsSinceTimestamp;
    }

    // Return proportional rewards
    uint256 maxYearlyReward = (pos.stakedAmount * rate) / 10_000;
    uint256 maxYearPercentage = (timeElapsed * 1e18) / 365 days;
    uint256 maxReward = (maxYearPercentage * maxYearlyReward) / 1e18;

    // Compute reward based on the premium spent for the cover
    uint256 trueReward = (premiumSpent - pos.lastPremiumSpent) * pos.atenPrice;

    rewards = trueReward < maxReward ? trueReward : maxReward;
  }

  function _applyPenalty(uint256 totalRewards, uint64 timeElapsed)
    internal
    view
    returns (uint256)
  {
    if (shortCoverDuration < timeElapsed) {
      return totalRewards;
    } else {
      // We apply an early withdrawal penalty
      uint64 penaltyRate = basePenaltyRate +
        (((shortCoverDuration - timeElapsed) * durationPenaltyRate) /
          shortCoverDuration);

      return (totalRewards * (10_000 - penaltyRate)) / 10_000;
    }
  }

  function _updatePositionRewards(RefundPosition storage pos)
    internal
    returns (uint256)
  {
    uint256 atenPrice = priceOracleInterface.getAtenPrice();
    uint64 timestamp = uint64(block.timestamp);

    uint256 premiumSpent = _getSpentPremium(pos.coverId);
    uint256 earnedRewards = _computeRewards(pos, premiumSpent);
    _reflectEarnedRewards(earnedRewards);

    // Register last reward update & update position with latest config
    pos.lastPremiumSpent = premiumSpent;
    pos.rewardsSinceTimestamp = timestamp;
    pos.atenPrice = atenPrice;
    pos.rate = refundRate;

    return earnedRewards;
  }

  /// =========================== ///
  /// ========== VIEWS ========== ///
  /// =========================== ///

  function hasPosition(uint256 coverId) external view returns (bool) {
    RefundPosition memory pos = positions[coverId];
    return pos.initTimestamp != 0;
  }

  // /**
  //  * @notice
  //  * Returns a user's staking position for a specific policy.
  //  * @param account_ is the address of the user
  //  * @param coverId_ is the id of the policy
  //  * @return _ the corresponding staking position if it exists
  //  */
  // function accountStakingPositions(address account_, uint256 coverId_)
  //   external
  //   view
  //   returns (StakingPosition memory)
  // {
  //   return _stakes[account_].positions[coverId_];
  // }

  // // @bw use coverIds from policy manager instead of local array
  // /**
  //  * @notice
  //  * Returns all staking position of a user.
  //  * @param account_ is the address of the user
  //  * @return stakingPositions all staking positions if there are any
  //  */
  // function allAccountStakingPositions(address account_)
  //   external
  //   view
  //   returns (StakingPosition[] memory stakingPositions)
  // {
  //   StakeAccount storage userStakingPositions = _stakes[account_];

  //   stakingPositions = new StakingPosition[](
  //     userStakingPositions.policyTokenIds.length
  //   );

  //   for (uint256 i = 0; i < userStakingPositions.policyTokenIds.length; i++) {
  //     uint256 coverId = userStakingPositions.policyTokenIds[i];

  //     stakingPositions[i] = userStakingPositions.positions[coverId];
  //   }
  // }

  /**
   * @notice
   * Returns the amount of rewards a user has earned for a specific staking position.
   * @dev The rewards are capped at 365 days of staking at the specified APR.
   * @param coverId_ is the id of the policy
   * @ @return _ the amount of rewards earned
   */
  function positionRefundRewards(uint256 coverId_)
    external
    view
    returns (uint256 earnedRewards)
  {
    RefundPosition memory pos = positions[coverId_];

    uint256 premiumSpent = _getSpentPremium(coverId_);
    earnedRewards = _computeRewards(pos, premiumSpent);
  }

  function netPositionRefundRewards(uint256 coverId_)
    external
    view
    returns (uint256)
  {
    RefundPosition memory pos = positions[coverId_];
    uint64 timestamp = uint64(block.timestamp);

    uint256 premiumSpent = _getSpentPremium(coverId_);
    uint256 newEarnedRewards = _computeRewards(pos, premiumSpent);

    uint256 totalRewards = pos.earnedRewards + newEarnedRewards;
    uint64 timeElapsed = timestamp - pos.initTimestamp;

    return _applyPenalty(totalRewards, timeElapsed);
  }

  /// ============================= ///
  /// ========== HELPERS ========== ///
  /// ============================= ///

  function _reflectEarnedRewards(uint256 amount) private {
    uint256 rewardsLeft = atensVaultInterface.coverRefundRewardsTotal();
    if (rewardsLeft < unpaidRewards + amount) revert NotEnoughRewardsLeft();

    unpaidRewards += amount;
  }

  function _reflectPaidRewards(uint256 amount) private {
    if (unpaidRewards < amount) revert NotEnoughUnpaidRewards();
    unchecked {
      // Uncheck since unpaidRewards can only be bigger than amount
      unpaidRewards -= amount;
    }
  }

  /// ============================= ///
  /// ========== DEPOSIT ========== ///
  /// ============================= ///

  function createStakingPosition(uint256 coverId_, uint256 amount_) private {
    if (amount_ == 0) revert CannotStakeZero();

    RefundPosition storage pos = positions[coverId_];
    if (pos.initTimestamp != 0) revert PositionAlreadyExists();

    uint256 premiumSpent = policyManagerInterface.getCoverPremiumSpent(
      coverId_
    );

    uint256 atenPrice = priceOracleInterface.getAtenPrice();
    uint64 timestamp = uint64(block.timestamp);

    positions[coverId_] = RefundPosition({
      coverId: coverId_,
      earnedRewards: 0,
      stakedAmount: amount_,
      lastPremiumSpent: premiumSpent,
      atenPrice: atenPrice,
      rewardsSinceTimestamp: timestamp,
      initTimestamp: timestamp,
      endTimestamp: 0,
      rate: refundRate
    });

    emit Stake(coverId_, amount_);
  }

  /**
   * @notice
   * Deposit a policy holder's ATEN so they can earn staking rewards.
   * @param coverId_ is the id of the policy
   * @param amount_ is the amount of tokens to stake
   */
  function addToStake(uint256 coverId_, uint256 amount_) external onlyCore {
    if (amount_ == 0) revert CannotStakeZero();

    RefundPosition storage pos = positions[coverId_];

    // We don't want users to stake after the cover is expired
    if (pos.endTimestamp != 0) revert PositionClosedOrExpired();
    if (pos.initTimestamp == 0) revert PositionDoesNotExist();

    uint256 earnedRewards = _updatePositionRewards(pos);

    pos.earnedRewards += earnedRewards;
    pos.stakedAmount += amount_;

    emit AddStake(coverId_, amount_);
  }

  /// ============================== ///
  /// ========== WITHDRAW ========== ///
  /// ============================== ///

  function withdrawStakedAten(
    uint256 coverId_,
    address account_,
    uint256 amount_
  ) external onlyCore {
    RefundPosition storage pos = positions[coverId_];
    if (pos.initTimestamp == 0) revert PositionDoesNotExist();

    uint256 earnedRewards = _updatePositionRewards(pos);

    pos.earnedRewards += earnedRewards;
    pos.stakedAmount -= amount_;

    atenTokenInterface.safeTransfer(account_, amount_);
    emit Unstake(coverId_, amount_);
  }

  function withdrawRewards(uint256 coverId_)
    external
    onlyCore
    returns (uint256)
  {
    RefundPosition storage pos = positions[coverId_];
    if (pos.initTimestamp == 0) revert PositionDoesNotExist();

    uint256 newEarnedRewards = _updatePositionRewards(pos);

    uint256 totalRewards = pos.earnedRewards + newEarnedRewards;
    uint64 timestamp = uint64(block.timestamp);
    uint64 timeElapsed = timestamp - pos.initTimestamp;

    pos.earnedRewards = 0;
    pos.initTimestamp = timestamp;

    // Always reflect full amount since penalties are not included
    _reflectPaidRewards(totalRewards);

    emit WithdrawRewards(coverId_, totalRewards);

    return _applyPenalty(totalRewards, timeElapsed);
  }

  /// =============================== ///
  /// ========== END STAKE ========== ///
  /// =============================== ///

  function closePosition(uint256 coverId_, address account_)
    external
    onlyCore
    returns (uint256)
  {
    RefundPosition storage pos = positions[coverId_];

    uint64 initTimestamp = pos.initTimestamp;
    if (initTimestamp == 0) revert PositionDoesNotExist();

    uint256 amountStaked = pos.stakedAmount;
    uint256 earnedRewards = pos.earnedRewards;
    uint256 newEarnedRewards = _updatePositionRewards(pos);

    // We can already delete the position since all necessary data is in memory
    delete positions[coverId_];

    atenTokenInterface.safeTransfer(account_, amountStaked);

    uint256 totalRewards = earnedRewards + newEarnedRewards;
    uint64 timestamp = uint64(block.timestamp);
    uint64 timeElapsed = timestamp - initTimestamp;

    // Always reflect full amount since penalties are not included
    _reflectPaidRewards(totalRewards);

    emit CloseStake(coverId_);

    return _applyPenalty(totalRewards, timeElapsed);
  }

  // Should be called for expired cover tokens
  function endStakingPositions(uint256[] calldata coverIds_) external onlyCore {
    uint64 timestamp = uint64(block.timestamp);

    for (uint256 i = 0; i < coverIds_.length; i++) {
      uint256 coverId_ = coverIds_[i];
      RefundPosition storage pos = positions[coverId_];

      if (pos.initTimestamp != 0 && pos.endTimestamp == 0) {
        pos.endTimestamp = timestamp;
        emit EndStake(coverId_);
      }
    }
  }

  /// =========================== ///
  /// ========== ADMIN ========== ///
  /// =========================== ///

  function setShortCoverDuration(uint64 shortCoverDuration_)
    external
    onlyOwner
  {
    if (shortCoverDuration_ == 0) revert DurationOfZero();
    shortCoverDuration = shortCoverDuration_;

    emit ShortCoverDurationUpdated(shortCoverDuration_);
  }

  /**
   * @notice
   * Sets the new staking rewards APR for newly created policies.
   * A value of 10_000 corresponds to 100%.
   * @param refundRate_ the premium refund rate
   * @param basePenaltyRate_ the base penalty rate
   * @param durationPenaltyRate_ the time based penalty rate
   */
  function setRefundAndPenaltyRate(
    uint64 refundRate_,
    uint64 basePenaltyRate_,
    uint64 durationPenaltyRate_
  ) external onlyOwner {
    if (10_000 <= basePenaltyRate_ + durationPenaltyRate_)
      revert PenaltyRatesTooHigh();

    refundRate = refundRate_;
    basePenaltyRate = basePenaltyRate_;
    durationPenaltyRate = durationPenaltyRate_;

    emit RatesUpdated(refundRate_, basePenaltyRate_, durationPenaltyRate_);
  }
}
