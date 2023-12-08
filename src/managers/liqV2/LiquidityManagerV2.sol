// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Contracts
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
// Libraries
import { RayMath } from "../../libs/RayMath.sol";
import { VirtualPool } from "./VirtualPool.sol";
// Interfaces
import { IAthenaCore } from "../../interfaces/IAthenaCore.sol";

// ======= ERRORS ======= //

error PoolIsPaused();
error PoolIdsMustBeUniqueAndAscending();
error IncompatiblePools(uint128 poolIdA, uint128 poolIdB);

contract LiquidityManagerV2 is ERC721, ERC721Enumerable {
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
  // Maps poolId 0 -> poolId 1 -> overlapping capital
  // @dev poolId A -> poolId A points to a pool's self available liquidity
  // @dev liquidity overlap is always registered in the lower poolId
  mapping(uint128 _poolId0 => mapping(uint128 _poolId1 => uint256 _amount))
    public overlaps;
  // Maps pool IDs to the overlapped pool IDs
  mapping(uint128 _poolId => uint128[] _poolIds)
    public overlappedPools;

  // ======= CONSTRUCTOR ======= //

  constructor(IAthenaCore core) ERC721("Athena LP NFT", "AthenaLP") {
    core = core;
  }

  /// ======= MODIFIERS ======= ///
  /// ======= VIEWS ======= ///
  /// ======= POOLS ======= ///
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
  /// ======= CLOSE POSITION ======= ///
  /// ======= FEE DISCOUNT ======= ///
  /// ======= LIQUIDITY OVERLAPS ======= ///

  // @dev These make the assumption that the pool IDs are unique and ascending
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
          dependantPools[poolId0].push(poolId1);
          dependantPools[poolId1].push(poolId0);
        }

        overlaps[poolId0][poolId1] += amount_;
      }
    }
  }

  // @dev These make the assumption that the pool IDs are unique and ascending
  function _removeOverlappingCapital(
    uint128[] memory poolIds_,
    uint256 amount_
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint128 i; i < nbPoolIds; i++) {
      for (uint128 j = i; j < nbPoolIds; j++) {
        overlaps[poolIds_[i]][poolIds_[j]] -= amount_;
      }
    }
  }

  /// ======= LIQUIDITY FOR CLAIMS ======= ///
}
