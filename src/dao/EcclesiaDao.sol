// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// contracts
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// libraries
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// interfaces
import { IStaking } from "../rewards/interfaces/IStaking.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

// solhint-disable not-rely-on-time

// ======= ERRORS ======= //

error BadAmount();
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

/**
 * @title AthenaDAO
 * @notice Athena DAO allows participation in the Athena governance, protocol fee rewards and AOE staking
 * @custom:from Contract inspired by the Alpaca Finance xAlpaca contract
 * @custom:url https://github.com/alpaca-finance/xALPACA-contract/blob/main/contracts/8.10/xALPACA.sol
 */
contract EcclesiaDao is ERC20, ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;

  // ======= EVENTS ======= //

  event SetBreaker(bool _newBreaker);
  event SetEarlyWithdrawConfig(
    uint256 _newEarlyWithdrawBpsPerDay,
    uint256 _newRedistributeBps,
    uint256 _newBurnBps,
    uint256 _newTreasuryBps,
    address _newTreasuryAddr
  );
  event Withdraw(address indexed _user, uint256 _amount);
  event EarlyWithdraw(
    address indexed _user,
    uint256 _amount,
    uint256 _timestamp
  );

  // ======= CONSTANTS ======= //

  // Maxiumum duration to lock AOE
  uint256 public constant MAX_LOCK = 365 days * 3;
  // Duration at which point 1 AOE = 1 vote
  uint256 public constant EQUILIBRIUM_LOCK = 365 days;
  // Weight multiplier for tokens locked longer than equilibrium added to base x1 weight
  uint256 public constant ADD_WEIGHT = 2;
  // Minimum duration to stake while participating in governance
  uint256 public constant MIN_TO_STAKE = MAX_LOCK / 2;

  uint256 public constant RAY = 1e27;

  // ======= GLOBAL STATE ======= //

  // Switch to allow early withdrawal in case of migration
  bool public breaker;

  // Staking contract
  IStaking public staking;
  // Token to be locked (AOE)
  IERC20 public token;
  // Total supply of AOE that get locked
  uint256 public supply;
  // Total supply of AOE that get staked
  uint256 public supplyStaking;

  // Index for redistributed AOE
  uint256 public redistributeIndex;
  // Index for staking rewards
  uint256 public stakingIndex;
  // Index for accumulated fees
  uint256 public feeIndex;

  struct LockedBalance {
    uint256 amount; // amount of AOE locked
    uint256 staking;
    uint256 userRedisIndex;
    uint256 userStakingIndex;
    uint256 userFeeIndex;
    uint256 duration;
    uint256 end;
  }

  // Mapping (user => LockedBalance) to keep locking information for each user
  mapping(address => LockedBalance) public locks;

  // Amount of early withdrawal fees per day of remaining lock duration
  uint256 public earlyWithdrawBpsPerDay;

  // Portion of early withdrawal fees to be redistributed to remaining lockers
  uint256 public redistributeBps;
  // Portion of early withdrawal fees to be burned
  uint256 public burnBps;
  // Portion of early withdrawal fees to be sent to treasury
  uint256 public treasuryBps;

  // Address of treasury
  address public treasuryAddr;

  // ======= CONSTRUCTOR ======= //

  constructor(
    IERC20 _token,
    IStaking _staking
  ) ERC20("Athenian Vote", "vAOE") Ownable(msg.sender) {}

  // ======= VIEWS ======= //

  function tokenToVotes(
    uint256 _amount,
    uint256 _lockDuration
  ) public view returns (uint256 votes) {
    // For lock duration smaller than EQUILIBRIUM_LOCK, the bias is negative 1 AOE < 1 vote
    // For lock duration equal to EQUILIBRIUM_LOCK, the bias is neutral 1 AOE = 1 vote
    // For lock duration larger than EQUILIBRIUM_LOCK, the bias is positive 1 AOE > 1 vote
    uint256 bias = EQUILIBRIUM_LOCK <= _lockDuration
      ? 1 +
        ADD_WEIGHT *
        (((_lockDuration - EQUILIBRIUM_LOCK) * RAY) /
          (MAX_LOCK - EQUILIBRIUM_LOCK))
      : (_lockDuration * RAY) / EQUILIBRIUM_LOCK;

    votes = (_amount * bias) / RAY;
  }

  function votesToTokens(
    uint256 _votes,
    uint256 _lockDuration
  ) public view returns (uint256 tokens) {
    uint256 bias = EQUILIBRIUM_LOCK <= _lockDuration
      ? 1 +
        ADD_WEIGHT *
        (((_lockDuration - EQUILIBRIUM_LOCK) * RAY) /
          (MAX_LOCK - EQUILIBRIUM_LOCK))
      : (_lockDuration * RAY) / EQUILIBRIUM_LOCK;

    tokens = (_votes * RAY) / bias;
  }

  // ======= DEPOSIT ======= //

  function _deposit(
    LockedBalance memory _lock,
    uint256 _amount,
    uint256 _unlockTime
  ) internal {
    LockedBalance storage userLock = _lock;

    if (userLock.amount == 0) {
      userLock.userRedisIndex = redistributeIndex;
      userLock.userFeeIndex = feeIndex;
    }

    if (_unlockTime != 0) {
      // When updated we compute the added time to keep track of total duration
      uint256 durationAdded = userLock.end == 0
        ? _unlockTime - block.timestamp
        : _unlockTime - userLock.end;

      userLock.duration = durationAdded;
      // Cap duration since the addition can be pushed above max lock
      if (MAX_LOCK < userLock.duration) userLock.duration = MAX_LOCK;
      userLock.end = _unlockTime;
    }

    if (_amount != 0) {
      token.safeTransferFrom(msg.sender, address(this), _amount);
      userLock.amount += _amount;
      supply += _amount;
    }

    if (MIN_TO_STAKE < userLock.duration) {
      // We want to track the amount of staking rewards we harvest
      uint256 balBefore = token.balanceOf(address(this));

      uint256 toStake = userLock.amount - userLock.staking;
      token.safeIncreaseAllowance(address(staking), toStake);
      // This will cause a harvest of rewards
      staking.deposit(toStake);

      // Reincorporate amount sent to staking for net rewards
      uint256 stakingRewards = (token.balanceOf(address(this)) +
        toStake) - balBefore;
      _accrueStaking(stakingRewards);

      // Only usefull when position is created
      userLock.userStakingIndex = stakingIndex;

      userLock.staking += toStake;
      supplyStaking += toStake;
    }
  }

  /// @notice Create a new lock.
  /// @dev This will crate a new lock and deposit AOE to vAOE Vault
  /// @param _amount the amount that user wishes to deposit
  /// @param _unlockTime the timestamp when AOE get unlocked, it will be
  /// floored down to whole weeks
  function createLock(
    uint256 _amount,
    uint256 _unlockTime
  ) external nonReentrant {
    LockedBalance memory lock = locks[msg.sender];

    if (_amount == 0) revert BadAmount();
    if (lock.amount != 0) revert LockAlreadyExists();
    if (_unlockTime <= block.timestamp) revert CanOnlyLockInFuture();
    if (block.timestamp + MAX_LOCK < _unlockTime)
      revert LockLongerThanMax();

    _deposit(lock, _amount, _unlockTime);

    uint256 votes = tokenToVotes(_amount, lock.duration);
    _mint(msg.sender, votes);
  }

  // ======= UPDATE ======= //

  /// @notice Increase lock amount without increase "end"
  /// @param _amount The amount of ALPACA to be added to the lock
  function increaseLockAmount(uint256 _amount) external nonReentrant {
    LockedBalance memory _lock = locks[msg.sender];

    if (_amount == 0) revert BadAmount();
    if (_lock.amount == 0) revert LockDoesNotExist();
    if (_lock.end <= block.timestamp) revert LockExpired();

    // Need to harvest to update all reward indexes before adding more tokens
    harvest(_lock);
    _deposit(_lock, _amount, 0);

    uint256 votes = tokenToVotes(_amount, _lock.duration);
    _mint(msg.sender, votes);
  }

  /// @notice Increase unlock time without changing locked amount
  /// @param _newUnlockTime The new unlock time to be updated
  function increaseUnlockTime(
    uint256 _newUnlockTime
  ) external nonReentrant {
    LockedBalance memory _lock = locks[msg.sender];

    if (_lock.amount == 0) revert LockDoesNotExist();
    if (_lock.end <= block.timestamp) revert LockExpired();
    if (_newUnlockTime <= _lock.end) revert CanOnlyExtendLock();
    if (block.timestamp + MAX_LOCK < _newUnlockTime)
      revert LockLongerThanMax();

    // Save previous balance to compute amount of new votes to mint
    uint256 previousVotes = tokenToVotes(
      _lock.amount,
      _lock.duration
    );

    _deposit(_lock, 0, _newUnlockTime);

    uint256 votes = tokenToVotes(_lock.amount, _lock.duration) -
      previousVotes;
    _mint(msg.sender, votes);
  }

  // ======= WITHDRAW ======= //

  /// @notice Set breaker
  /// @param _breaker The new value of breaker false if off, true if on
  function setBreaker(bool _breaker) external onlyOwner {
    breaker = _breaker;
    emit SetBreaker(breaker);
  }

  function _unlock(
    LockedBalance memory _lock,
    uint256 _withdrawAmount
  ) internal {
    LockedBalance storage userLock = _lock;

    if (_lock.amount < _withdrawAmount) revert BadAmount();

    //_lock.end should remain the same if we do partially withdraw
    if (_lock.amount == _withdrawAmount) {
      _lock.duration = 0;
      _lock.end = 0;
    }
    _lock.amount -= _withdrawAmount;

    // Tokens are either 100% staked or 100% not staked
    if (userLock.staking != 0) {
      // We want to track the amount of staking rewards we harvest
      uint256 balBefore = token.balanceOf(address(this));

      // @bw this will cause a harvest of rewards
      staking.withdrawToken(address(this), _withdrawAmount);

      // Remove amount received from staking for net rewards
      uint256 stakingRewards = (token.balanceOf(address(this)) -
        _withdrawAmount) - balBefore;
      _accrueStaking(stakingRewards);

      userLock.staking -= _withdrawAmount;
      supplyStaking -= _withdrawAmount;
    }

    supply -= _withdrawAmount;
  }

  /// @notice Withdraw all ALPACA when lock has expired.
  function withdraw() external nonReentrant {
    // This copy of the lock will be used for harvesting
    LockedBalance memory _lock = locks[msg.sender];

    if (breaker == false)
      if (block.timestamp < _lock.end) revert LockPeriodNotOver();

    // Burn the user's corresponding votes
    uint256 votes = tokenToVotes(_lock.amount, _lock.duration);
    uint256 userVotes = balanceOf(msg.sender);
    if (userVotes < votes) revert NotEnoughVotes();
    _burn(msg.sender, votes);

    uint256 _amount = _lock.amount;
    _unlock(_lock, _amount);
    token.safeTransfer(msg.sender, _amount);

    // Harvest after unlock for staking reward index update
    harvest(_lock);

    emit Withdraw(msg.sender, _amount);
  }

  /// @notice Early withdraw ALPACA with penalty.
  function earlyWithdraw(uint256 _amount) external nonReentrant {
    LockedBalance memory _lock = locks[msg.sender];

    if (_lock.amount == 0) revert LockDoesNotExist();
    if (_lock.end <= block.timestamp) revert LockExpired();
    if (_lock.amount < _amount) revert BadAmount();
    if (breaker == true) revert UnnecessaryEarlyWithdraw();

    // Burn the user's corresponding votes
    uint256 votes = tokenToVotes(_lock.amount, _lock.duration);
    uint256 userVotes = balanceOf(msg.sender);
    if (userVotes < votes) revert NotEnoughVotes();
    _burn(msg.sender, votes);

    // prevent mutated memory in _unlock() function as it will be used in fee calculation afterward
    uint256 _prevLockEnd = _lock.end;
    _unlock(_lock, _amount);

    // ceil the day by adding 1 day first
    uint256 remainingDays = (_prevLockEnd +
      1 days -
      block.timestamp) / 1 days;
    // calculate penalty
    uint256 _penalty = (earlyWithdrawBpsPerDay *
      remainingDays *
      _amount) / RAY;

    // Harvest after unlock for staking reward index update
    harvest(_lock);

    // Redistribute fee
    uint256 _amountRedistribute = (_penalty * redistributeBps) / RAY;
    _redistribute(_amountRedistribute);

    // Burn fee
    uint256 _amountBurn = (_penalty * burnBps) / RAY;
    _burn(address(this), _amountBurn);

    // Transfer difference to treasury
    uint256 _amountTreasury = (_penalty - _amountRedistribute) -
      _amountBurn;
    token.safeTransfer(treasuryAddr, _amountTreasury);

    // transfer remaining back to owner
    token.safeTransfer(msg.sender, _amount - _penalty);

    emit EarlyWithdraw(msg.sender, _amount, block.timestamp);
  }

  // ======= REWARDS ======= //

  function syncStaking() external nonReentrant {
    // @bw this should check that staking index is adequately up to date with shares of this contract
  }

  function _accrueStaking(uint256 _amount) private nonReentrant {
    // @bw check precision loss
    // Rewards are distributed per staked token
    uint256 amountPerVote = ((_amount * RAY) / supplyStaking) / RAY;
    stakingIndex += amountPerVote;
  }

  function _redistribute(uint256 _amount) private nonReentrant {
    // @bw check precision loss
    // Rewards are distributed per vote
    uint256 amountPerVote = ((_amount * RAY) / totalSupply()) / RAY;
    redistributeIndex += amountPerVote;
  }

  function accrueRevenue(uint256 _amount) external nonReentrant {
    // @bw check precision loss
    // Rewards are distributed per vote
    uint256 amountPerVote = ((_amount * RAY) / totalSupply()) / RAY;
    feeIndex += amountPerVote;
  }

  function harvest(LockedBalance memory _lock) public nonReentrant {
    LockedBalance storage userLock = _lock;

    // harvest fees, staking rewards & (optionnaly) protocol revenue

    // After harvest should update indexes to reset available rewards
    userLock.userRedisIndex = redistributeIndex;
    userLock.userStakingIndex = stakingIndex;
    userLock.userFeeIndex = feeIndex;
  }

  // ======= ADMIN ======= //

  function unifyRevenue() external onlyOwner {
    // should convert certains fees to a given rewards token like stable coin or coin
    // how to check if is a swapable or withdrawable token and good price is harder
  }

  function setEarlyWithdrawConfig(
    uint256 _newEarlyWithdrawBpsPerDay,
    uint256 _newRedistributeBps,
    uint256 _newBurnBps,
    uint256 _newTreasuryBps,
    address _newTreasuryAddr
  ) external onlyOwner {
    // Maximum early withdraw fee per day bps is 100% / max lock duration in day
    uint256 maxFeePerDay = RAY / (MAX_LOCK / 1 days);
    if (maxFeePerDay < _newEarlyWithdrawBpsPerDay)
      revert FeePerDayTooHigh();

    // Sum of fee distribution must equal RAY (100%)
    if (RAY != _newRedistributeBps + _newBurnBps + _newTreasuryBps)
      revert InvalidBps();

    earlyWithdrawBpsPerDay = _newEarlyWithdrawBpsPerDay;
    redistributeBps = _newRedistributeBps;
    burnBps = _newBurnBps;
    treasuryBps = _newTreasuryBps;
    treasuryAddr = _newTreasuryAddr;

    if (treasuryBps != 0 && treasuryAddr == address(0))
      revert InvalidTreasuryAddr();

    emit SetEarlyWithdrawConfig(
      earlyWithdrawBpsPerDay,
      redistributeBps,
      burnBps,
      treasuryBps,
      treasuryAddr
    );
  }
}
