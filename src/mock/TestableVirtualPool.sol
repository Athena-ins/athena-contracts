// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Libraries
import { VirtualPool } from "../libs/VirtualPool.sol";

/**
 * @title TestableVirtualPool
 *
 * @notice This contract can be imported in the Liquidity Manager in order to expose internal
 * VirtualPool functions to the test suite.
 *
 * @dev This contract is meant to be used only in the test suite and should not be deployed in the
 * production environment.
 */
abstract contract TestableVirtualPool {
  using VirtualPool for VirtualPool.VPool;

  /**
   * @notice Safe transient storage to convert memory uint64[] to storage uint64[].
   */
  uint256 currentIndex;
  mapping(uint256 _index => uint64[]) private transientPoolIds;

  /**
   * @notice Gets the pool storage pointer from the child contract
   */
  function(uint64)
    internal
    view
    returns (VirtualPool.VPool storage) getPool;

  constructor(
    function(uint64)
      internal
      view
      returns (VirtualPool.VPool storage) getPool_
  ) {
    getPool = getPool_;
  }

  // ======= READ METHODS ======= //

  function totalLiquidity(
    uint64 poolId_
  ) public view returns (uint256) {
    return getPool(poolId_).totalLiquidity();
  }

  function availableLiquidity(
    uint64 poolId_
  ) public view returns (uint256) {
    return getPool(poolId_).availableLiquidity();
  }

  // ======= LIQUIDITY ======= //

  function _depositToPool(
    uint64 poolId_,
    uint256 tokenId_,
    uint256 amount_
  ) public {
    return getPool(poolId_)._depositToPool(tokenId_, amount_);
  }

  function _payRewardsAndFees(
    uint64 poolId_,
    uint256 rewards_,
    address account_,
    uint256 yieldBonus_,
    uint256 nbPools_
  ) public {
    return
      getPool(poolId_)._payRewardsAndFees(
        rewards_,
        account_,
        yieldBonus_,
        nbPools_
      );
  }

  /// -------- TAKE INTERESTS -------- ///

  /**
   * @dev Need to update user capital & payout strategy rewards upon calling this function
   */
  function _takePoolInterests(
    uint64 poolId_,
    uint256 tokenId_,
    address account_,
    uint256 amount_,
    uint256 yieldBonus_,
    uint64[] memory poolIds_
  ) public returns (uint256, uint256) {
    currentIndex++;
    transientPoolIds[currentIndex] = poolIds_;

    return
      getPool(poolId_)._takePoolInterests(
        tokenId_,
        account_,
        amount_,
        yieldBonus_,
        transientPoolIds[currentIndex]
      );
  }

  /// -------- WITHDRAW -------- ///

  function _withdrawLiquidity(
    uint64 poolId_,
    uint256 tokenId_,
    uint256 amount_,
    uint64[] memory poolIds_
  ) public returns (uint256, uint256) {
    currentIndex++;
    transientPoolIds[currentIndex] = poolIds_;

    return
      getPool(poolId_)._withdrawLiquidity(
        tokenId_,
        amount_,
        transientPoolIds[currentIndex]
      );
  }

  // ======= COVERS ======= //

  /// -------- BUY -------- ///

  function _addPremiumPosition(
    uint64 poolId_,
    uint256 coverId_,
    uint256 beginPremiumRate_,
    uint32 lastTick_
  ) public {
    return
      getPool(poolId_)._addPremiumPosition(
        coverId_,
        beginPremiumRate_,
        lastTick_
      );
  }

  function _buyCover(
    uint64 poolId_,
    uint256 coverId_,
    uint256 coverAmount_,
    uint256 premiums_
  ) public {
    return
      getPool(poolId_)._buyCover(coverId_, coverAmount_, premiums_);
  }

  /// -------- CLOSE -------- ///

  function _closeCover(
    uint64 poolId_,
    uint256 coverId_,
    uint256 coverAmount_
  ) public {
    return getPool(poolId_)._closeCover(coverId_, coverAmount_);
  }

  // ======= public POOL HELPERS ======= //

  function _removeTick(
    uint64 poolId_,
    uint32 _tick
  ) public returns (uint256[] memory coverIds) {
    return getPool(poolId_)._removeTick(_tick);
  }

  function _syncLiquidity(
    uint64 poolId_,
    uint256 liquidityToAdd_,
    uint256 liquidityToRemove_
  ) public {
    return
      getPool(poolId_)._syncLiquidity(
        liquidityToAdd_,
        liquidityToRemove_
      );
  }

  function _purgeExpiredCovers(uint64 poolId_) public {
    return getPool(poolId_)._purgeExpiredCovers();
  }

  // ======= VIEW HELPERS ======= //

  function _coverInfo(
    uint64 poolId_,
    uint256 coverId_
  ) public view returns (VirtualPool.CoverInfo memory info) {
    return getPool(poolId_)._coverInfo(coverId_);
  }

  function _crossingInitializedTick(
    uint64 poolId_,
    VirtualPool.Slot0 memory slot0_,
    uint32 tick_
  )
    public
    view
    returns (
      VirtualPool.Slot0 memory /* slot0_ */,
      uint256 utilization,
      uint256 premiumRate
    )
  {
    return getPool(poolId_)._crossingInitializedTick(slot0_, tick_);
  }

  function _refresh(
    uint64 poolId_,
    uint256 timestamp_
  )
    public
    view
    returns (
      VirtualPool.Slot0 memory /* slot0 */,
      uint256 /* liquidityIndex */
    )
  {
    return getPool(poolId_)._refresh(timestamp_);
  }

  function _getUpdatedPositionInfo(
    uint64 poolId_,
    uint256 tokenId_,
    uint256 userCapital_,
    uint64[] memory poolIds_
  ) public returns (VirtualPool.UpdatedPositionInfo memory info) {
    currentIndex++;
    transientPoolIds[currentIndex] = poolIds_;

    return
      getPool(poolId_)._getUpdatedPositionInfo(
        tokenId_,
        userCapital_,
        transientPoolIds[currentIndex]
      );
  }

  function getPremiumRate(
    uint64 poolId_,
    uint256 utilizationRate_
  ) public view returns (uint256 /* premiumRate */) {
    return getPool(poolId_).getPremiumRate(utilizationRate_);
  }

  // ======= PURE HELPERS ======= //

  function getDailyCost(
    uint256 oldDailyCost_,
    uint256 oldPremiumRate_,
    uint256 newPremiumRate_
  ) public pure returns (uint256) {
    return
      getDailyCost(oldDailyCost_, oldPremiumRate_, newPremiumRate_);
  }

  function secondsPerTick(
    uint256 _oldSecondsPerTick,
    uint256 _oldPremiumRate,
    uint256 _newPremiumRate
  ) public pure returns (uint256) {
    return
      secondsPerTick(
        _oldSecondsPerTick,
        _oldPremiumRate,
        _newPremiumRate
      );
  }

  function currentPremiumRate(
    uint64 poolId_
  ) public view returns (uint256) {
    return getPool(poolId_).currentPremiumRate();
  }

  function updatedPremiumRate(
    uint64 poolId_,
    uint256 _coveredCapitalToAdd,
    uint256 _coveredCapitalToRemove
  ) public view returns (uint256) {
    return
      getPool(poolId_).updatedPremiumRate(
        _coveredCapitalToAdd,
        _coveredCapitalToRemove
      );
  }

  function _utilization(
    uint256 coveredCapital_,
    uint256 liquidity_
  ) public pure returns (uint256 rate) {
    return _utilization(coveredCapital_, liquidity_);
  }
}
