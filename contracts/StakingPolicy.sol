// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IPriceOracle.sol";
import "./interfaces/IVaultERC20.sol";
import "./interfaces/IPolicyManager.sol";
import "./interfaces/IStakedAtenPolicy.sol";

/**
 * @notice
 * Cover Refund Staking Pool
 **/
contract StakingPolicy is IStakedAtenPolicy, Ownable {
  using SafeERC20 for IERC20;

  // Address of the core Athena contract
  address public immutable coreAddress;

  IERC20 public atenTokenInterface;
  IPriceOracle public priceOracleInterface;
  IVaultERC20 public atensVaultInterface;
  IPolicyManager public coverManagerInterface;

  // The amount of ATEN tokens still available for staking rewards
  uint256 public unpaidRewards;

  // The current refund rate & penalty rate of the staking pool
  // @dev 10_000 = 100% APR
  uint64 public refundRate;
  uint64 public basePenaltyRate;
  uint64 public durationPenaltyRate;
  uint64 public shortCoverDuration;

  // A premium refund position of a user
  struct RefundPosition {
    uint256 coverId;
    uint256 earnedRewards;
    uint256 stakedAmount;
    uint256 premiumSpent;
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
   * @param coverManager_ is the address of cover manager
   */
  constructor(
    address core_,
    address atenToken_,
    address priceOracle_,
    address atensVault_,
    address coverManager_
  ) {
    coreAddress = core_;

    atenTokenInterface = IERC20(atenToken_);
    priceOracleInterface = IPriceOracle(priceOracle_);
    atensVaultInterface = IVaultERC20(atensVault_);
    coverManagerInterface = IPolicyManager(coverManager_);
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

  function _reflectEarnedRewards(uint256 amount_) private {
    uint256 rewardsLeft = atensVaultInterface.coverRefundRewardsTotal();
    if (rewardsLeft < unpaidRewards + amount_) revert NotEnoughRewardsLeft();

    unpaidRewards += amount_;
  }

  function _reflectPaidRewards(uint256 amount_) private {
    if (unpaidRewards < amount_) revert NotEnoughUnpaidRewards();
    unchecked {
      // Uncheck since unpaidRewards can only be bigger than amount_
      unpaidRewards -= amount_;
    }
  }

  function _getSpentPremium(uint256 coverId_)
    private
    view
    returns (uint256 lastPremiumSpent)
  {
    return coverManagerInterface.getCoverPremiumSpent(coverId_);
  }

  function _computeRewards(
    RefundPosition memory pos_,
    uint256 lastPremiumSpent_
  ) private view returns (uint256 rewards) {
    uint64 rewardsSinceTimestamp = pos_.rewardsSinceTimestamp;
    uint64 endTimestamp = pos_.endTimestamp;
    uint64 rate = pos_.rate;

    uint256 timeElapsed;
    // We want to cap the rewards to the covers expiration
    uint256 upTo = endTimestamp != 0 ? endTimestamp : block.timestamp;
    if (upTo < rewardsSinceTimestamp) revert TimestampIsInTheFuture();
    unchecked {
      // Unckecked because we checked that upTo is bigger
      timeElapsed = upTo - rewardsSinceTimestamp;
    }

    // Return proportional rewards
    uint256 maxYearlyReward = (pos_.stakedAmount * rate) / 10_000;
    uint256 maxYearPercentage = (timeElapsed * 1e18) / 365 days;
    uint256 maxReward = (maxYearPercentage * maxYearlyReward) / 1e18;

    // Compute reward based on the premium spent for the cover
    uint256 trueReward = (lastPremiumSpent_ - pos_.premiumSpent) *
      pos_.atenPrice;

    rewards = trueReward < maxReward ? trueReward : maxReward;
  }

  function _applyPenalty(uint256 totalRewards_, uint64 timeElapsed_)
    private
    view
    returns (uint256)
  {
    if (shortCoverDuration < timeElapsed_) {
      return totalRewards_;
    } else {
      // We apply an early withdrawal penalty
      uint64 penaltyRate = basePenaltyRate +
        (((shortCoverDuration - timeElapsed_) * durationPenaltyRate) /
          shortCoverDuration);

      return (totalRewards_ * (10_000 - penaltyRate)) / 10_000;
    }
  }

  function _updatePositionRewards(RefundPosition storage pos_)
    private
    returns (uint256)
  {
    uint256 atenPrice = priceOracleInterface.getAtenPrice();
    uint64 timestamp = uint64(block.timestamp);

    uint256 lastPremiumSpent = _getSpentPremium(pos_.coverId);
    uint256 earnedRewards = _computeRewards(pos_, lastPremiumSpent);
    _reflectEarnedRewards(earnedRewards);

    // Register last reward update & update position with latest config
    pos_.premiumSpent = lastPremiumSpent;
    pos_.rewardsSinceTimestamp = timestamp;
    pos_.atenPrice = atenPrice;
    pos_.rate = refundRate;

    return earnedRewards;
  }

  /// =========================== ///
  /// ========== VIEWS ========== ///
  /// =========================== ///

  function hasPosition(uint256 coverId_) public view returns (bool) {
    return positions[coverId_].initTimestamp != 0;
  }

  /**
   * @notice
   * Returns the amount of rewards a user has earned for a specific staking position.
   * @dev The rewards are capped at 365 days of staking at the specified APR.
   * @param coverId_  is the id of the cover
   * @return earnedRewards the amount of rewards earned
   */
  function positionRefundRewards(uint256 coverId_)
    external
    view
    returns (uint256 earnedRewards)
  {
    RefundPosition memory pos = positions[coverId_];

    uint256 lastPremiumSpent = _getSpentPremium(coverId_);
    earnedRewards = _computeRewards(pos, lastPremiumSpent);
  }

  function netPositionRefundRewards(uint256 coverId_)
    external
    view
    returns (uint256)
  {
    RefundPosition memory pos = positions[coverId_];
    uint64 timestamp = uint64(block.timestamp);

    uint256 lastPremiumSpent = _getSpentPremium(coverId_);
    uint256 newEarnedRewards = _computeRewards(pos, lastPremiumSpent);

    uint256 totalRewards = pos.earnedRewards + newEarnedRewards;
    uint64 timeElapsed = timestamp - pos.initTimestamp;

    return _applyPenalty(totalRewards, timeElapsed);
  }

  /**
   * @notice
   * Returns the staking position of a cover
   * @param coverId_ is the id of the cover
   * @return pos the corresponding staking position if it exists
   */
  function getRefundPosition(uint256 coverId_)
    public
    view
    returns (RefundPosition memory pos)
  {
    pos = positions[coverId_];

    pos.premiumSpent = _getSpentPremium(coverId_);
    pos.earnedRewards += _computeRewards(pos, pos.premiumSpent);

    return pos;
  }

  /**
   * @notice
   * Returns all staking position of an account.
   * @param account_ address of the account
   * @return accountPositions all staking positions of the user
   */
  function getRefundPositionsByAccount(address account_)
    external
    view
    returns (RefundPosition[] memory accountPositions)
  {
    uint256[] memory accountCoverIds = coverManagerInterface
      .allPolicyTokensOfOwner(account_);

    // We need to compute the number of positions to create the array
    uint256 nbPositions = 0;
    for (uint256 i = 0; i < accountCoverIds.length; i++) {
      uint256 coverId = accountCoverIds[i];
      if (positions[coverId].initTimestamp != 0) nbPositions++;
    }

    accountPositions = new RefundPosition[](nbPositions);

    for (uint256 i = 0; i < accountCoverIds.length; i++) {
      uint256 coverId = accountCoverIds[i];

      if (positions[coverId].initTimestamp != 0) {
        uint256 index = accountPositions.length;
        accountPositions[index] = getRefundPosition(coverId);
      }
    }
  }

  /// ============================= ///
  /// ========== DEPOSIT ========== ///
  /// ============================= ///

  function createStakingPosition(uint256 coverId_, uint256 amount_)
    external
    onlyCore
  {
    if (amount_ == 0) revert CannotStakeZero();

    RefundPosition storage pos = positions[coverId_];
    if (pos.initTimestamp != 0) revert PositionAlreadyExists();

    uint256 lastPremiumSpent = coverManagerInterface.getCoverPremiumSpent(
      coverId_
    );

    uint256 atenPrice = priceOracleInterface.getAtenPrice();
    uint64 timestamp = uint64(block.timestamp);

    positions[coverId_] = RefundPosition({
      coverId: coverId_,
      earnedRewards: 0,
      stakedAmount: amount_,
      premiumSpent: lastPremiumSpent,
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
   * Deposit a cover holder's ATEN so they can earn staking rewards.
   * @param coverId_ is the id of the cover
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
    uint256 amount_,
    address account_
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
    returns (uint256 netRewards)
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

    netRewards = _applyPenalty(totalRewards, timeElapsed);
  }

  /// =============================== ///
  /// ========== END STAKE ========== ///
  /// =============================== ///

  function closePosition(uint256 coverId_, address account_)
    external
    onlyCore
    returns (uint256 netRewards)
  {
    RefundPosition storage pos = positions[coverId_];

    uint64 initTimestamp = pos.initTimestamp;
    // If there is no position we just skip the process without reverting
    if (initTimestamp != 0) {
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

      netRewards = _applyPenalty(totalRewards, timeElapsed);
    }
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
