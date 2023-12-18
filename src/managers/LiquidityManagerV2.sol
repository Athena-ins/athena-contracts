// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Contracts
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// Libraries
import { RayMath } from "../../libs/RayMath.sol";
import { VirtualPool } from "./VirtualPool.sol";
// Interfaces
import { IAthenaCore } from "../../interfaces/IAthenaCore.sol";

// ======= ERRORS ======= //

error OnlyTokenOwner();
error PoolsHaveOngoingClaims();
error PoolIsPaused();
error PoolIdsMustBeUniqueAndAscending();
error IncompatiblePools(uint128 poolIdA, uint128 poolIdB);
error WithdrawCommitDelayNotReached();

contract LiquidityManagerV2 is
  ERC721,
  ERC721Enumerable,
  ReentrancyGuard
{
  using RayMath for uint256;
  using VirtualPool for VirtualPool.VPool;

  // ======= STRUCTS ======= //

  struct Position {
    uint256 supplied;
    uint256 rewardIndex; // @bw should be stored by strat manager per token id
    uint128 commitWithdrawalTimestamp;
    uint128[] poolIds;
  }

  struct PoolOverlap {
    uint128 poolId;
    uint256 amount;
  }

  // ======= STORAGE ======= //

  IAthenaCore core;

  /// The token ID position data
  uint256 public nextPoolId;
  mapping(uint256 => Position) private positions;
  uint256 public withdrawDelay = 14 days;

  // Maps a pool ID to the virtualized pool's storage
  mapping(uint128 _poolId => VirtualPool.VPool _virtualPool)
    public vPools;
  /// The ID of the next token that will be minted.
  uint256 private nextTokenId = 0;

  // Maps pool0 -> pool1 -> areCompatible for LP leverage
  mapping(uint128 => mapping(uint128 => bool))
    public arePoolCompatible;

  // ======= CONSTRUCTOR ======= //

  constructor(IAthenaCore core) ERC721("Athena LP NFT", "AthenaLP") {
    core = core;
  }

  function poolInfo(
    uint256 poolId_
  ) external view returns (VirtualPool.VPool memory) {
    return pools[_poolId];
  }

  /// ======= MODIFIERS ======= ///

  modifier onlyTokenOwner(uint256 tokenId, address account) {
    if (account != ownerOf(tokenId)) revert OnlyTokenOwner();
    _;
  }

  /// ======= VIEWS ======= ///
  /// ======= POOLS ======= ///

  function createPool(
    address underlyingAsset_,
    uint256 protocolShare_,
    uint256 uOptimal_,
    uint256 r0_,
    uint256 rSlope1_,
    uint256 rSlope2_,
    uint128[] calldata compatiblePools_
  ) external onlyOwner {
    // Save pool ID to memory and update for next
    uint128 poolId = nextPoolId;
    nextPoolId++;

    // Get storage pointer to pool
    VirtualPool.VPool storage pool = vPools[poolId];

    // Create virtual pool
    pool._vPoolConstructor(
      poolId,
      underlyingAsset_,
      protocolShare_, //Ray
      uOptimal_, //Ray
      r0_, //Ray
      rSlope1_, //Ray
      rSlope2_ //Ray
    );

    // Add compatible pools
    // @dev Registered both ways for safety
    uint256 nbPools = compatiblePools_.length;
    for (uint256 i; i < nbPools; i++) {
      uint128 compatiblePoolId = compatiblePools_[i];
      arePoolCompatible[poolId][compatiblePoolId] = true;
      arePoolCompatible[compatiblePoolId][poolId] = true;
    }
  }

  /// ======= MAKE POSITION ======= ///

  function depositToPosition(
    address account,
    uint256 amount,
    uint128[] calldata poolIds
  ) external onlyCore {
    // Save new position tokenId and update for next
    uint256 tokenId = nextTokenId;
    nextTokenId++;

    // Check pool compatibility & underlying token then register overlapping capital
    _addOverlappingCapitalAfterCheck(poolIds, amount);
    // Deposit fund into the strategy if any
    // All pools share the same strategy so we can use the last pool ID in memory
    // @bw push or pull funds ?
    IStrategy strategy = vPools[poolId].strategy;
    strategy.depositToStrategy(tokenId, amount);

    Position storage position = positions[tokenId];
    position = Position({ supplied: amount, poolIds: poolIds });
    _mint(account, tokenId);
  }

  /// ======= UPDATE POSITION ======= ///

  function updatePosition(
    uint256 tokenId,
    uint256 amount
  ) external onlyCore {
    Position storage position = _positions[tokenId];

    // Take interests in all pools before update
    _takeInterestsInAllPools(account, tokenId);
    // Check pool compatibility & underlying token then register overlapping capital
    _addOverlappingCapitalAfterCheck(position.poolIds, amount);

    IStrategy strategy = vPools[position.poolIds[0]].strategy;
    strategy.depositToStrategy(tokenId, amount);

    position.amountSupplied += amount;
  }

  /// ======= TAKE INTERESTS ======= ///

  // @bw needs to be updated for strat reward withdraw + take fees in pools
  // compute amount of rewards & transfer from cover manager to user + register new reward index
  function takeInterests(address account, uint256 tokenId) public {
    Position storage position = _positions[tokenId];
    IAthena _core = IAthena(core);

    uint256 amountSuppliedUpdated;
    uint256 nbPools = position.poolIds.length;
    for (uint256 i; i < nbPools; i++) {
      VPool storage pool = vPools[position.poolIds[i]];

      // Remove expired policies
      pool.actualizingProtocolAndRemoveExpiredPolicies();

      (uint256 _newUserCapital, uint256 _aaveScaledBalanceToRemove) = pool
        .takeInterestsInPool( // takePoolInterests
        account,
        tokenId,
        position.amountSupplied,
        position.poolIds,
        position.feeRate
      );
    }

    if (position.amountSupplied != amountSuppliedUpdated) {
      _positions[tokenId].amountSupplied = amountSuppliedUpdated;
      _positions[tokenId]
        .aaveScaledBalance -= aaveScaledBalanceUpdated;
    }
  }

  /// ======= CLOSE POSITION ======= ///

  function commitWithdraw(
    uint256 tokenId_,
    address account_
  ) external onlyCore onlyTokenOwner(tokenId_, account_) {
    positions[tokenId_].commitWithdrawalTimestamp = block.timestamp;
  }

  function withdrawFromPosition(
    uint256 tokenId_,
    address account_
  ) external onlyCore onlyTokenOwner(tokenId_, account_) {
    Position storage position = positions[tokenId_];
    uint256 commitTimestamp = position.commitWithdrawalTimestamp;

    if (block.timestamp < commitTimestamp + withdrawDelay)
      revert WithdrawCommitDelayNotReached();

    uint128[] memory poolIds = position.poolIds;

    // Check that pools have no ongoing claims
    bool claimsLock = claimManager.canWithdraw(poolIds);
    if (claimsLock) revert PoolsHaveOngoingClaims();

    uint256 feeDiscount = staking.feeDiscountOf(account_);
    _removeOverlappingCapital(
      poolIds,
      tokenId_,
      position.supplied,
      feeDiscount
    );

    uint256 feeDiscount = staking.feeDiscountOf(account_);
    // All pools have same strategy since they are compatible
    IStrategy strategy = vPools[poolId].strategy;
    // @bw this should send back funds to user with rewards, minus fees
    strategy.withdrawFromStrategy(
      tokenId_,
      amount,
      account_,
      feeDiscount
    );

    _burn(tokenId_);
  }

  /// ======= FEE DISCOUNT ======= ///

  function feeDiscountUpdate(
    address account_,
    uint128 prevFeeDiscount_
  ) external onlyStaking {
    // @bw Should take interests in all positions using the prev fee discount
  }

  /// ======= LIQUIDITY OVERLAPS ======= ///

  /// @dev Pool IDs must be checked to ensure they are unique and ascending
  function _addOverlappingCapitalAfterCheck(
    uint128[] memory poolIds_,
    uint256 amount_
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint128 i; i < nbPoolIds; i++) {
      uint128 poolId0 = poolIds_[i];
      VPool storage pool0 = vPools[poolId0];

      // Check if pool is currently paused
      if (pool0.isPaused) revert PoolIsPaused();

      // Remove expired policies
      pool0.actualizingProtocolAndRemoveExpiredPolicies();

      // Considering the verification that pool IDs are unique & ascending
      // then start index is i to reduce required number of loops
      for (uint128 j = i; j < nbPoolIds; j++) {
        uint128 poolId1 = poolIds_[j];
        VPool storage pool1 = vPools[poolId1];

        // Check if pool ID is greater than the previous one
        // This ensures each pool ID is unique & reduces computation cost
        if (poolId1 <= poolId0)
          revert PoolIdsMustBeUniqueAndAscending();

        // Check if pool is compatible
        if (!arePoolCompatible[poolId0][poolId1])
          revert IncompatiblePools(poolId0, poolId1);

        if (poolId0 != poolId1 && overlaps[poolId0][poolId1] == 0) {
          pool0.overlappedPools.push(poolId1);
          pool1.overlappedPools.push(poolId0);
        }

        pool0.overlaps[poolId1] += amount_;
      }
    }
  }

  function _removeOverlappingCapital(
    uint128[] memory poolIds_,
    uint256 tokenId_,
    uint256 amount_,
    uint128 feeDiscount_
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint128 i; i < nbPoolIds; i++) {
      uint128 poolId0 = poolIds_[i];
      VPool storage pool0 = vPools[poolId0];

      // Remove expired policies
      pool0.actualizingProtocolAndRemoveExpiredPolicies();
      // Remove liquidity
      pool0.withdrawLiquidity(
        poolIds_,
        tokenId_,
        amount_,
        feeDiscount_
      );

      // Considering the verification that pool IDs are unique & ascending
      // then start index is i to reduce required number of loops
      for (uint128 j = i; j < nbPoolIds; j++) {
        uint128 poolId1 = poolIds_[j];
        VPool storage pool1 = vPools[poolId1];

        pool0.overlaps[poolId1] -= amount_;
      }
    }
  }

  /// ======= LIQUIDITY FOR CLAIMS ======= ///

  // claimLiquidityRemoval
  function claimLiquidityReduce(
    uint128 poolId_,
    uint256 amount_,
    address claimant_
  ) external onlyClaimManager {
    VPool storage poolA = vPools[poolId_];
    uint256 ratio = amount_.rayDiv(poolA.availableLiquidity());

    uint256 nbPools = poolA.dependantPools.length;
    for (uint128 i; i < nbPools + 1; i++) {
      uint128 poolIdB = poolA.dependantPools[i];
      VPool storage poolB = vPools[poolIdB];

      (VPool storage pool0, uint128 poolId1) = poolId_ < poolIdB
        ? (poolA, poolIdB)
        : (poolB, poolId_);

      // Remove liquidity from dependant pool
      uint256 overlapAmount = pool0.overlaps[poolId1];
      uint256 amountToRemove = overlapAmount.rayMul(ratio);
      // Pool overlaps are used to compute the amount of liq to remove from each pool
      overlappingLiquidity[poolId0][poolId1] -= amountToRemove;
      overlappingLiquidity[poolIdB][poolIdB] -= amountToRemove;

      poolB.actualizingProtocolAndRemoveExpiredPolicies(
        relatedPoolAddress
      );

      poolB._updateSlot0WhenAvailableLiquidityChange(
        0,
        amountToRemove
      );
      poolB.processedClaims.push(
        PoolClaim({
          fromPoolId: poolId_,
          ratio: ratio,
          liquidityIndexBeforeClaim: poolB.liquidityIndex
        })
      );
    }

    strategy.payoutFromStrategy(amount, claimant_);
  }
}
