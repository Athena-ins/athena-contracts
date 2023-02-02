// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IPriceOracle.sol";
import "./interfaces/IVaultERC20.sol";
import "./interfaces/IPolicyManager.sol";

import "hardhat/console.sol";

/// @notice Staking Pool Contract: Policy
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

  // A staking position of a user
  struct StakingPosition {
    uint256 policyId;
    uint256 amount;
    uint128 timestamp;
    uint128 rate;
    bool withdrawn;
  }

  // Staking account data of user
  // @bw this could all be optimized by abstracting away the user address out of this staking pool
  // we just need staking pos by policy id and a getter for all policy ids of a user (with policyTokenIds)
  struct StakeAccount {
    uint256[] policyTokenIds;
    // Maps a policy token ID to a staking position
    mapping(uint256 => StakingPosition) positions;
  }

  // Mapping of stakers addresses to their staking accounts
  mapping(address => StakeAccount) private _stakes;

  // A premium refund position of a user
  struct RefundPosition {
    uint256 earnedRewards;
    uint256 stakedAmount;
    uint256 atenPrice;
    uint64 initTimestamp;
    uint64 rewardsSinceTimestamp;
    uint64 endTimestamp;
    uint64 rate;
  }

  // Maps a user address to their cover IDs
  // @bw call policy manager instead
  mapping(address => uint256[]) public userCoverIds;

  // Maps a cover ID to its premium refund
  mapping(uint256 => RefundPosition) public positions;

  /**
   * @notice constructs Pool LP Tokens for staking, decimals defaults to 18
   * @param underlyingAsset_ is the address of ATEN token
   * @param core_ is the address of the core contract
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
  /// ========== EVENTS ========== ///
  /// ============================ ///

  /**
   * @notice
   * Triggered whenever a user stakes tokens
   */
  event Stake(
    address indexed user,
    uint256 indexed coverId,
    uint256 amountStaked
  );

  /**
   * @notice
   * Triggered whenever a user unstakes tokens
   * @dev isEarlyUnstake is true if the user unstakes before the policy is expired
   */
  event Unstake(
    address indexed user,
    uint256 indexed coverId,
    uint256 amountUnstaked,
    uint256 amountRewards,
    bool indexed isEarlyUnstake
  );

  /**
   * @notice
   * Triggered whenever the rewards rate is updated
   */
  event RefundRateUpdated(uint256 newRewardsAnnualRate);

  /**
   * @notice
   * Triggered whenever rewards are added to the staking pool
   */
  event RewardsAdded(uint256 newTotalRewards);

  /// =============================== ///
  /// ========== MODIFIERS ========== ///
  /// =============================== ///

  modifier onlyCore() {
    require(msg.sender == coreAddress, "SP: Only Core");
    _;
  }

  /// =========================== ///
  /// ========== VIEWS ========== ///
  /// =========================== ///

  /**
   * @notice
   * Returns a user's staking position for a specific policy.
   * @param account_ is the address of the user
   * @param policyId_ is the id of the policy
   * @return _ the corresponding staking position if it exists
   */
  function accountStakingPositions(address account_, uint256 policyId_)
    external
    view
    returns (StakingPosition memory)
  {
    return _stakes[account_].positions[policyId_];
  }

  /**
   * @notice
   * Returns all staking position of a user.
   * @param account_ is the address of the user
   * @return stakingPositions all staking positions if there are any
   */
  function allAccountStakingPositions(address account_)
    external
    view
    returns (StakingPosition[] memory stakingPositions)
  {
    StakeAccount storage userStakingPositions = _stakes[account_];

    stakingPositions = new StakingPosition[](
      userStakingPositions.policyTokenIds.length
    );

    for (uint256 i = 0; i < userStakingPositions.policyTokenIds.length; i++) {
      uint256 coverId = userStakingPositions.policyTokenIds[i];

      stakingPositions[i] = userStakingPositions.positions[coverId];
    }
  }

  /**
   * @notice
   * Returns the amount of rewards a user has earned for a specific staking position.
   * @dev The rewards are capped at 365 days of staking at the specified APR.
   * @param coverId_ is the id of the policy
   * @ @return _ the amount of rewards earned
   */
  function positionRefundRewards(uint256 coverId_)
    public
    view
    returns (uint256)
  {
    RefundPosition storage userPosition = positions[coverId_];
    uint64 rewardsSinceTimestamp = userPosition.rewardsSinceTimestamp;
    uint64 endTimestamp = userPosition.endTimestamp;
    uint64 amount = userPosition.amount;
    uint64 rate = userPosition.rate;

    uint256 timeElapsed;
    // We want to cap the rewards to the covers expiration
    uint256 upTo = endTimestamp != 0 ? endTimestamp : block.timestamp;
    require(rewardsSinceTimestamp < upTo, "SP: timestamp is in the future");
    unchecked {
      // Unckecked because we checked that upTo is bigger
      timeElapsed = upTo - rewardsSinceTimestamp;
    }

    // Return proportional rewards
    uint256 yearlyReward = (amount * rate) / 10_000;
    uint256 yearPercentage = (timeElapsed * 1e18) / 1 years;
    return (yearPercentage * yearlyReward) / 1e18;
    }

  /// ============================= ///
  /// ========== HELPERS ========== ///
  /// ============================= ///

  function _reflectEarnedRewards(uint256 amount_) private {
    uint256 rewardsLeft = atensVaultInterface.coverRefundRewardsTotal();
    require(unpaidRewards + amount_ <= rewardsLeft, "SP: Not enough rewards");

    unpaidRewards += amount_;
  }

  function _reflectPaidRewards(uint256 amount_) private {
    require(amount_ <= unpaidRewards, "SP: Not enough unpaid rewards");
    unchecked {
      // Uncheck since unpaidRewards can only be bigger than amount_
      unpaidRewards -= amount_;
    }
  }

  /// ============================= ///
  /// ========== DEPOSIT ========== ///
  /// ============================= ///

  function _createPosition(uint256 coverId_, uint256 amount_) private {
    uint256 atenPrice = priceOracleInterface.getAtenPrice();
    uint64 timestamp = block.timestamp;

    positions[coverId_] = RefundPosition({
      earnedRewards: 0,
      stakedAmount: amount_,
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
  function stake(uint256 coverId_, uint256 amount_) external onlyCore {
    require(amount_ > 0, "SP: cannot stake 0 ATEN");

    RefundPosition storage userPosition = positions[coverId_];

    if (userPosition.initTimestamp == 0) {
      _createPosition(coverId_, amount_);
    } else {
      // We don't want users to stake after the cover is expired
      require(userPosition.endTimestamp == 0, "SP: cover is expired");

      uint256 atenPrice = priceOracleInterface.getAtenPrice();
      uint64 timestamp = block.timestamp;

      uint256 earnedRewards = positionRefundRewards(coverId_);
      _reflectEarnedRewards(earnedRewards);

      // Reset the staking & update ATEN oracle price and refund rate
      userPosition.rewardsSinceTimestamp = timestamp;
      userPosition.atenPrice = atenPrice;
      userPosition.rate = refundRate;

      userPosition.earnedRewards += earnedRewards;
      userPosition.stakedAmount += amount_;

      emit UpdateStake(coverId_, amount_);
    }
  }

  /// ============================== ///
  /// ========== WITHDRAW ========== ///
  /// ============================== ///

  /**
   * @notice
   * Used when a user closes his policy before a year has elapsed.
   * @param account_ address of the user
   * @param policyId_ id of the policy
   */
  function earlyWithdraw(address account_, uint256 policyId_)
    external
    onlyCore
  {
    StakingPosition storage pos = _stakes[account_].positions[policyId_];

    require(!pos.withdrawn, "SP: already withdrawn");
    // Close staking position by setting withdrawn to true
    pos.withdrawn = true;

    // Get the amount of ATEN initially deposited for staking
    uint256 initialAmount = pos.amount;

    // Calc the amount of rewards the position had reserved
    uint256 maxReward = (pos.amount * pos.rate) / 10_000;
    // Add back the allocated rewards to the rewards pool
    rewardsRemaining += maxReward;

    // Send initial staked tokens to user
    IERC20(underlyingAssetAddress).safeTransfer(account_, initialAmount);

    emit Unstake(account_, policyId_, initialAmount, 0, true);
  }

  /**
   * @notice
   * Used when a user claims his staking rewards after a year has elapsed.
   * @param account_ address of the user
   * @param policyId_ id of the policy
   * @return _ the amount of rewards to send to user
   */
  function withdraw(address account_, uint256 policyId_)
    external
    onlyCore
    returns (uint256)
  {
    StakingPosition storage pos = _stakes[account_].positions[policyId_];

    require(!pos.withdrawn, "SP: already withdrawn");
    // Close staking position by setting withdrawn to true
    pos.withdrawn = true;

    // Check that a year has elapsed since staking position creation
    require(
      365 days <= block.timestamp - pos.timestamp,
      "SP: year has not elapsed"
    );

    // Get the amount of ATEN initially deposited for staking
    uint256 initialAmount = pos.amount;

    // Send initial staked tokens to user
    IERC20(underlyingAssetAddress).safeTransfer(account_, pos.amount);

    // Max reward is 365 days of rewards at specified APR
    uint256 maxReward = (pos.amount * pos.rate) / 10_000;

    emit Unstake(account_, policyId_, initialAmount, maxReward, false);

    // Return 365 days of rewards at specified APR
    return maxReward;
  }

  /// =========================== ///
  /// ========== ADMIN ========== ///
  /// =========================== ///

  function setShortCoverDuration(uint256 shortCoverDuration_)
    external
    onlyOwner
  {
    require(0 < shortCoverDuration_, "SP: duration of zero");
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
    require(
      basePenaltyRate_ + durationPenaltyRate_ < 10_000,
      "SP: penalty rate too high"
    );

    refundRate = refundRate_;
    basePenaltyRate = basePenaltyRate_;
    durationPenaltyRate = durationPenaltyRate_;

    emit RatesUpdated(refundRate_, basePenaltyRate_, durationPenaltyRate_);
  }
}
