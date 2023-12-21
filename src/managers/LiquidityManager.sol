// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Contracts
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Libraries
import { RayMath } from "../libs/RayMath.sol";
import { VirtualPool } from "../libs/VirtualPool.sol";

// Interfaces
import { IAthenaCore } from "../interfaces/IAthenaCore.sol";
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";
import { IStaking } from "../interfaces/IStaking.sol";

// ======= ERRORS ======= //

error OnlyTokenOwner();
error PoolsHaveOngoingClaims();
error PoolIsPaused();
error PoolIdsMustBeUniqueAndAscending();
error IncompatiblePools(uint128 poolIdA, uint128 poolIdB);
error WithdrawCommitDelayNotReached();

contract LiquidityManagerV2 is
  ERC721Enumerable,
  ReentrancyGuard,
  Ownable
{
  using RayMath for uint256;
  using VirtualPool for VirtualPool.VPool;

  // ======= STRUCTS ======= //

  struct Position {
    uint256 supplied;
    uint256 rewardIndex; // @bw should be stored by strat manager per token id
    uint256 commitWithdrawalTimestamp;
    uint128[] poolIds;
  }

  struct PoolOverlap {
    uint128 poolId;
    uint256 amount;
  }

  // ======= STORAGE ======= //

  IStaking staking;
  IStrategyManager strategies;

  /// The token ID position data
  uint128 public nextPoolId;
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

  constructor(
    IStaking staking_,
    IStrategyManager strategies_
  ) ERC721("Athena LP NFT", "AthenaLP") Ownable(msg.sender) {
    staking = staking_;
    strategies = strategies_;
  }

  // @bw cannort return complex struct
  // function poolInfo(
  //   uint256 poolId_
  // ) external view returns (VirtualPool.VPool memory) {
  //   return vPools[poolId_];
  // }

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

  function createPosition(
    address account,
    uint256 amount,
    uint128[] calldata poolIds
  ) external onlyOwner {
    // Save new position tokenId and update for next
    uint256 tokenId = nextTokenId;
    nextTokenId++;

    // Check pool compatibility & underlying token then register overlapping capital
    _addOverlappingCapitalAfterCheck(poolIds, amount);
    // Deposit fund into the strategy if any
    // All pools share the same strategy so we can use the last pool ID in memory
    // @bw push or pull funds ?
    uint256 strategyId = vPools[poolIds[0]].strategyId;
    strategies.depositToStrategy(strategyId, tokenId, amount);

    uint256 rewardIndex = strategies.getRewardIndex(strategyId);

    positions[tokenId] = Position({
      supplied: amount,
      rewardIndex: rewardIndex,
      commitWithdrawalTimestamp: 0,
      poolIds: poolIds
    });

    _mint(account, tokenId);
  }

  /// ======= UPDATE POSITION ======= ///

  function updatePosition(
    uint256 tokenId,
    uint256 amount
  ) external onlyOwner {
    Position storage position = positions[tokenId];

    // Take interests in all pools before update
    takeInterests(msg.sender, tokenId);
    // Check pool compatibility & underlying token then register overlapping capital
    _addOverlappingCapitalAfterCheck(position.poolIds, amount);

    uint256 strategyId = vPools[position.poolIds[0]].strategyId;
    strategies.depositToStrategy(strategyId, tokenId, amount);

    position.supplied += amount;
  }

  /// ======= TAKE INTERESTS ======= ///

  // @bw needs to be updated for strat reward withdraw + take fees in pools
  // compute amount of rewards & transfer from cover manager to user + register new reward index
  function takeInterests(address account, uint256 tokenId) public {
    Position storage position = positions[tokenId];

    uint256 amountSuppliedUpdated;
    uint256 nbPools = position.poolIds.length;
    for (uint256 i; i < nbPools; i++) {
      VirtualPool.VPool storage pool = vPools[position.poolIds[i]];

      // Remove expired policies
      pool._actualizing();

      (uint256 _newUserCapital, uint256 _scaledAmountToRemove) = pool
        ._takePoolInterests( // takePoolInterests
        account,
        tokenId,
        position.supplied,
        position.poolIds,
        42 // position.feeRate
      );
    }

    if (position.supplied != amountSuppliedUpdated) {
      positions[tokenId].supplied = amountSuppliedUpdated;
      positions[tokenId].rewardIndex -= 0; // @bw check change aaveScaledBalanceUpdated;
    }
  }

  /// ======= CLOSE POSITION ======= ///

  function commitWithdraw(
    uint256 tokenId_,
    address account_
  ) external onlyOwner onlyTokenOwner(tokenId_, account_) {
    positions[tokenId_].commitWithdrawalTimestamp = block.timestamp;
  }

  function withdrawFromPosition(
    uint256 tokenId_,
    address account_
  ) external onlyOwner onlyTokenOwner(tokenId_, account_) {
    Position storage position = positions[tokenId_];
    uint256 commitTimestamp = position.commitWithdrawalTimestamp;

    if (block.timestamp < commitTimestamp + withdrawDelay)
      revert WithdrawCommitDelayNotReached();

    uint128[] memory poolIds = position.poolIds;

    // Check that pools have no ongoing claims
    // @bw need fix
    // bool claimsLock = claimManager.canWithdraw(poolIds);
    // if (claimsLock) revert PoolsHaveOngoingClaims();

    uint256 feeDiscount = staking.feeDiscountOf(account_);
    _removeOverlappingCapital(
      poolIds,
      tokenId_,
      position.supplied,
      feeDiscount
    );

    // All pools have same strategy since they are compatible
    uint256 strategyId = vPools[poolIds[0]].strategyId;
    // @bw this should send back funds to user with rewards, minus fees
    strategies.withdrawFromStrategy(
      strategyId,
      tokenId_,
      422, // @bw to fix
      account_,
      feeDiscount
    );

    _burn(tokenId_);
  }

  /// ======= FEE DISCOUNT ======= ///

  function feeDiscountUpdate(
    address account_,
    uint128 prevFeeDiscount_
  ) external {
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
      VirtualPool.VPool storage pool0 = vPools[poolId0];

      // Check if pool is currently paused
      if (pool0.isPaused) revert PoolIsPaused();

      // Remove expired policies
      pool0._actualizing();

      // Considering the verification that pool IDs are unique & ascending
      // then start index is i to reduce required number of loops
      for (uint128 j = i; j < nbPoolIds; j++) {
        uint128 poolId1 = poolIds_[j];
        VirtualPool.VPool storage pool1 = vPools[poolId1];

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
    }
  }

  function _removeOverlappingCapital(
    uint128[] memory poolIds_,
    uint256 tokenId_,
    uint256 amount_,
    uint256 feeDiscount_
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint128 i; i < nbPoolIds; i++) {
      uint128 poolId0 = poolIds_[i];
      VirtualPool.VPool storage pool0 = vPools[poolId0];

      // Remove expired policies
      pool0._actualizing();
      // Remove liquidity
      pool0._withdrawLiquidity(
        poolIds_,
        tokenId_,
        amount_,
        feeDiscount_
      );

      // Considering the verification that pool IDs are unique & ascending
      // then start index is i to reduce required number of loops
      for (uint128 j = i; j < nbPoolIds; j++) {
        uint128 poolId1 = poolIds_[j];
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
  ) external onlyOwner {
    VirtualPool.VPool storage poolA = vPools[poolId_];
    uint256 ratio = amount_.rayDiv(poolA.availableLiquidity());

    // All pools have same strategy since they are compatible
    uint256 strategyId = vPools[poolA.overlappedPools[0]].strategyId;

    uint256 nbPools = poolA.overlappedPools.length;
    for (uint128 i; i < nbPools + 1; i++) {
      uint128 poolIdB = poolA.overlappedPools[i];
      VirtualPool.VPool storage poolB = vPools[poolIdB];

      (VirtualPool.VPool storage pool0, uint128 poolId1) = poolId_ <
        poolIdB
        ? (poolA, poolIdB)
        : (poolB, poolId_);

      // Remove liquidity from dependant pool
      uint256 amountToRemove = pool0.overlaps[poolId1].rayMul(ratio);
      // Pool overlaps are used to compute the amount of liq to remove from each pool
      pool0.overlaps[poolId1] -= amountToRemove;
      poolB.overlaps[poolIdB] -= amountToRemove;

      poolB._actualizing();

      poolB._updateSlot0WhenAvailableLiquidityChange(
        0,
        amountToRemove
      );

      poolB.processedClaims.push(
        VirtualPool.PoolClaim({
          fromPoolId: poolId_,
          ratio: ratio,
          liquidityIndexBeforeClaim: poolB.liquidityIndex,
          rewardIndexBeforeClaim: strategies.getRewardIndex(
            strategyId
          )
        })
      );
    }

    strategies.payoutFromStrategy(strategyId, amount_, claimant_);
  }
}
