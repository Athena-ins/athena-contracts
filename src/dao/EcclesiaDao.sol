// SPDX-License-Identifier: MIT
// solhint-disable not-rely-on-time
pragma solidity 0.8.20;

// Contracts
import { ERC20 } from "../tokens/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// Libraries
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// Interfaces
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IStaking } from "../interfaces/IStaking.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

// ======= ERRORS ======= //

error ZeroAddress();
error NotPoolManager();
error NotFeeCollector();
error BadAmount();
error ConversionToVotesYieldsZero();
error LockAlreadyExists();
error LockDoesNotExist();
error LockExpired();
error LockPeriodNotOver();
error CanOnlyExtendLock();
error CanOnlyLockInFuture();
error LockLongerThanMax();
error NotEnoughVotes();
error FeePerDayTooHigh();
error InvalidBps();
error InvalidTreasuryAddr();
error UnnecessaryEarlyWithdraw();
error TransfersNotAllowed();

/**
 * @title EcclesiaDao
 * @notice Ecclesia is Athena's DAO allows participation in the Athena governance
 * Participants accrue protocol revenue rewards as well as ATEN staking rewards if their lock meets the minimum duration
 */
contract EcclesiaDao is
  IEcclesiaDao,
  ERC20,
  ReentrancyGuard,
  Ownable
{
  using SafeERC20 for IERC20;

  // ======= EVENTS ======= //

  event SetBreaker(bool newBreaker);
  event SetEarlyWithdrawConfig(
    uint256 newEarlyWithdrawBpsPerDay,
    uint256 newRedistributeBps,
    uint256 newBurnBps,
    uint256 newTreasuryBps,
    address newTreasuryAddr
  );
  event Withdraw(address indexed user, uint256 amount);
  event EarlyWithdraw(
    address indexed user,
    uint256 amount,
    uint256 timestamp
  );

  // ======= CONSTANTS ======= //

  // Maxiumum duration to lock ATEN
  uint256 public constant MAX_LOCK = 365 days * 3;
  // Duration at which point 1 ATEN = 1 vote
  uint256 public constant EQUILIBRIUM_LOCK = 365 days;
  // Weight multiplier for tokens locked longer than equilibrium added to base x1 weight
  uint256 public constant ADD_WEIGHT = 3;
  // Minimum duration to stake while participating in governance
  uint256 public constant MIN_TO_STAKE = MAX_LOCK / 2;

  uint256 public constant RAY = 1e27;

  // ======= GLOBAL STATE ======= //

  // Switch to allow early withdrawal in case of migration
  bool public breaker;

  // Address of treasury
  address public treasuryWallet;
  // Address of leverage risk wallet
  address public leverageRiskWallet;
  // Staking contract
  IStaking public staking;
  // Token to be locked (ATEN)
  IERC20 public atenToken;
  // Address of the revenue unifier
  address public liquidityManager;
  // Address of the strategy manager
  address public strategyManager;

  // Total supply of ATEN that get locked
  uint256 public supply;
  // Total supply of ATEN that get staked
  uint256 public supplyStaking;

  // Index for redistributed ATEN
  uint256 public redistributeIndex;
  // Index for staking rewards
  uint256 public stakingIndex;
  // Maps token address to ray index for accumulated revenue
  mapping(address _token => uint256 _index) public revenueIndex;
  // Revenue tokens
  address[] public revenueTokens;

  struct LockedBalance {
    uint256 amount; // amount of ATEN locked
    uint256 staking;
    uint256 userRedisIndex; // stored as ray (1e27)
    uint256 userStakingIndex; // stored as ray (1e27)
    uint256 duration;
    uint256 end;
  }

  // Maps user to DAO account information
  mapping(address _user => LockedBalance) public locks;
  // Maps user address to token address to ray index for claimed revenue
  mapping(address _user => mapping(address _token => uint256 _index))
    public userRevenueIndex;

  // Amount of early withdrawal fees per day of remaining lock duration
  uint256 public earlyWithdrawBpsPerDay;

  // Portion of early withdrawal fees to be redistributed to remaining lockers
  uint256 public redistributeBps;
  // Portion of early withdrawal fees to be burned
  uint256 public burnBps;
  // Portion of early withdrawal fees to be sent to treasury
  uint256 public treasuryBps;

  // ======= CONSTRUCTOR ======= //

  constructor(
    IERC20 atenToken_,
    IStaking staking_,
    address liquidityManager_,
    address strategyManager_,
    address treasuryWallet_,
    address leverageRiskWallet_
  ) ERC20("Athenian Vote", "vATEN") Ownable(msg.sender) {
    if (
      address(atenToken_) == address(0) ||
      address(staking_) == address(0) ||
      address(liquidityManager_) == address(0)
    ) revert ZeroAddress();

    atenToken = atenToken_;
    staking = staking_;
    liquidityManager = liquidityManager_;
    strategyManager = strategyManager_;

    treasuryWallet = treasuryWallet_;
    leverageRiskWallet = leverageRiskWallet_;
  }

  // ======= MODIFIERS ======= //

  modifier onlyRevenueCollector() {
    if (
      msg.sender != liquidityManager && msg.sender != strategyManager
    ) revert NotFeeCollector();
    _;
  }

  // ======= VIEWS ======= //

  /**
   * @notice Convert ATEN to votes depending on lock duration
   * @param amount_ the amount of ATEN to convert
   * @param lockDuration_ the duration of the lock
   * @return votes the amount of votes
   */
  function tokenToVotes(
    uint256 amount_,
    uint256 lockDuration_
  ) public pure returns (uint256 votes) {
    // For lock duration smaller than EQUILIBRIUM_LOCK, the bias is negative 1 ATEN < 1 vote
    // For lock duration equal to EQUILIBRIUM_LOCK, the bias is neutral 1 ATEN = 1 vote
    // For lock duration larger than EQUILIBRIUM_LOCK, the bias is positive 1 ATEN > 1 vote
    uint256 bias = EQUILIBRIUM_LOCK < lockDuration_
      ? RAY +
        (ADD_WEIGHT * ((lockDuration_ - EQUILIBRIUM_LOCK) * RAY)) /
        (MAX_LOCK - EQUILIBRIUM_LOCK)
      : (lockDuration_ * RAY) / EQUILIBRIUM_LOCK;

    votes = (amount_ * bias) / RAY;
  }

  /**
   * @notice Convert votes to ATEN depending on lock duration
   * @param votes_ the amount of votes to convert
   * @param lockDuration_ the duration of the lock
   * @return tokens the amount of ATEN
   */
  function votesToTokens(
    uint256 votes_,
    uint256 lockDuration_
  ) public pure returns (uint256 tokens) {
    uint256 bias = EQUILIBRIUM_LOCK < lockDuration_
      ? RAY +
        (ADD_WEIGHT * ((lockDuration_ - EQUILIBRIUM_LOCK) * RAY)) /
        (MAX_LOCK - EQUILIBRIUM_LOCK)
      : (lockDuration_ * RAY) / EQUILIBRIUM_LOCK;

    tokens = (votes_ * RAY) / bias;
  }

  // ======= OVERRIDES ======= //

  /**
   * @notice Override vATEN internal _transfer to disallow transfers
   */
  function _transfer(
    address /* from */,
    address /* to */,
    uint256 /* value */
  ) internal pure override returns (bool) {
    revert TransfersNotAllowed();
  }

  // ======= DEPOSIT ======= //

  function _revenueSnapshot() private {
    uint256 nbTokens = revenueTokens.length;
    for (uint i; i < nbTokens; i++) {
      address _token = revenueTokens[i];
      userRevenueIndex[msg.sender][_token] = revenueIndex[_token];
    }
  }

  function _deposit(uint256 amount_, uint256 unlockTime_) internal {
    LockedBalance storage userLock = locks[msg.sender];

    if (userLock.amount == 0) {
      userLock.userRedisIndex = redistributeIndex;
      _revenueSnapshot();
    }

    if (unlockTime_ != 0) {
      // When updated we compute the added time to keep track of total duration
      uint256 durationAdded = userLock.end == 0
        ? unlockTime_ - block.timestamp
        : unlockTime_ - userLock.end;

      userLock.duration = durationAdded;
      // Cap duration since the addition can be pushed above max lock
      if (MAX_LOCK < userLock.duration) userLock.duration = MAX_LOCK;
      userLock.end = unlockTime_;
    }

    if (amount_ != 0) {
      atenToken.safeTransferFrom(msg.sender, address(this), amount_);
      userLock.amount += amount_;
      supply += amount_;
    }

    uint256 toStake = userLock.amount - userLock.staking;
    if (0 < toStake && MIN_TO_STAKE < userLock.duration) {
      // We want to track the amount of staking rewards we harvest
      uint256 balBefore = atenToken.balanceOf(address(this));

      atenToken.safeIncreaseAllowance(address(staking), toStake);
      // This will cause a harvest of rewards
      staking.depositDao(msg.sender, toStake);

      // Reincorporate amount sent to staking for net rewards
      uint256 stakingRewards = (atenToken.balanceOf(address(this)) +
        toStake) - balBefore;
      _accrueStaking(stakingRewards);

      // Only usefull when position is created
      // Ok for amount increase since we harvest before
      userLock.userStakingIndex = stakingIndex;

      userLock.staking += toStake;
      supplyStaking += toStake;
    }
  }

  /**
   * @notice Create a new lock.
   * @dev This will crate a new lock and deposit ATEN to vATEN Vault
   * @param amount_ the amount that user wishes to deposit
   * @param unlockTime_ the timestamp when ATEN get unlocked, it will be
   * floored down to whole weeks
   */
  function createLock(
    uint256 amount_,
    uint256 unlockTime_
  ) external nonReentrant {
    LockedBalance storage lock = locks[msg.sender];

    if (amount_ == 0) revert BadAmount();
    if (lock.amount != 0) revert LockAlreadyExists();
    if (unlockTime_ <= block.timestamp) revert CanOnlyLockInFuture();
    if (block.timestamp + MAX_LOCK < unlockTime_)
      revert LockLongerThanMax();

    _deposit(amount_, unlockTime_);

    uint256 votes = tokenToVotes(amount_, lock.duration);
    if (votes == 0) revert ConversionToVotesYieldsZero();

    _mint(msg.sender, votes);
  }

  // ======= UPDATE ======= //

  /**
   * @notice Increase lock amount without changing unlock time.
   * @param amount_ the amount that user wishes to deposit
   */
  function increaseLockAmount(uint256 amount_) external nonReentrant {
    LockedBalance storage _lock = locks[msg.sender];

    if (amount_ == 0) revert BadAmount();
    if (_lock.amount == 0) revert LockDoesNotExist();
    if (_lock.end <= block.timestamp) revert LockExpired();

    // Harvest to update reward indexes before adding more tokens
    harvest(new address[](0));
    _deposit(amount_, 0);

    uint256 votes = tokenToVotes(amount_, _lock.duration);
    _mint(msg.sender, votes);
  }

  /**
   * @notice Increase lock duration without changing lock amount.
   * @param newUnlockTime_ the new unlock time to be updated
   */
  function increaseUnlockTime(
    uint256 newUnlockTime_
  ) external nonReentrant {
    LockedBalance storage _lock = locks[msg.sender];

    if (_lock.amount == 0) revert LockDoesNotExist();
    if (_lock.end <= block.timestamp) revert LockExpired();
    if (newUnlockTime_ <= _lock.end) revert CanOnlyExtendLock();
    if (block.timestamp + MAX_LOCK < newUnlockTime_)
      revert LockLongerThanMax();

    // Save previous balance to compute amount of new votes to mint
    uint256 previousVotes = tokenToVotes(
      _lock.amount,
      _lock.duration
    );

    _deposit(0, newUnlockTime_);

    uint256 votes = tokenToVotes(_lock.amount, _lock.duration) -
      previousVotes;
    _mint(msg.sender, votes);
  }

  // ======= WITHDRAW ======= //

  function _unlock(
    LockedBalance memory lock_,
    uint256 withdrawAmount_
  ) internal {
    LockedBalance storage userLock = locks[msg.sender];

    if (lock_.amount < withdrawAmount_) revert BadAmount();

    //lock_.end should remain the same only if we do partially withdraw
    if (lock_.amount == withdrawAmount_) {
      lock_.duration = 0;
      lock_.end = 0;
    }
    lock_.amount -= withdrawAmount_;

    // Tokens are either 100% staked or 100% not staked
    if (userLock.staking != 0) {
      // We want to track the amount of staking rewards we harvest
      uint256 balBefore = atenToken.balanceOf(address(this));

      // This will cause a harvest of rewards
      staking.withdrawTokenDao(
        msg.sender,
        address(this),
        withdrawAmount_
      );

      // Remove amount received from staking for net rewards
      uint256 stakingRewards = (atenToken.balanceOf(address(this)) -
        withdrawAmount_) - balBefore;
      _accrueStaking(stakingRewards);

      userLock.staking -= withdrawAmount_;
      supplyStaking -= withdrawAmount_;
    }

    supply -= withdrawAmount_;
  }

  /**
   * @notice Withdraw ATEN after lock period is over.
   */
  function withdraw() external nonReentrant {
    // This copy of the lock will be used for harvesting
    LockedBalance memory _lock = locks[msg.sender];

    if (breaker == false)
      if (block.timestamp < _lock.end) revert LockPeriodNotOver();

    // Burn the user's corresponding votes
    uint256 votes = tokenToVotes(_lock.amount, _lock.duration);
    uint256 userVotes = ERC20.balanceOf[msg.sender];
    if (userVotes < votes) revert NotEnoughVotes();
    _burn(msg.sender, votes);

    uint256 _amount = _lock.amount;
    _unlock(_lock, _amount);
    atenToken.safeTransfer(msg.sender, _amount);

    // Harvest after unlock for staking reward index update
    harvest(revenueTokens);

    emit Withdraw(msg.sender, _amount);
  }

  /**
   * @notice Withdraw ATEN with penalty before lock period is over.
   * @param amount_ the amount of ATEN to withdraw
   */
  function earlyWithdraw(uint256 amount_) external nonReentrant {
    LockedBalance memory _lock = locks[msg.sender];

    if (_lock.amount == 0) revert LockDoesNotExist();
    if (_lock.end <= block.timestamp) revert LockExpired();
    if (_lock.amount < amount_) revert BadAmount();
    if (breaker == true) revert UnnecessaryEarlyWithdraw();

    // Burn the user's corresponding votes
    uint256 votes = tokenToVotes(_lock.amount, _lock.duration);
    uint256 userVotes = ERC20.balanceOf[msg.sender];
    if (userVotes < votes) revert NotEnoughVotes();
    _burn(msg.sender, votes);

    // prevent mutated memory in _unlock() function as it will be used in fee calculation afterward
    uint256 _prevLockEnd = _lock.end;
    _unlock(_lock, amount_);

    // ceil the day by adding 1 day first
    uint256 remainingDays = (_prevLockEnd +
      1 days -
      block.timestamp) / 1 days;
    // calculate penalty
    uint256 _penalty = (earlyWithdrawBpsPerDay *
      remainingDays *
      amount_) / RAY;

    // Harvest after unlock for staking reward index update
    harvest(revenueTokens);

    // Redistribute fee
    uint256 _amountRedistribute = (_penalty * redistributeBps) / RAY;
    _redistribute(_amountRedistribute);
    // Burn fee
    uint256 _amountBurn = (_penalty * burnBps) / RAY;
    _burn(address(this), _amountBurn);
    // Treasury fee
    uint256 _amountTreasury = (_penalty - _amountRedistribute) -
      _amountBurn;
    atenToken.safeTransfer(treasuryWallet, _amountTreasury);

    // transfer remaining back to owner
    atenToken.safeTransfer(msg.sender, amount_ - _penalty);
    emit EarlyWithdraw(msg.sender, amount_, block.timestamp);
  }

  // ======= REWARDS ======= //

  /**
   * @notice Manually sync staking rewards index
   */
  function syncStaking() external nonReentrant {
    // We want to track the amount of staking rewards we harvest
    uint256 balBefore = atenToken.balanceOf(address(this));

    // Harvest rewards
    staking.harvestFarming();

    uint256 stakingRewards = atenToken.balanceOf(address(this)) -
      balBefore;
    _accrueStaking(stakingRewards);
  }

  function _accrueStaking(uint256 amount_) private nonReentrant {
    // Rewards are distributed per staked token
    uint256 amountPerVoteRay = (amount_ * RAY) / supplyStaking;
    stakingIndex += amountPerVoteRay;
  }

  function _redistribute(uint256 amount_) private nonReentrant {
    // Rewards are distributed per vote
    uint256 amountPerVoteRay = (amount_ * RAY) / ERC20.totalSupply;
    redistributeIndex += amountPerVoteRay;
  }

  /**
   * @notice Accrue revenue for DAO participants
   * @param token_ the token to accrue revenue
   * @param amount_ the amount of token to accrue
   * @param leverageFee_ the amount of leverage fee
   */
  function accrueRevenue(
    address token_,
    uint256 amount_,
    uint256 leverageFee_
  ) external nonReentrant onlyRevenueCollector {
    // Send risk provision to leverage risk wallet
    if (leverageFee_ != 0)
      IERC20(token_).safeTransfer(leverageRiskWallet, leverageFee_);

    // Rewards are distributed per vote
    uint256 amountPerVoteRay = (amount_ * RAY) / ERC20.totalSupply;
    if (revenueIndex[token_] == 0) revenueTokens.push(token_);
    revenueIndex[token_] += amountPerVoteRay;
  }

  /**
   * @notice Harvest rewards from staking & DAO revenue
   * @param tokens_ the tokens to harvest
   */
  function harvest(address[] memory tokens_) public nonReentrant {
    LockedBalance storage userLock = locks[msg.sender];
    uint256 votes = tokenToVotes(userLock.amount, userLock.duration);

    uint256 tokenRewardsRay;

    if (userLock.userStakingIndex != stakingIndex) {
      // Harvest staking rewards
      uint256 stakingRewards = (stakingIndex -
        userLock.userStakingIndex) * userLock.staking;

      tokenRewardsRay += stakingRewards;
    }
    if (userLock.userRedisIndex != redistributeIndex) {
      // Harvest redistributed rewards
      uint256 redistributeRewards = (redistributeIndex -
        userLock.userRedisIndex) * votes;

      tokenRewardsRay += redistributeRewards;
    }

    uint256 tokenRewards = tokenRewardsRay / RAY;
    if (tokenRewards != 0) {
      atenToken.safeTransfer(msg.sender, tokenRewards);

      // Update indexes to reflect withdrawn rewards
      userLock.userStakingIndex = stakingIndex;
      // Update indexes to reflect withdrawn rewards
      userLock.userRedisIndex = redistributeIndex;
    }

    // Withdraw revenue rewards
    uint256 nbTokens = tokens_.length;

    for (uint i; i < nbTokens; i++) {
      address _token = tokens_[i];
      // Harvest all specified tokens
      if (
        userRevenueIndex[msg.sender][_token] != revenueIndex[_token]
      ) {
        uint256 revenue = ((revenueIndex[_token] -
          userRevenueIndex[msg.sender][_token]) * votes) / RAY;

        if (revenue != 0) {
          IERC20(_token).safeTransfer(msg.sender, revenue);

          // Update indexes to reflect withdrawn rewards
          userRevenueIndex[msg.sender][_token] = revenueIndex[_token];
        }
      }
    }
  }

  // ======= ADMIN ======= //

  /**
   * @notice Set early withdraw configuration in case of migration
   * @param newEarlyWithdrawBpsPerDay_ the new early withdraw fee per day
   * @param newRedistributeBps_ the new portion of early withdrawal fees to be redistributed
   * @param newBurnBps_ the new portion of early withdrawal fees to be burned
   * @param newTreasuryBps_ the new portion of early withdrawal fees to be sent to treasury
   * @param newTreasuryAddr_ the new treasury address
   */
  function setEarlyWithdrawConfig(
    uint256 newEarlyWithdrawBpsPerDay_,
    uint256 newRedistributeBps_,
    uint256 newBurnBps_,
    uint256 newTreasuryBps_,
    address newTreasuryAddr_
  ) external onlyOwner {
    // Maximum early withdraw fee per day bps is 100% / max lock duration in day
    uint256 maxFeePerDay = RAY / (MAX_LOCK / 1 days);
    if (maxFeePerDay < newEarlyWithdrawBpsPerDay_)
      revert FeePerDayTooHigh();

    // Sum of fee distribution must equal RAY (100%)
    if (RAY != newRedistributeBps_ + newBurnBps_ + newTreasuryBps_)
      revert InvalidBps();

    earlyWithdrawBpsPerDay = newEarlyWithdrawBpsPerDay_;
    redistributeBps = newRedistributeBps_;
    burnBps = newBurnBps_;
    treasuryBps = newTreasuryBps_;
    treasuryWallet = newTreasuryAddr_;

    if (treasuryBps != 0 && treasuryWallet == address(0))
      revert InvalidTreasuryAddr();

    emit SetEarlyWithdrawConfig(
      earlyWithdrawBpsPerDay,
      redistributeBps,
      burnBps,
      treasuryBps,
      treasuryWallet
    );
  }

  /**
   * @notice Set breaker to allow or disallow early withdrawal
   * @param breaker_ the new value of breaker false if off, true if on
   */
  function setBreaker(bool breaker_) external onlyOwner {
    breaker = breaker_;
    emit SetBreaker(breaker);
  }

  /**
   * @notice Withdraw ETH from the contract
   */
  function withdrawETH() external onlyOwner {
    payable(msg.sender).transfer(address(this).balance);
  }
}
