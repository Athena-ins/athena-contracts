// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Contracts
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Libraries
import { RayMath } from "../libs/RayMath.sol";
import { VirtualPool } from "../libs/VirtualPool.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";
import { IStaking } from "../interfaces/IStaking.sol";
import { IFarmingRange } from "../interfaces/IFarmingRange.sol";
import { IAthenaPositionToken } from "../interfaces/IAthenaPositionToken.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { console } from "hardhat/console.sol";

// ======= ERRORS ======= //

error OnlyTokenOwner();
error OnlyClaimManager();
error OnlyFarmingRange();
error PoolIsPaused();
error PoolIdsMustBeUniqueAndAscending();
error AmountOfPoolsIsAboveMaxLeverage();
error IncompatiblePools(uint64 poolIdA, uint64 poolIdB);
error WithdrawCommitDelayNotReached();
error InsufficientLiquidityForCover();
error RatioAbovePoolCapacity();
error CoverIsExpired();
error NotEnoughPremiums();
error CannotTakeInterestsIfCommittedWithdrawal();
error CannotIncreaseIfCommittedWithdrawal();
error PositionNotCommited();
error SenderNotLiquidationManager();
error PoolHasOnGoingClaims();

contract LiquidityManager is
  ILiquidityManager,
  ReentrancyGuard,
  Ownable
{
  using SafeERC20 for IERC20;
  using RayMath for uint256;
  using VirtualPool for VirtualPool.VPool;

  // ======= STORAGE ======= //

  IAthenaPositionToken public positionToken;
  IAthenaCoverToken public coverToken;
  IStaking public staking;
  IFarmingRange public farming;
  IEcclesiaDao public ecclesiaDao;
  IStrategyManager public strategyManager;
  address public claimManager;

  /// The delay after commiting before a position can be withdrawn
  uint256 public withdrawDelay; // in seconds
  /// The maximum amount of pools a position can supply liquidity to
  uint256 public maxLeverage;
  /// The fee paid out to the DAO for each leveraged pool in a position
  uint256 public leverageFeePerPool; // Ray
  // Maps pool0 -> pool1 -> areCompatible for LP leverage
  mapping(uint64 => mapping(uint64 => bool)) public arePoolCompatible;

  /// The ID of the next cover to be minted
  uint256 public nextCoverId;
  /// User cover data
  /// @dev left public to read cover initital cover data
  mapping(uint256 _id => Cover) public covers;

  /// The ID of the next token that will be minted.
  uint256 public nextPositionId;
  /// User LP data
  mapping(uint256 _id => Position) private _positions;

  /// The ID of the next claim to be
  uint256 public nextCompensationId;
  mapping(uint256 _id => VirtualPool.Compensation)
    public _compensations;

  /// The token ID position data
  uint64 public nextPoolId;
  /// Maps a pool ID to the virtualized pool's storage
  mapping(uint64 _id => VirtualPool.VPool) internal _pools;

  // ======= CONSTRUCTOR ======= //

  constructor(
    IAthenaPositionToken positionToken_,
    IAthenaCoverToken coverToken_,
    IStaking staking_,
    IFarmingRange farming_,
    IEcclesiaDao ecclesiaDao_,
    IStrategyManager strategyManager_,
    address claimManager_,
    uint256 withdrawDelay_,
    uint256 maxLeverage_,
    uint256 leverageFeePerPool_
  ) Ownable(msg.sender) {
    positionToken = positionToken_;
    coverToken = coverToken_;
    staking = staking_;
    farming = farming_;
    ecclesiaDao = ecclesiaDao_;
    strategyManager = strategyManager_;
    claimManager = claimManager_;

    withdrawDelay = withdrawDelay_;
    maxLeverage = maxLeverage_;
    leverageFeePerPool = leverageFeePerPool_;
  }

  /// ======= MODIFIERS ======= ///

  /**
   * @notice Throws if the caller is not the owner of the cover token
   * @param coverId_ The ID of the cover token
   */
  modifier onlyCoverOwner(uint256 coverId_) {
    if (msg.sender != coverToken.ownerOf(coverId_))
      revert OnlyTokenOwner();
    _;
  }

  /**
   * @notice Throws if the caller is not the owner of the position token
   * @param positionId_ The ID of the position token
   */
  modifier onlyPositionOwner(uint256 positionId_) {
    if (msg.sender != positionToken.ownerOf(positionId_))
      revert OnlyTokenOwner();
    _;
  }

  /**
   * @notice Throws if the caller is not the claim manager
   * @dev The claim manager is the contract that creates claims
   */
  modifier onlyClaimManager() {
    if (msg.sender != claimManager) revert OnlyClaimManager();
    _;
  }

  /**
   * @notice Throws if the caller is not the farming range
   */
  modifier onlyFarmingRange() {
    if (msg.sender != address(farming)) revert OnlyFarmingRange();
    _;
  }

  /// ======= VIEWS ======= ///

  function positions(
    uint256 tokenId_
  ) external view returns (Position memory) {
    return _positions[tokenId_];
  }

  /**
   * @notice Returns the up to date position data of a token
   * @param positionId_ The ID of the position
   * @return The position data
   */
  function positionInfo(
    uint256 positionId_
  ) external view returns (PositionRead memory) {
    Position storage position = _positions[positionId_];

    uint256 nbPools = position.poolIds.length;

    uint256[] memory coverRewards = new uint256[](nbPools);
    VirtualPool.UpdatedPositionInfo memory info;

    // All pools have same strategy since they are compatible
    uint256 latestStrategyRewardIndex = strategyManager
      .getRewardIndex(_pools[position.poolIds[0]].strategyId);

    for (uint256 i; i < nbPools; i++) {
      VirtualPool.VPool storage pool = _pools[position.poolIds[i]];

      uint256 currentLiquidityIndex = pool
        ._refresh(block.timestamp)
        .liquidityIndex;

      info = pool._getUpdatedPositionInfo(
        position.poolIds,
        VirtualPool.UpdatePositionParams({
          tokenId: positionId_,
          currentLiquidityIndex: currentLiquidityIndex,
          userCapital: position.supplied,
          strategyRewardIndex: position.strategyRewardIndex,
          latestStrategyRewardIndex: latestStrategyRewardIndex
        })
      );
      coverRewards[i] = info.coverRewards;
    }

    return
      PositionRead({
        supplied: position.supplied,
        commitWithdrawalTimestamp: position.commitWithdrawalTimestamp,
        strategyRewardIndex: latestStrategyRewardIndex,
        poolIds: position.poolIds,
        newUserCapital: info.newUserCapital,
        coverRewards: coverRewards,
        strategyRewards: info.strategyRewards
      });
  }

  /**
   * @notice Returns the up to date cover data of a token
   * @param coverId_ The ID of the cover
   * @return The cover data formatted for reading
   */
  function coverInfo(
    uint256 coverId_
  ) external view returns (CoverRead memory) {
    Cover storage cover = covers[coverId_];

    VirtualPool.CoverInfo memory info = _pools[cover.poolId]
      ._computeCoverInfo(coverId_);

    return
      CoverRead({
        coverId: coverId_,
        poolId: cover.poolId,
        coverAmount: cover.coverAmount,
        start: cover.start,
        end: cover.end,
        premiumsLeft: info.premiumsLeft,
        dailyCost: info.currentDailyCost,
        premiumRate: info.premiumRate
      });
  }

  /**
   * @notice Returns the size of a cover's protection
   * @param coverId_ The ID of the cover
   * @return The size of the cover's protection
   */
  function coverSize(uint256 coverId_) public view returns (uint256) {
    return covers[coverId_].coverAmount;
  }

  /**
   * @notice Returns the pool ID of a cover
   * @param coverId_ The ID of the cover
   * @return The pool ID of the cover
   */
  function coverPoolId(
    uint256 coverId_
  ) external view returns (uint64) {
    return covers[coverId_].poolId;
  }

  /**
   * @notice Returns if the cover is still active or has expired
   * @param coverId_ The ID of the cover
   * @return True if the cover is still active, otherwise false
   */
  function isCoverActive(
    uint256 coverId_
  ) external view returns (bool) {
    VirtualPool.VPool storage pool = _pools[covers[coverId_].poolId];
    // Check if the last tick of the cover was overtaken by the pool
    return pool.slot0.tick < pool.coverPremiums[coverId_].lastTick;
  }

  /**
   * @notice Returns the virtual pool's storage
   * @param poolId_ The ID of the pool
   * @return The virtual pool's storage
   */
  function poolInfo(
    uint64 poolId_
  ) external view returns (VirtualPool.VPoolRead memory) {
    VirtualPool.VPool storage pool = _pools[poolId_];
    VirtualPool.Slot0 memory slot0 = pool._refresh(block.timestamp);

    uint256 nbOverlappedPools = pool.overlappedPools.length;
    uint256[] memory overlappedCapital = new uint256[](
      nbOverlappedPools
    );
    for (uint256 i; i < nbOverlappedPools; i++) {
      overlappedCapital[i] = poolOverlaps(
        pool.poolId,
        pool.overlappedPools[i]
      );
    }

    uint256 totalLiquidity = pool.totalLiquidity();

    return
      VirtualPool.VPoolRead({
        poolId: pool.poolId,
        feeRate: pool.feeRate,
        leverageFeePerPool: pool.leverageFeePerPool,
        dao: pool.dao,
        strategyManager: pool.strategyManager,
        formula: pool.formula,
        slot0: slot0,
        strategyId: pool.strategyId,
        paymentAsset: pool.paymentAsset,
        underlyingAsset: pool.underlyingAsset,
        wrappedAsset: pool.wrappedAsset,
        isPaused: pool.isPaused,
        overlappedPools: pool.overlappedPools,
        ongoingClaims: pool.ongoingClaims,
        compensationIds: pool.compensationIds,
        overlappedCapital: overlappedCapital,
        utilizationRate: VirtualPool._utilization(
          slot0.coveredCapital,
          totalLiquidity
        ),
        totalLiquidity: totalLiquidity,
        availableLiquidity: pool.availableLiquidity(),
        strategyRewardIndex: strategyManager.getRewardIndex(
          pool.strategyId
        )
      });
  }

  /**
   * @notice Returns amount liquidity overlap between two pools
   * @param poolIdA_ The ID of the first pool
   * @param poolIdB_ The ID of the second pool
   * @return The amount of liquidity overlap
   *
   * @dev The overlap is always stored in the pool with the lowest ID
   * @dev The overlap if poolA = poolB is the pool's liquidity
   */
  function poolOverlaps(
    uint64 poolIdA_,
    uint64 poolIdB_
  ) public view returns (uint256) {
    return
      poolIdA_ < poolIdB_
        ? _pools[poolIdA_].overlaps[poolIdB_]
        : _pools[poolIdB_].overlaps[poolIdA_];
  }

  /// ======= INTERNAL VIEWS ======= ///

  /**
   * @notice Returns the compensation's storage pointer
   * @param compensationId_ The ID of the compensation
   * @return The compensation's storage pointer
   */
  function _getCompensation(
    uint256 compensationId_
  ) internal view returns (VirtualPool.Compensation storage) {
    return _compensations[compensationId_];
  }

  /// ======= POOLS ======= ///

  /**
   * @notice Creates a new pool, combining a cover product with a strategy
   * @param paymentAsset_ The asset used to pay for premiums
   * @param strategyId_ The ID of the strategy to be used
   * @param feeRate_ The fee rate paid out to the DAO
   * @param uOptimal_ The optimal utilization rate
   * @param r0_ The base interest rate
   * @param rSlope1_ The initial slope of the interest rate curve
   * @param rSlope2_ The slope of the interest rate curve above uOptimal
   * @param compatiblePools_ An array of pool IDs that are compatible with the new pool
   */
  function createPool(
    address paymentAsset_,
    uint256 strategyId_,
    uint256 feeRate_,
    uint256 uOptimal_,
    uint256 r0_,
    uint256 rSlope1_,
    uint256 rSlope2_,
    uint64[] calldata compatiblePools_
  ) external onlyOwner {
    // Save pool ID to memory and update for next
    uint64 poolId = nextPoolId;
    nextPoolId++;

    (address underlyingAsset, address wrappedAsset) = strategyManager
      .assets(strategyId_);

    // Get storage pointer to pool
    VirtualPool.VPool storage pool = _pools[poolId];

    // Create virtual pool
    pool._vPoolConstructor(
      // Create virtual pool argument struct
      VirtualPool.VPoolConstructorParams({
        poolId: poolId,
        dao: ecclesiaDao,
        strategyManager: strategyManager,
        strategyId: strategyId_,
        paymentAsset: paymentAsset_,
        underlyingAsset: underlyingAsset,
        wrappedAsset: wrappedAsset,
        feeRate: feeRate_, //Ray
        leverageFeePerPool: leverageFeePerPool, //Ray
        uOptimal: uOptimal_, //Ray
        r0: r0_, //Ray
        rSlope1: rSlope1_, //Ray
        rSlope2: rSlope2_, //Ray
        coverSize: coverSize,
        expireCover: _expireCover,
        getCompensation: _getCompensation
      })
    );

    // Add compatible pools
    // @dev Registered both ways for safety
    uint256 nbPools = compatiblePools_.length;
    for (uint256 i; i < nbPools; i++) {
      uint64 compatiblePoolId = compatiblePools_[i];
      arePoolCompatible[poolId][compatiblePoolId] = true;
      arePoolCompatible[compatiblePoolId][poolId] = true;
    }
  }

  /// ======= MAKE LP POSITION ======= ///

  /**
   * @notice Creates a new LP position
   * @param amount The amount of tokens to supply
   * @param isWrapped True if the user can & wants to provide strategy tokens
   * @param poolIds The IDs of the pools to provide liquidity to
   *
   * @dev Wrapped tokens are tokens representing a position in a strategy,
   * it allows the user to reinvest DeFi liquidity without having to withdraw
   * @dev Positions created after claim creation & before compensation are affected by the claim
   */
  function openPosition(
    uint256 amount,
    bool isWrapped,
    uint64[] calldata poolIds
  ) external {
    // Check that the amount of pools is below the max leverage
    if (maxLeverage < poolIds.length)
      revert AmountOfPoolsIsAboveMaxLeverage();

    // Save new position positionId and update for next
    uint256 positionId = nextPositionId;
    nextPositionId++;

    // All pools share the same strategy so we can use the first pool ID
    uint256 strategyId = _pools[poolIds[0]].strategyId;
    uint256 amountUnderlying = isWrapped
      ? strategyManager.wrappedToUnderlying(strategyId, amount)
      : amount;

    // Check pool compatibility & underlying token then register overlapping capital
    _addOverlappingCapitalAfterCheck(
      poolIds,
      positionId,
      amountUnderlying
    );

    // Push funds to strategy manager
    if (isWrapped) {
      address wrappedAsset = _pools[poolIds[0]].wrappedAsset;
      IERC20(wrappedAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositWrappedToStrategy(strategyId);
    } else {
      address underlyingAsset = _pools[poolIds[0]].underlyingAsset;
      IERC20(underlyingAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositToStrategy(strategyId, amount);
    }

    _positions[positionId] = Position({
      supplied: amountUnderlying,
      commitWithdrawalTimestamp: 0,
      poolIds: poolIds,
      // Save index from which the position will start accruing strategy rewards
      strategyRewardIndex: strategyManager.getRewardIndex(strategyId)
    });

    // Mint position NFT
    positionToken.mint(msg.sender, positionId);
  }

  /// ======= UPDATE LP POSITION ======= ///

  /**
   * @notice Increases the position's provided liquidity
   * @param positionId_ The ID of the position
   * @param amount The amount of tokens to supply
   * @param isWrapped True if the user can & wants to provide strategy tokens
   *
   * @dev Wrapped tokens are tokens representing a position in a strategy,
   * it allows the user to reinvest DeFi liquidity without having to withdraw
   */
  function addLiquidity(
    uint256 positionId_,
    uint256 amount,
    bool isWrapped
  ) external onlyPositionOwner(positionId_) {
    Position storage position = _positions[positionId_];
    uint256 strategyId = _pools[position.poolIds[0]].strategyId;

    // Positions that are commit for withdrawal cannot be increased
    if (position.commitWithdrawalTimestamp != 0)
      revert CannotIncreaseIfCommittedWithdrawal();

    // Take interests in all pools before update
    // @dev Needed to register rewards & claims impact on capital
    _takeInterests(
      positionId_,
      positionToken.ownerOf(positionId_),
      0
    );

    uint256 amountUnderlying = isWrapped
      ? strategyManager.wrappedToUnderlying(strategyId, amount)
      : amount;

    // Check pool compatibility & underlying position then register overlapping capital
    _addOverlappingCapitalAfterCheck(
      position.poolIds,
      positionId_,
      amountUnderlying
    );

    // Push funds to strategy manager
    if (isWrapped) {
      address wrappedAsset = _pools[position.poolIds[0]].wrappedAsset;
      IERC20(wrappedAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositWrappedToStrategy(strategyId);
    } else {
      address underlyingAsset = _pools[position.poolIds[0]]
        .underlyingAsset;
      IERC20(underlyingAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositToStrategy(strategyId, amount);
    }

    // Update the position's capital
    position.supplied += amountUnderlying;
  }

  /// ======= TAKE LP INTERESTS ======= ///

  /**
   * @notice Takes the interests of a position
   * @param positionId_ The ID of the position
   * @param coverRewardsBeneficiary_ The address to send the cover rewards to
   * @param yieldBonus_ The yield bonus to apply
   */
  function _takeInterests(
    uint256 positionId_,
    address coverRewardsBeneficiary_,
    uint256 yieldBonus_
  ) private {
    Position storage position = _positions[positionId_];

    // Locks interests to avoid abusively early withdrawal commits
    if (position.commitWithdrawalTimestamp != 0)
      revert CannotTakeInterestsIfCommittedWithdrawal();

    // All pools have same strategy since they are compatible
    uint256 latestStrategyRewardIndex = strategyManager
      .getRewardIndex(_pools[position.poolIds[0]].strategyId);
    address posOwner = positionToken.ownerOf(positionId_);

    uint256 newUserCapital;
    uint256 strategyRewards;

    uint256 nbPools = position.poolIds.length;
    for (uint256 i; i < nbPools; i++) {
      VirtualPool.VPool storage pool = _pools[position.poolIds[i]];

      // Clean pool from expired covers
      pool._purgeExpiredCovers();

      // These are the same values at each iteration
      (newUserCapital, strategyRewards) = pool._takePoolInterests(
        positionId_,
        coverRewardsBeneficiary_,
        position.supplied,
        position.strategyRewardIndex,
        latestStrategyRewardIndex,
        yieldBonus_,
        position.poolIds
      );
    }

    // All pools have same strategy since they are compatible
    uint256 strategyId = _pools[position.poolIds[0]].strategyId;

    // Withdraw interests from strategy
    strategyManager.withdrawFromStrategy(
      strategyId,
      0, // No capital withdrawn
      strategyRewards,
      posOwner, // Always paid out to owner
      yieldBonus_
    );

    // Save index up to which the position has received strategy rewards
    position.strategyRewardIndex = latestStrategyRewardIndex;
    // Update the position capital to reflect potential reduction due to claims
    position.supplied = newUserCapital;
  }

  /**
   * @notice Takes the interests of a position
   * @param positionId_ The ID of the position
   */
  function takeInterests(
    uint256 positionId_
  ) public onlyPositionOwner(positionId_) {
    _takeInterests(
      positionId_,
      positionToken.ownerOf(positionId_),
      0
    );
  }

  /**
   * @notice Takes the interests of a position taking into account the user yield bonus
   * @param account_ The address of the account
   * @param yieldBonus_ The yield bonus to apply
   * @param positionIds_ The IDs of the positions
   *
   * @dev This function is only callable by the farming range
   */
  function takeInterestsWithYieldBonus(
    address account_,
    uint256 yieldBonus_,
    uint256[] calldata positionIds_
  ) external onlyFarmingRange {
    uint256 nbPositions = positionIds_.length;
    for (uint256 i; i < nbPositions; i++) {
      _takeInterests(positionIds_[i], account_, yieldBonus_);
    }
  }

  /// ======= CLOSE LP POSITION ======= ///

  /**
   * @notice Commits to withdraw the position's liquidity
   * @param positionId_ The ID of the position
   *
   * @dev Ongoing claims must be resolved before being able to commit
   * @dev Interests earned between the commit and the withdrawal are sent to the DAO
   */
  function commitRemoveLiquidity(
    uint256 positionId_
  ) external onlyPositionOwner(positionId_) {
    Position storage position = _positions[positionId_];

    for (uint256 i; i < position.poolIds.length; i++) {
      VirtualPool.VPool storage pool = _pools[position.poolIds[i]];
      // Cannot commit to withdraw while there are ongoing claims
      if (0 < pool.ongoingClaims) revert PoolHasOnGoingClaims();
    }

    // Take interests in all pools before withdrawal
    // @dev Any rewards accrued after this point will be send to the leverage risk wallet
    _takeInterests(
      positionId_,
      positionToken.ownerOf(positionId_),
      0
    );

    // Register the commit timestamp
    position.commitWithdrawalTimestamp = block.timestamp;
  }

  /**
   * @notice Cancels a position's commit to withdraw its liquidity
   * @param positionId_ The ID of the position
   *
   * @dev This redirects interest back to the position owner
   */
  function uncommitRemoveLiquidity(
    uint256 positionId_
  ) external onlyPositionOwner(positionId_) {
    Position storage position = _positions[positionId_];

    // Avoid users accidentally paying their rewards to the leverage risk wallet
    if (position.commitWithdrawalTimestamp == 0)
      revert PositionNotCommited();

    // Pool rewards after commit are paid in favor of the DAO's leverage risk wallet
    _takeInterests(positionId_, address(ecclesiaDao), 0);

    position.commitWithdrawalTimestamp = 0;
  }

  /**
   * @notice Closes a position and withdraws its liquidity
   * @param positionId_ The ID of the position
   * @param keepWrapped_ True if the user wants to keep the strategy tokens
   *
   * @dev The position must be committed and the delay elapsed to withdrawal
   * @dev Interests earned between the commit and the withdrawal are sent to the DAO
   */
  function removeLiquidity(
    uint256 positionId_,
    uint256 amount_,
    bool keepWrapped_
  ) external onlyPositionOwner(positionId_) {
    Position storage position = _positions[positionId_];

    // Check that commit delay has been reached
    if (
      block.timestamp <
      position.commitWithdrawalTimestamp + withdrawDelay
    ) revert WithdrawCommitDelayNotReached();

    // All pools have same strategy since they are compatible
    uint256 latestStrategyRewardIndex = strategyManager
      .getRewardIndex(_pools[position.poolIds[0]].strategyId);
    address account = positionToken.ownerOf(positionId_);

    // Remove capital from pool & compute capital after claims & strategy rewards
    (
      uint256 capital,
      uint256 strategyRewards
    ) = _removeOverlappingCapital(
        positionId_,
        position.supplied,
        amount_,
        position.strategyRewardIndex,
        latestStrategyRewardIndex,
        position.poolIds
      );

    // Reduce position of new amount of capital minus the amount withdrawn
    // @dev Should underflow if the amount is greater than the capital
    position.supplied = capital - amount_;
    // Reset the position's commitWithdrawalTimestamp
    position.commitWithdrawalTimestamp = 0;
    position.strategyRewardIndex = latestStrategyRewardIndex;

    // All pools have same strategy since they are compatible
    if (amount_ != 0 || strategyRewards != 0) {
      uint256 strategyId = _pools[position.poolIds[0]].strategyId;
      if (keepWrapped_) {
        strategyManager.withdrawWrappedFromStrategy(
          strategyId,
          amount_,
          strategyRewards,
          account,
          0 // No yield bonus
        );
      } else {
        strategyManager.withdrawFromStrategy(
          strategyId,
          amount_,
          strategyRewards,
          account,
          0 // No yield bonus
        );
      }
    }
  }

  /// ======= COVER HELPERS ======= ///

  /**
   * @notice Removes all expired covers from a pool
   * @param poolId_ The ID of the pool
   */
  function purgeExpiredCoversInPool(uint64 poolId_) external {
    // Clean pool from expired covers
    _pools[poolId_]._purgeExpiredCovers();
  }

  /**
   * @notice Expires a cover & freezes its farming rewards
   * @param coverId_ The ID of the cover
   */
  function _expireCover(uint256 coverId_) internal {
    covers[coverId_].end = block.timestamp;

    // This will freeze the farming rewards of the cover
    farming.freezeExpiredCoverRewards(coverId_);
  }

  /// ======= BUY COVER ======= ///

  /**
   * @notice Buys a cover
   * @param poolId_ The ID of the pool
   * @param coverAmount_ The amount of cover to buy
   * @param premiums_ The amount of premiums to pay
   */
  function openCover(
    uint64 poolId_,
    uint256 coverAmount_,
    uint256 premiums_
  ) external {
    // Get storage pointer to pool
    VirtualPool.VPool storage pool = _pools[poolId_];

    // Clean pool from expired covers
    pool._purgeExpiredCovers();

    // Check if pool is currently paused
    if (pool.isPaused) revert PoolIsPaused();
    // Check if pool has enough liquidity
    if (pool.availableLiquidity() < coverAmount_)
      revert InsufficientLiquidityForCover();

    // Transfer premiums from user
    IERC20(pool.paymentAsset).safeTransferFrom(
      msg.sender,
      address(this),
      premiums_
    );

    // Save new cover ID and update for next
    uint256 coverId = nextCoverId;
    nextCoverId++;

    // Create cover
    covers[coverId] = Cover({
      poolId: poolId_,
      coverAmount: coverAmount_,
      start: block.timestamp,
      end: 0
    });

    // Create cover in pool
    pool._registerCover(coverId, coverAmount_, premiums_);

    // Mint cover NFT
    coverToken.mint(msg.sender, coverId);
  }

  /// ======= UPDATE COVER ======= ///

  /**
   * @notice Updates or closes a cover
   * @param coverId_ The ID of the cover
   * @param coverToAdd_ The amount of cover to add
   * @param coverToRemove_ The amount of cover to remove
   * @param premiumsToAdd_ The amount of premiums to add
   * @param premiumsToRemove_ The amount of premiums to remove
   *
   * @dev If premiumsToRemove_ is max uint256 then withdraw premiums
   * & closes the cover
   */
  function updateCover(
    uint256 coverId_,
    uint256 coverToAdd_,
    uint256 coverToRemove_,
    uint256 premiumsToAdd_,
    uint256 premiumsToRemove_
  ) external onlyCoverOwner(coverId_) {
    // Get storage pointer to cover
    Cover storage cover = covers[coverId_];
    // Get storage pointer to pool
    VirtualPool.VPool storage pool = _pools[cover.poolId];

    // Clean pool from expired covers
    pool._purgeExpiredCovers();

    // Check if pool is currently paused
    if (pool.isPaused) revert PoolIsPaused();
    // Check if cover is expired
    if (cover.end != 0) revert CoverIsExpired();

    // Get the amount of premiums left
    uint256 premiums = pool._computeCoverInfo(coverId_).premiumsLeft;

    // Close the existing cover
    pool._closeCover(coverId_, cover.coverAmount);

    // Only allow one operation on cover amount change
    if (0 < coverToAdd_) {
      /**
       * Check if pool has enough liquidity,
       * we closed cover at this point so check for total
       * */
      if (pool.availableLiquidity() < cover.coverAmount + coverToAdd_)
        revert InsufficientLiquidityForCover();

      cover.coverAmount += coverToAdd_;
    } else if (0 < coverToRemove_) {
      // User is allowed to set the cover amount to 0 to pause the cover
      cover.coverAmount -= coverToRemove_;
    }

    // Only allow one operation on premiums amount change
    if (0 < premiumsToRemove_) {
      if (premiumsToRemove_ == type(uint256).max) {
        // If premiumsToRemove_ is max uint256, then remove all premiums
        premiumsToRemove_ = premiums;
      } else if (premiums < premiumsToRemove_) {
        // Else check if there is enough premiums left
        revert NotEnoughPremiums();
      }

      premiums -= premiumsToRemove_;
      IERC20(pool.paymentAsset).safeTransfer(msg.sender, premiums);
    } else if (0 < premiumsToAdd_) {
      // Transfer premiums from user
      IERC20(pool.paymentAsset).safeTransferFrom(
        msg.sender,
        address(this),
        premiumsToAdd_
      );
      premiums += premiumsToAdd_;
    }

    if (premiums == 0) {
      // If there is no premiums left then expire the cover
      _expireCover(coverId_);
    } else {
      // Update cover
      pool._registerCover(coverId_, cover.coverAmount, premiums);
    }
  }

  /// ======= LIQUIDITY CHANGES ======= ///

  /**
   * @notice Adds a position's liquidity to the pools and their overlaps
   * @param poolIds_ The IDs of the pools to add liquidity to
   * @param positionId_ The ID of the position
   * @param amount_ The amount of liquidity to add
   *
   * @dev PoolIds are checked at creation to ensure they are unique and ascending
   */
  function _addOverlappingCapitalAfterCheck(
    uint64[] memory poolIds_,
    uint256 positionId_,
    uint256 amount_
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint256 i; i < nbPoolIds; i++) {
      uint64 poolId0 = poolIds_[i];
      VirtualPool.VPool storage pool0 = _pools[poolId0];

      // Check if pool is currently paused
      if (pool0.isPaused) revert PoolIsPaused();

      // Remove expired covers
      pool0._purgeExpiredCovers();

      // Add liquidity to the pools available liquidity
      pool0.overlaps[poolId0] += amount_;

      /**
       * Loops all pool combinations to check if they are compatible,
       * that they are in ascending order & that they are unique.
       * It then registers the overlapping capital.
       *
       * The loop starts at i + 1 to avoid redundant combinations.
       */
      for (uint256 j = i + 1; j < nbPoolIds; j++) {
        uint64 poolId1 = poolIds_[j];
        VirtualPool.VPool storage pool1 = _pools[poolId1];

        // Check if pool ID is greater than the previous one
        // This ensures each pool ID is unique & reduces computation cost
        if (poolId1 <= poolId0)
          revert PoolIdsMustBeUniqueAndAscending();

        // Check if pool is compatible
        if (!arePoolCompatible[poolId0][poolId1])
          revert IncompatiblePools(poolId0, poolId1);

        if (poolId0 != poolId1 && pool0.overlaps[poolId1] == 0) {
          pool0.overlappedPools.push(poolId1);
          pool1.overlappedPools.push(poolId0);
        }

        pool0.overlaps[poolId1] += amount_;
      }

      // Update premium rate, seconds per tick & LP position info
      pool0._depositToPool(positionId_, amount_);
    }
  }

  /**
   * @notice Removes the position liquidity from its pools and overlaps
   * @param positionId_ The ID of the position
   * @param amount_ The amount of liquidity to remove
   * @param poolIds_ The IDs of the pools to remove liquidity from
   *
   * @return capital The updated user capital
   * @return rewards The strategy rewards
   *
   * @dev PoolIds have been checked at creation to ensure they are unique and ascending
   */
  function _removeOverlappingCapital(
    uint256 positionId_,
    uint256 supplied_,
    uint256 amount_,
    uint256 strategyRewardIndex_,
    uint256 latestStrategyRewardIndex_,
    uint64[] storage poolIds_
  ) internal returns (uint256 capital, uint256 rewards) {
    uint256 nbPoolIds = poolIds_.length;

    for (uint256 i; i < nbPoolIds; i++) {
      uint64 poolId0 = poolIds_[i];
      VirtualPool.VPool storage pool0 = _pools[poolId0];

      // Need to clean covers to avoid them causing a utilization overflow
      pool0._purgeExpiredCovers();

      // Remove liquidity
      (uint256 newUserCapital, uint256 strategyRewards) = pool0
        ._withdrawLiquidity(
          positionId_,
          supplied_,
          amount_,
          strategyRewardIndex_,
          latestStrategyRewardIndex_,
          poolIds_
        );

      // The updated user capital & strategy rewards are the same at each iteration
      capital = newUserCapital;
      rewards = strategyRewards;

      // Considering the verification that pool IDs are unique & ascending
      // then start index is i to reduce required number of loops
      for (uint256 j = i; j < nbPoolIds; j++) {
        uint64 poolId1 = poolIds_[j];
        pool0.overlaps[poolId1] -= newUserCapital;
      }
    }
  }

  /// ======= CLAIMS ======= ///

  /**
   * @notice Registers a claim in the pool after a claim is created
   * @param coverId_ The ID of the cover
   *
   * @dev The existence of th cover is checked in the claim manager
   */
  function addClaimToPool(
    uint256 coverId_
  ) external onlyClaimManager {
    _pools[covers[coverId_].poolId].ongoingClaims++;
  }

  /**
   * @notice Removes a claim from the pool after a claim is resolved
   * @param coverId_ The ID of the cover
   *
   * @dev The existence of th cover is checked in the claim manager
   */
  function removeClaimFromPool(
    uint256 coverId_
  ) external onlyClaimManager {
    _pools[covers[coverId_].poolId].ongoingClaims--;
  }

  /**
   * @notice Attemps to open an updated cover after a compensation is paid out
   * @param poolId_ The ID of the pool
   * @param coverId_ The ID of the cover
   * @param newCoverAmount_ The amount of cover to buy
   * @param premiums_ The amount of premiums to pay
   *
   * @dev The function is external to use try/catch but can only be called internally
   */
  function attemptReopenCover(
    uint64 poolId_,
    uint256 coverId_,
    uint256 newCoverAmount_,
    uint256 premiums_
  ) external {
    if (msg.sender != address(this)) {
      revert SenderNotLiquidationManager();
    } // this function should be called only by this contract

    _pools[poolId_]._registerCover(
      coverId_,
      newCoverAmount_,
      premiums_
    );
  }

  /**
   * @notice Pays out a compensation following an valid claim
   * @param coverId_ The ID of the cover
   * @param compensationAmount_ The amount of compensation to pay out
   */
  function payoutClaim(
    uint256 coverId_,
    uint256 compensationAmount_
  ) external onlyClaimManager {
    uint64 fromPoolId = covers[coverId_].poolId;
    VirtualPool.VPool storage poolA = _pools[fromPoolId];
    uint256 ratio = compensationAmount_.rayDiv(
      poolA.totalLiquidity()
    );
    // The ration cannot be over 100% of the pool's liquidity (1 RAY)
    if (RayMath.RAY < ratio) revert RatioAbovePoolCapacity();

    // All pools have same strategy since they are compatible
    uint256 strategyId = _pools[poolA.overlappedPools[0]].strategyId;
    uint256 strategyRewardIndex = strategyManager.getRewardIndex(
      strategyId
    );

    uint256 nbPools = poolA.overlappedPools.length;

    // Get compensation ID and its storage pointer
    uint256 compensationId = nextCompensationId;
    nextCompensationId++;
    VirtualPool.Compensation storage compensation = _compensations[
      compensationId
    ];
    // Register data common to all affected pools
    compensation.fromPoolId = fromPoolId;
    compensation.ratio = ratio;
    compensation.strategyRewardIndexBeforeClaim = strategyRewardIndex;

    for (uint256 i; i < nbPools; i++) {
      uint64 poolIdB = poolA.overlappedPools[i];
      VirtualPool.VPool storage poolB = _pools[poolIdB];

      (VirtualPool.VPool storage pool0, uint64 poolId1) = fromPoolId <
        poolIdB
        ? (poolA, poolIdB)
        : (poolB, fromPoolId);

      // Skip if overlap is 0
      if (pool0.overlaps[poolId1] == 0) continue;
      // Update pool state & remove expired covers
      poolB._purgeExpiredCovers();

      // New context to avoid stack too deep error
      {
        // Remove liquidity from dependant pool
        uint256 amountToRemove = pool0.overlaps[poolId1].rayMul(
          ratio
        );

        // Skip if the amount to remove is 0
        if (amountToRemove == 0) continue;

        // Update pool pricing (premium rate & seconds per tick)
        /// @dev Skip available liquidity lock check as payouts are always possible
        poolB._syncLiquidity(0, amountToRemove, true);

        // Reduce available liquidity,
        // at i = 0 this is the self liquidity of cover's pool
        pool0.overlaps[poolId1] -= amountToRemove;
        // Only remove deps liquidity if the pool of the cover
        if (i != 0) {
          // Check all pool combinations to reduce overlapping capital
          for (uint64 j; j < nbPools; j++) {
            uint64 poolIdC = poolA.overlappedPools[j];
            if (poolIdC != fromPoolId)
              if (poolIdB <= poolIdC) {
                poolB.overlaps[poolIdC] -= amountToRemove;
              }
          }
        }

        // Trade references to track reward indexes in single compensation struct
        poolB.compensationIds.push(compensationId);
        compensation.liquidityIndexBeforeClaim[poolIdB] = poolB
          .slot0
          .liquidityIndex;
      }
    }

    address claimant = coverToken.ownerOf(coverId_);

    // New context to avoid stack too deep error
    {
      // Get storage pointer to cover
      Cover storage cover = covers[coverId_];

      // If the cover isn't expired, then reduce the cover amount
      if (cover.end == 0) {
        // Get the amount of premiums left
        uint256 premiums = poolA
          ._computeCoverInfo(coverId_)
          .premiumsLeft;
        // Close the existing cover
        poolA._closeCover(coverId_, cover.coverAmount);

        // Reduce the cover amount by the compensation amount
        cover.coverAmount -= compensationAmount_;

        // Update cover
        try
          this.attemptReopenCover(
            fromPoolId,
            coverId_,
            cover.coverAmount,
            premiums
          )
        {} catch {
          // If updating the cover fails beacause of not enough liquidity,
          // then close the cover entirely & transfer premiums back to user
          IERC20(poolA.paymentAsset).safeTransfer(claimant, premiums);
          _expireCover(coverId_);
        }
      }
    }

    // Pay out the compensation from the strategy
    strategyManager.payoutFromStrategy(
      strategyId,
      compensationAmount_,
      claimant
    );
  }

  /// ======= ADMIN ======= ///

  /**
   * @notice Updates the withdraw delay and the maximum leverage
   * @param withdrawDelay_ The new withdraw delay
   * @param maxLeverage_ The new maximum leverage
   */
  function updateConfig(
    uint256 withdrawDelay_,
    uint256 maxLeverage_
  ) external onlyOwner {
    withdrawDelay = withdrawDelay_;
    maxLeverage = maxLeverage_;
  }
}
