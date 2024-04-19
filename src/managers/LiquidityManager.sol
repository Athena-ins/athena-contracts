// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// Contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Libraries
import { AthenaDataProvider } from "../misc/AthenaDataProvider.sol";
import { RayMath } from "../libs/RayMath.sol";
import { VirtualPool } from "../libs/VirtualPool.sol";
import { DataTypes } from "../libs/DataTypes.sol";
import { ReentrancyGuard } from "../libs/ReentrancyGuard.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IAthenaPositionToken } from "../interfaces/IAthenaPositionToken.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { console } from "hardhat/console.sol";

// ======= ERRORS ======= //

error OnlyTokenOwner();
error OnlyClaimManager();
error OnlyYieldRewarder();
error PoolDoesNotExist();
error PoolIsPaused();
error PoolIdsMustBeUniqueAndAscending();
error AmountOfPoolsIsAboveMaxLeverage();
error IncompatiblePools(uint64 poolIdA, uint64 poolIdB);
error WithdrawCommitDelayNotReached();
error InsufficientLiquidityForCover();
error RatioAbovePoolCapacity();
error CoverIsExpired();
error NotEnoughPremiums();
error CannotUpdatePositionIfCommittedWithdrawal();
error CannotTakeInterestsIfCommittedWithdrawal();
error CannotIncreaseIfCommittedWithdrawal();
error PositionNotCommited();
error SenderNotLiquidationManager();
error PoolHasOnGoingClaims();
error CoverAmountIsZero();
error CoverAmountMustBeGreaterThanZero();
error MustPurgeExpiredTokenInTheFuture();
error InsufficientLiquidityForWithdrawal();
error OutOfBounds();

