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
  /// ======= UPDATE POSITION ======= ///
  /// ======= CLOSE POSITION ======= ///
  /// ======= FEE DISCOUNT ======= ///
  /// ======= LIQUIDITY OVERLAPS ======= ///
  /// ======= LIQUIDITY FOR CLAIMS ======= ///
}
