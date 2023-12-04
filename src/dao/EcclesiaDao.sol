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
error CanOnlyExtendLock();
error CanOnlyLockInFuture();
error LockLongerThanMax();
error LockTooShortToStake();

/**
 * @title AthenaDAO
 * @notice Athena DAO allows participation in the Athena governance, protocol fee rewards and AOE staking
 * @custom:from Contract inspired by the Alpaca Finance xAlpaca contract
 * @custom:url https://github.com/alpaca-finance/xALPACA-contract/blob/main/contracts/8.10/xALPACA.sol
 */
contract EcclesiaDao is ERC20, ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;

  // ======= CONSTANTS ======= //

  // Maxiumum duration to lock AOE
  uint256 public constant MAX_LOCK = 365 days * 3;
  // Duration at which point 1 AOE = 1 vote
  uint256 public constant EQUILIBRIUM_LOCK = 365 days;
  // Weight multiplier for tokens locked longer than equilibrium added to base x1 weight
  uint256 public constant ADD_WEIGHT = 2;
  // Minimum duration to stake while participating in governance
  uint256 public constant MIN_TO_STAKE = MAX_LOCK / 2;

  uint256 public constant MULTIPLIER = 1e18;

  // ======= GLOBAL STATE ======= //

  // Staking contract
  IStaking public staking;
  // Token to be locked (AOE)
  IERC20 public token;
  // Total supply of AOE that get locked
  uint256 public supply;

  // Treasury address
  address public treasuryAddr;

  // Index for redistributed AOE
  uint256 public aoeIndex;
  // Index for accumulated fees
  uint256 public feeIndex;

  struct LockedBalance {
    uint256 amount; // amount of AOE locked
    uint256 staking;
    uint256 userAoeIndex;
    uint256 userFeeIndex;
    uint256 duration;
    uint256 end;
  }

  // Mapping (user => LockedBalance) to keep locking information for each user
  mapping(address => LockedBalance) public locks;

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
        (((_lockDuration - EQUILIBRIUM_LOCK) * MULTIPLIER) /
          (MAX_LOCK - EQUILIBRIUM_LOCK))
      : (_lockDuration * MULTIPLIER) / EQUILIBRIUM_LOCK;

    votes = (_amount * bias) / MULTIPLIER;
  }

  function votesToTokens(
    uint256 _votes,
    uint256 _lockDuration
  ) public view returns (uint256 tokens) {
    uint256 bias = EQUILIBRIUM_LOCK <= _lockDuration
      ? 1 +
        ADD_WEIGHT *
        (((_lockDuration - EQUILIBRIUM_LOCK) * MULTIPLIER) /
          (MAX_LOCK - EQUILIBRIUM_LOCK))
      : (_lockDuration * MULTIPLIER) / EQUILIBRIUM_LOCK;

    tokens = (_votes * MULTIPLIER) / bias;
  }

  // ======= DEPOSIT ======= //

  function _deposit(
    LockedBalance memory _lock,
    uint256 _amount,
    uint256 _unlockTime
  ) internal {
    LockedBalance storage userLock = _lock;

    if (userLock.amount == 0) {
      userLock.userAoeIndex = aoeIndex;
      userLock.userFeeIndex = feeIndex;
    }

    if (_unlockTime != 0) {
      userLock.duration = _unlockTime - block.timestamp;
      userLock.end = _unlockTime;
    }

    if (_amount != 0) {
      token.safeTransferFrom(msg.sender, address(this), _amount);
      userLock.amount += _amount;
      supply += _amount;
    }

    if (MIN_TO_STAKE < userLock.duration) {
      uint256 toStake = userLock.amount - userLock.staking;

      token.safeIncreaseAllowance(address(staking), toStake);
      staking.deposit(toStake);

      userLock.staking += toStake;
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

    uint duration = _unlockTime - block.timestamp;
    uint256 votes = tokenToVotes(_amount, duration);
    _mint(msg.sender, votes);
  }
}