contract LiquidityManager is
  ILiquidityManager,
  ReentrancyGuard,
  Ownable
{
  // ======= LIBRARIES ======= //

  using SafeERC20 for IERC20;
  using RayMath for uint256;
  using VirtualPool for DataTypes.VPool;

  // ======= STORAGE ======= //

  IAthenaPositionToken public positionToken;
  IAthenaCoverToken public coverToken;
  IEcclesiaDao public ecclesiaDao;
  IStrategyManager public strategyManager;
  address public claimManager;
  address public yieldRewarder;

  /// The delay after commiting before a position can be withdrawn
  uint256 public withdrawDelay; // in seconds
  /// The maximum amount of pools a position can supply liquidity to
  uint256 public maxLeverage;
  /// The fee paid out to the DAO for each leveraged pool in a position
  uint256 public leverageFeePerPool; // Ray
  // Maps pool0 -> pool1 -> areCompatible for LP leverage
  mapping(uint64 => mapping(uint64 => bool)) public arePoolCompatible;

  /// Maps a cover ID to the ID of the pool storing the cover data
  mapping(uint256 _id => uint64 _poolId) public coverToPool;

  /// User LP data
  mapping(uint256 _id => Position) public _positions;

  /// The ID of the next claim to be
  uint256 public nextCompensationId;

  /// The token ID position data
  uint64 public nextPoolId;
  /// Maps a pool ID to the virtualized pool's storage
  mapping(uint64 _id => DataTypes.VPool) internal _pools;

  // ======= CONSTRUCTOR ======= //

  constructor(
    IAthenaPositionToken positionToken_,
    IAthenaCoverToken coverToken_,
    IEcclesiaDao ecclesiaDao_,
    IStrategyManager strategyManager_,
    address claimManager_,
    address yieldRewarder_,
    uint256 withdrawDelay_,
    uint256 maxLeverage_,
    uint256 leverageFeePerPool_
  ) Ownable(msg.sender) {
    positionToken = positionToken_;
    coverToken = coverToken_;

    ecclesiaDao = ecclesiaDao_;
    strategyManager = strategyManager_;
    claimManager = claimManager_;
    yieldRewarder = yieldRewarder_;

    withdrawDelay = withdrawDelay_;
    maxLeverage = maxLeverage_;
    leverageFeePerPool = leverageFeePerPool_;
  }

  // ======= EVENTS ======= //

  /// @notice Emitted when a new pool is created
  event PoolCreated(uint64 indexed poolId);

  /// @notice Emitted when a position is opened
  event PositionOpenned(uint256 indexed positionId);
  /// @notice Emitted when a position's liquidity is updated
  event InterestsTaken(uint256 indexed positionId);
  /// @notice Emitted when a position's liquidity is updated
  event PositionLiquidityUpdated(
    uint256 indexed positionId,
    uint256 amountAdded,
    uint256 amountRemoved
  );

  /// @notice Emits when a new cover is bought
  event CoverOpenned(uint64 indexed poolId, uint256 indexed coverId);
  /// @notice Emits when a cover is updated
  event CoverUpdated(uint256 indexed coverId);
  /// @notice Emits when a cover is closed
  event CoverClosed(uint256 indexed coverId);

  /// @notice Compensation is paid out for a claim
  event CompensationPaid(
    uint256 indexed poolId,
    uint256 indexed compensationId
  );

  /// ======= INTERNAL HELPERS ======= ///

  /**
   * @notice Throws if the pool does not exist
   * @param poolId_ The ID of the pool
   */
  function _checkPoolExists(uint64 poolId_) internal view {
    // We use the underlying asset since it cannot be address(0)
    if (VirtualPool.getPool(poolId_).underlyingAsset == address(0))
      revert PoolDoesNotExist();
  }

  /**
   * @notice Throws if the pool is paused
   * @param poolId_ The ID of the pool
   *
   * @dev You cannot buy cover, increase cover or add liquidity in a paused pool
   */
  function _checkIsNotPaused(uint64 poolId_) internal view {
    if (VirtualPool.getPool(poolId_).isPaused) revert PoolIsPaused();
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
   * @notice Throws if the caller is not the reward authority for yield bonuses
   */
  modifier onlyYieldRewarder() {
    if (msg.sender != address(yieldRewarder))
      revert OnlyYieldRewarder();
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
    return AthenaDataProvider.positionInfo(position, positionId_);
  }

  /**
   * @notice Returns the up to date cover data of a token
   * @param coverId_ The ID of the cover
   * @return The cover data formatted for reading
   */
  function coverInfo(
    uint256 coverId_
  ) external view returns (CoverRead memory) {
    return AthenaDataProvider.coverInfo(coverId_);
  }

  /**
   * @notice Returns the virtual pool's storage
   * @param poolId_ The ID of the pool
   * @return The virtual pool's storage
   */
  function poolInfo(
    uint64 poolId_
  ) external view returns (VPoolRead memory) {
    return AthenaDataProvider.poolInfo(poolId_);
  }

  /**
   * @notice Returns the up to date data of an array of positions
   * @param positionIds The IDs of the positions
   * @return The positions data
   *
   * @dev Moved to LiquidityManager since cannot pass array of storage pointers in memory
   */
  function positionInfos(
    uint256[] calldata positionIds
  ) external view returns (ILiquidityManager.PositionRead[] memory) {
    ILiquidityManager.PositionRead[]
      memory result = new ILiquidityManager.PositionRead[](
        positionIds.length
      );

    for (uint256 i; i < positionIds.length; i++) {
      // Parse IDs here since we cannot make an array of storage pointers in memory
      Position storage position = _positions[positionIds[i]];
      result[i] = AthenaDataProvider.positionInfo(
        position,
        positionIds[i]
      );
    }

    return result;
  }

  /**
   * @notice Returns up to date data for an array of covers
   * @param coverIds The IDs of the covers
   * @return The array of covers data
   */
  function coverInfos(
    uint256[] calldata coverIds
  ) external view returns (ILiquidityManager.CoverRead[] memory) {
    return AthenaDataProvider.coverInfos(coverIds);
  }

  /**
   * @notice Returns up to date data for an array of pools
   * @param poolIds The IDs of the pools
   * @return The array of pools data
   */
  function poolInfos(
    uint256[] calldata poolIds
  ) external view returns (ILiquidityManager.VPoolRead[] memory) {
    return AthenaDataProvider.poolInfos(poolIds);
  }

  /**
   * @notice Returns if the cover is still active or has expired
   * @param coverId_ The ID of the cover
   * @return True if the cover is still active, otherwise false
   */
  function isCoverActive(
    uint256 coverId_
  ) public view returns (bool) {
    return
      VirtualPool._isCoverActive(coverToPool[coverId_], coverId_);
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
        ? VirtualPool.getPool(poolIdA_).overlaps[poolIdB_]
        : VirtualPool.getPool(poolIdB_).overlaps[poolIdA_];
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
    // DataTypes.VPool storage pool = _pools[poolId];
    // DataTypes.VPool storage pool = VirtualPool.getPool(poolId);

    // Create virtual pool
    VirtualPool._vPoolConstructor(
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
        rSlope2: rSlope2_ //Ray
      })
    );

    // Add compatible pools
    uint256 nbPools = compatiblePools_.length;
    for (uint256 i; i < nbPools; i++) {
      uint64 compatiblePoolId = compatiblePools_[i];
      // @dev Registered both ways for simplicity
      arePoolCompatible[poolId][compatiblePoolId] = true;
      arePoolCompatible[compatiblePoolId][poolId] = true;
    }

    emit PoolCreated(poolId);
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
  ) external nonReentrant {
    // Check that the amount of pools is below the max leverage
    if (maxLeverage < poolIds.length)
      revert AmountOfPoolsIsAboveMaxLeverage();

    // Mint position NFT
    uint256 positionId = positionToken.mint(msg.sender);

    // All pools share the same strategy so we can use the first pool ID
    uint256 strategyId = VirtualPool.getPool(poolIds[0]).strategyId;
    uint256 amountUnderlying = isWrapped
      ? strategyManager.wrappedToUnderlying(strategyId, amount)
      : amount;

    // Check pool compatibility & underlying token then register overlapping capital
    _addOverlappingCapitalAfterCheck(
      poolIds,
      positionId,
      amountUnderlying,
      true // Purge pools
    );

    // Push funds to strategy manager
    if (isWrapped) {
      address wrappedAsset = VirtualPool
        .getPool(poolIds[0])
        .wrappedAsset;
      IERC20(wrappedAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositWrappedToStrategy(strategyId);
    } else {
      address underlyingAsset = VirtualPool
        .getPool(poolIds[0])
        .underlyingAsset;
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

    emit PositionOpenned(positionId);
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
  ) external onlyPositionOwner(positionId_) nonReentrant {
    Position storage position = _positions[positionId_];
    uint256 strategyId = VirtualPool
      .getPool(position.poolIds[0])
      .strategyId;

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
      amountUnderlying,
      false // Pools purged when taking interests
    );

    // Push funds to strategy manager
    if (isWrapped) {
      address wrappedAsset = VirtualPool
        .getPool(position.poolIds[0])
        .wrappedAsset;
      IERC20(wrappedAsset).safeTransferFrom(
        msg.sender,
        address(strategyManager),
        amount
      );

      strategyManager.depositWrappedToStrategy(strategyId);
    } else {
      address underlyingAsset = VirtualPool
        .getPool(position.poolIds[0])
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
      .getRewardIndex(
        VirtualPool.getPool(position.poolIds[0]).strategyId
      );
    address posOwner = positionToken.ownerOf(positionId_);

    uint256 newUserCapital;
    uint256 strategyRewards;

    uint256 nbPools = position.poolIds.length;
    for (uint256 i; i < nbPools; i++) {
      // Clean pool from expired covers
      VirtualPool._purgeExpiredCovers(position.poolIds[i]);

      // These are the same values at each iteration
      (newUserCapital, strategyRewards) = VirtualPool
        ._takePoolInterests(
          position.poolIds[i],
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
    uint256 strategyId = VirtualPool
      .getPool(position.poolIds[0])
      .strategyId;

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

    emit InterestsTaken(positionId_);
  }

  /**
   * @notice Takes the interests of a position
   * @param positionId_ The ID of the position
   */
  function takeInterests(
    uint256 positionId_
  ) public onlyPositionOwner(positionId_) nonReentrant {
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
   * @dev This function is only callable by the yield bonus authority
   */
  function takeInterestsWithYieldBonus(
    address account_,
    uint256 yieldBonus_,
    uint256[] calldata positionIds_
  ) external onlyYieldRewarder {
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
  ) external onlyPositionOwner(positionId_) nonReentrant {
    Position storage position = _positions[positionId_];

    for (uint256 i; i < position.poolIds.length; i++) {
      DataTypes.VPool storage pool = VirtualPool.getPool(
        position.poolIds[i]
      );
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
  ) external onlyPositionOwner(positionId_) nonReentrant {
    Position storage position = _positions[positionId_];

    // Avoid users accidentally paying their rewards to the leverage risk wallet
    if (position.commitWithdrawalTimestamp == 0)
      revert PositionNotCommited();

    position.commitWithdrawalTimestamp = 0;

    // Pool rewards after commit are paid in favor of the DAO's leverage risk wallet
    _takeInterests(positionId_, address(ecclesiaDao), 0);
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
  ) external onlyPositionOwner(positionId_) nonReentrant {
    Position storage position = _positions[positionId_];

    // Check that commit delay has been reached
    if (position.commitWithdrawalTimestamp == 0)
      revert PositionNotCommited();
    if (
      block.timestamp <
      position.commitWithdrawalTimestamp + withdrawDelay
    ) revert WithdrawCommitDelayNotReached();

    // All pools have same strategy since they are compatible
    uint256 latestStrategyRewardIndex = strategyManager
      .getRewardIndex(
        VirtualPool.getPool(position.poolIds[0]).strategyId
      );
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
    if (capital < amount_)
      revert InsufficientLiquidityForWithdrawal();

    position.supplied = capital - amount_;
    // Reset the position's commitWithdrawalTimestamp
    position.commitWithdrawalTimestamp = 0;
    position.strategyRewardIndex = latestStrategyRewardIndex;

    // All pools have same strategy since they are compatible
    if (amount_ != 0 || strategyRewards != 0) {
      uint256 strategyId = VirtualPool
        .getPool(position.poolIds[0])
        .strategyId;
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
  ) external nonReentrant {
    // Get storage pointer to pool
    DataTypes.VPool storage pool = VirtualPool.getPool(poolId_);

    // Clean pool from expired covers
    VirtualPool._purgeExpiredCovers(poolId_);

    // Check if pool exists & is not currently paused
    _checkPoolExists(poolId_);
    _checkIsNotPaused(poolId_);

    // Transfer premiums from user
    IERC20(pool.paymentAsset).safeTransferFrom(
      msg.sender,
      address(this),
      premiums_
    );

    // Mint cover NFT
    uint256 coverId = coverToken.mint(msg.sender);

    // Map cover to pool for data access
    coverToPool[coverId] = poolId_;

    // Create cover in pool
    VirtualPool._registerCover(
      poolId_,
      coverId,
      coverAmount_,
      premiums_
    );

    emit CoverOpenned(poolId_, coverId);
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
  ) external onlyCoverOwner(coverId_) nonReentrant {
    uint64 poolId = coverToPool[coverId_];

    // Get storage pointer to pool
    DataTypes.VPool storage pool = VirtualPool.getPool(poolId);

    // Clean pool from expired covers
    VirtualPool._purgeExpiredCovers(poolId);

    // Check if cover is expired
    if (!isCoverActive(coverId_)) revert CoverIsExpired();

    // Get the amount of premiums left
    uint256 premiums = VirtualPool
      ._computeCurrentCoverInfo(poolId, coverId_)
      .premiumsLeft;

    uint256 coverAmount = pool.covers[coverId_].coverAmount;

    // Close the existing cover
    VirtualPool._closeCover(poolId, coverId_);

    // Only allow one operation on cover amount change
    if (0 < coverToAdd_) {
      // Check if pool is currently paused
      _checkIsNotPaused(poolId);

      coverAmount += coverToAdd_;
    } else if (0 < coverToRemove_) {
      if (coverAmount <= coverToRemove_)
        revert CoverAmountMustBeGreaterThanZero();

      // Unckecked is ok because we checked that coverToRemove_ < coverAmount
      unchecked {
        coverAmount -= coverToRemove_;
      }
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
      IERC20(pool.paymentAsset).safeTransfer(
        msg.sender,
        premiumsToRemove_
      );
    } else if (0 < premiumsToAdd_) {
      // Transfer premiums from user
      IERC20(pool.paymentAsset).safeTransferFrom(
        msg.sender,
        address(this),
        premiumsToAdd_
      );
      premiums += premiumsToAdd_;
    }

    if (premiums != 0) {
      // Update cover
      VirtualPool._registerCover(
        poolId,
        coverId_,
        coverAmount,
        premiums
      );

      emit CoverUpdated(coverId_);
    } else {
      emit CoverClosed(coverId_);
      // @dev No need to freeze farming rewards since the cover owner needs to hold the cover to update it
    }
  }

  /// ======= LIQUIDITY CHANGES ======= ///

  /**
   * @notice Adds a position's liquidity to the pools and their overlaps
   * @param poolIds_ The IDs of the pools to add liquidity to
   * @param positionId_ The ID of the position
   * @param amount_ The amount of liquidity to add
   * @param purgePools If it should purge expired covers
   *
   * @dev PoolIds are checked at creation to ensure they are unique and ascending
   */
  function _addOverlappingCapitalAfterCheck(
    uint64[] memory poolIds_,
    uint256 positionId_,
    uint256 amount_,
    bool purgePools
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint256 i; i < nbPoolIds; i++) {
      uint64 poolId0 = poolIds_[i];

      _checkPoolExists(poolId0);

      DataTypes.VPool storage pool0 = VirtualPool.getPool(poolId0);

      // Check if pool is currently paused
      _checkIsNotPaused(poolId0);

      // Remove expired covers
      /// @dev Skip the purge when adding liquidity since it has been done
      if (purgePools) VirtualPool._purgeExpiredCovers(poolId0);

      // Update premium rate, seconds per tick & LP position info
      VirtualPool._depositToPool(poolId0, positionId_, amount_);

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
        DataTypes.VPool storage pool1 = VirtualPool.getPool(poolId1);

        // Check if pool ID is greater than the previous one
        // This ensures each pool ID is unique & reduces computation cost
        if (poolId1 <= poolId0)
          revert PoolIdsMustBeUniqueAndAscending();

        if (poolId0 != poolId1) {
          // Check if pool is compatible
          if (!arePoolCompatible[poolId0][poolId1])
            revert IncompatiblePools(poolId0, poolId1);

          // Register overlap in both pools
          if (pool0.overlaps[poolId1] == 0) {
            pool0.overlappedPools.push(poolId1);
            pool1.overlappedPools.push(poolId0);
          }
        }

        pool0.overlaps[poolId1] += amount_;
      }
    }

    emit PositionLiquidityUpdated(positionId_, amount_, 0);
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
      DataTypes.VPool storage pool0 = VirtualPool.getPool(poolId0);

      // Need to clean covers to avoid them causing a utilization overflow
      VirtualPool._purgeExpiredCovers(poolId0);

      // Remove liquidity
      // The updated user capital & strategy rewards are the same at each iteration
      (capital, rewards) = VirtualPool._withdrawLiquidity(
        poolId0,
        positionId_,
        supplied_,
        amount_,
        strategyRewardIndex_,
        latestStrategyRewardIndex_,
        poolIds_
      );

      // Considering the verification that pool IDs are unique & ascending
      // then start index is i to reduce required number of loops
      for (uint256 j = i; j < nbPoolIds; j++) {
        uint64 poolId1 = poolIds_[j];
        pool0.overlaps[poolId1] -= amount_;
      }
    }

    emit PositionLiquidityUpdated(positionId_, 0, amount_);
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
    VirtualPool.getPool(coverToPool[coverId_]).ongoingClaims++;
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
    VirtualPool.getPool(coverToPool[coverId_]).ongoingClaims--;
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
    // this function should be called only by this contract
    if (msg.sender != address(this)) {
      revert SenderNotLiquidationManager();
    }

    // This will trigger the catch part of the try/catch
    if (newCoverAmount_ == 0) revert CoverAmountIsZero();

    VirtualPool._registerCover(
      poolId_,
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
    uint64 fromPoolId = coverToPool[coverId_];
    DataTypes.VPool storage poolA = VirtualPool.getPool(fromPoolId);

    uint256 ratio = compensationAmount_.rayDiv(
      VirtualPool.totalLiquidity(fromPoolId)
    );
    // The ration cannot be over 100% of the pool's liquidity (1 RAY)
    if (RayMath.RAY < ratio) revert RatioAbovePoolCapacity();

    uint256 strategyId = poolA.strategyId;
    uint256 strategyRewardIndex = strategyManager.getRewardIndex(
      strategyId
    );

    uint256 nbPools = poolA.overlappedPools.length;

    // Get compensation ID and its storage pointer
    uint256 compensationId = nextCompensationId;
    nextCompensationId++;
    DataTypes.Compensation storage compensation = VirtualPool
      .getCompensation(compensationId);
    // Register data common to all affected pools
    compensation.fromPoolId = fromPoolId;
    compensation.ratio = ratio;
    compensation.strategyRewardIndexBeforeClaim = strategyRewardIndex;

    for (uint256 i; i < nbPools; i++) {
      uint64 poolIdB = poolA.overlappedPools[i];
      DataTypes.VPool storage poolB = VirtualPool.getPool(poolIdB);

      (DataTypes.VPool storage pool0, uint64 poolId1) = fromPoolId <
        poolIdB
        ? (poolA, poolIdB)
        : (poolB, fromPoolId);

      // Skip if overlap is 0 because the pools no longer share liquidity
      if (pool0.overlaps[poolId1] == 0) continue;
      // Update pool state & remove expired covers
      VirtualPool._purgeExpiredCovers(poolIdB);

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
        VirtualPool._syncLiquidity(poolIdB, 0, amountToRemove, true);

        // Reduce available liquidity,
        // at i = 0 this is the self liquidity of cover's pool
        pool0.overlaps[poolId1] -= amountToRemove;

        // Only remove liquidity in indirectly dependant pools other than the cover's pool
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
      // If the cover isn't expired, then reduce the cover amount
      if (isCoverActive(coverId_)) {
        // Get the amount of premiums left
        uint256 premiums = VirtualPool
          ._computeCurrentCoverInfo(fromPoolId, coverId_)
          .premiumsLeft;

        // Reduce the cover amount by the compensation amount
        uint256 newCoverAmount = poolA.covers[coverId_].coverAmount -
          compensationAmount_;

        // Close the existing cover
        VirtualPool._closeCover(fromPoolId, coverId_);

        // Update cover
        try
          this.attemptReopenCover(
            fromPoolId,
            coverId_,
            newCoverAmount,
            premiums
          )
        {} catch {
          // If updating the cover fails beacause of not enough liquidity,
          // then close the cover entirely & transfer premiums back to user
          IERC20(poolA.paymentAsset).safeTransfer(claimant, premiums);
        }
      }
    }

    // Pay out the compensation from the strategy
    strategyManager.payoutFromStrategy(
      strategyId,
      compensationAmount_,
      claimant
    );

    emit CompensationPaid(fromPoolId, compensationId);
  }

  /// ======= MISC HELPERS ======= ///

  /**
   * @notice Purges a pool's expired covers up to a certain timestamp
   * @param poolId_ The ID of the pool
   * @param timestamp_ The timestamp up to which to purge the covers
   */
  function purgeExpiredCoversUpTo(
    uint64 poolId_,
    uint256 timestamp_
  ) external nonReentrant {
    if (timestamp_ <= block.timestamp)
      revert MustPurgeExpiredTokenInTheFuture();

    VirtualPool._purgeExpiredCoversUpTo(poolId_, timestamp_);
  }

  /**
   * @notice Updates a position up to a certain compensation index
   * @param positionId_ The ID of the position
   * @param endCompensationIndexes_ The end indexes of the compensations to update up to for each pool
   */
  function updatePositionUpTo(
    uint256 positionId_,
    uint256[] calldata endCompensationIndexes_
  ) external nonReentrant onlyPositionOwner(positionId_) {
    Position storage position = _positions[positionId_];

    // Locks interests to avoid abusively early withdrawal commits
    if (position.commitWithdrawalTimestamp != 0)
      revert CannotUpdatePositionIfCommittedWithdrawal();

    address account = positionToken.ownerOf(positionId_);

    VirtualPool.UpdatedPositionInfo memory info;
    uint256 latestStrategyRewardIndex;

    for (uint256 i; i < position.poolIds.length; i++) {
      // Clean pool from expired covers
      VirtualPool._purgeExpiredCovers(position.poolIds[i]);

      DataTypes.VPool storage pool = VirtualPool.getPool(
        position.poolIds[i]
      );

      if (
        endCompensationIndexes_[i] <=
        pool.lpInfos[positionId_].beginClaimIndex ||
        pool.compensationIds.length - 1 < endCompensationIndexes_[i]
      ) revert OutOfBounds();

      {
        // Get the updated position info
        (info, latestStrategyRewardIndex) = VirtualPool
          ._processCompensationsForPosition(
            position.poolIds[i],
            position.poolIds,
            VirtualPool.UpdatePositionParams({
              currentLiquidityIndex: pool.slot0.liquidityIndex,
              tokenId: positionId_,
              userCapital: position.supplied,
              strategyRewardIndex: position.strategyRewardIndex,
              latestStrategyRewardIndex: 0, // unused in this context
              strategyId: pool.strategyId,
              itCompounds: pool.strategyManager.itCompounds(
                pool.strategyId
              ),
              endCompensationId: endCompensationIndexes_[i],
              nbPools: position.poolIds.length
            })
          );
      }

      // Pay cover rewards and send fees to treasury
      VirtualPool._payRewardsAndFees(
        position.poolIds[i],
        info.coverRewards,
        account,
        0,
        position.poolIds.length
      );

      // Update lp info to reflect the new state of the position
      pool.lpInfos[positionId_] = info.newLpInfo;
      // We want to update the position's strategy reward index to the latest compensation
      if (position.strategyRewardIndex < latestStrategyRewardIndex)
        position.strategyRewardIndex = latestStrategyRewardIndex;
    }
  }

  /// ======= ADMIN ======= ///

  /**
   * @notice Pause or unpause a pool
   * @param poolId_ The ID of the pool
   * @param isPaused_ True if the pool should be paused
   *
   * @dev You cannot buy cover, increase cover or add liquidity in a paused pool
   */
  function pausePool(
    uint64 poolId_,
    bool isPaused_
  ) external onlyOwner {
    VirtualPool.getPool(poolId_).isPaused = isPaused_;
  }

  /**
   * @notice Updates the withdraw delay and the maximum leverage
   * @param withdrawDelay_ The new withdraw delay
   * @param maxLeverage_ The new maximum leverage
   */
  function updateConfig(
    IEcclesiaDao ecclesiaDao_,
    IStrategyManager strategyManager_,
    address claimManager_,
    address yieldRewarder_,
    uint256 withdrawDelay_,
    uint256 maxLeverage_,
    uint256 leverageFeePerPool_
  ) external onlyOwner {
    ecclesiaDao = ecclesiaDao_;
    strategyManager = strategyManager_;

    yieldRewarder = yieldRewarder_;
    claimManager = claimManager_;

    withdrawDelay = withdrawDelay_;
    maxLeverage = maxLeverage_;
    leverageFeePerPool = leverageFeePerPool_;
  }
}
